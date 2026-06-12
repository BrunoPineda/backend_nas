import { Router } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { UploadFileUseCase } from '../../../../application/use-cases/files/UploadFileUseCase';
import { DownloadFileUseCase } from '../../../../application/use-cases/files/DownloadFileUseCase';
import { ListFilesUseCase } from '../../../../application/use-cases/files/ListFilesUseCase';
import { RenameFileUseCase } from '../../../../application/use-cases/files/RenameFileUseCase';
import { MoveFileUseCase } from '../../../../application/use-cases/files/MoveFileUseCase';
import { GetUserStorageSummaryUseCase } from '../../../../application/use-cases/files/GetUserStorageSummaryUseCase';
import { authMiddleware } from '../middleware/auth.middleware';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { ArchivoRepository } from '../../../../infrastructure/database/sqlserver/repositories/ArchivoRepository';
import { CarpetaRepository } from '../../../../infrastructure/database/sqlserver/repositories/CarpetaRepository';
import { TemporaryStorageService } from '../../../../infrastructure/storage/local/TemporaryStorageService';
import { LocalStorageService } from '../../../../infrastructure/storage/local/LocalStorageService';
import { UsuarioRepository } from '../../../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import { CategoriaRepository } from '../../../../infrastructure/database/sqlserver/repositories/CategoriaRepository';
import { PoliticaSubidaRepository } from '../../../../infrastructure/database/sqlserver/repositories/PoliticaSubidaRepository';
import { RolRepository } from '../../../../infrastructure/database/sqlserver/repositories/RolRepository';
import { ForbiddenError } from '../../../../shared/errors/AppError';
import { assertMatchesUploadPolicy } from '../../../../application/services/UploadFolderPolicyValidator';
import { AuditoriaRepository } from '../../../../infrastructure/database/sqlserver/repositories/AuditoriaRepository';
import {
  AUDIT_ACCION_ARCHIVO_INACTIVADO,
  AUDIT_ACCION_ARCHIVO_REACTIVADO,
  AUDIT_ACCION_ARCHIVO_SUBIDO,
  AUDIT_ACCION_ARCHIVO_VIGENCIA,
} from '../../../../application/constants/fileAudit';
import { getClientIp, safeJsonDetalle } from '../utils/requestContext';
import { resolveStorageRootAbsolute } from '../../../../application/services/NasCategoryFolderService';
import { parseUploadVigenciaFromBody } from '../../../../application/services/UploadVigenciaParser';
import { UpdateFileVigenciaUseCase } from '../../../../application/use-cases/files/UpdateFileVigenciaUseCase';
import {
  formatByteLimit,
  getMaxBulkUploadFiles,
  getMaxFileSizeBytes,
} from '../../../../shared/constants/storageLimits';

import type { ArchivosListadoVigencia } from '../../../../domain/repositories/IArchivoRepository';
import { listarAreasNasArchivo, rutasRelativasCompletasArchivo } from '../../../../shared/utils/nasFileAreas';
import { sanitizarCodigoParaCarpetaNas } from '../../../../application/services/NasCategoryFolderService';

dotenv.config();

function parseArchivosVigenciaQuery(raw: unknown, isAdmin: boolean): ArchivosListadoVigencia {
  if (!isAdmin) return 'activos';
  const s = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (s === 'todos' || s === 'all') return 'todos';
  if (s === 'inactivos' || s === 'inactive') return 'inactivos';
  if (s === 'permanentes' || s === 'permanent') return 'permanentes';
  if (s === 'temporales' || s === 'temporal') return 'temporales';
  return 'activos';
}

const router = Router();
const maxFileSize = getMaxFileSizeBytes();
const maxBulkUploadFiles = getMaxBulkUploadFiles();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
});

// Inicializar servicios
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const archivoRepository = new ArchivoRepository();
const carpetaRepository = new CarpetaRepository();
const rolRepository = new RolRepository();
const usuarioRepository = new UsuarioRepository();
const categoriaRepository = new CategoriaRepository();
const tempStorageService = new TemporaryStorageService(process.env.TEMP_STORAGE_PATH || './temp');
const permanentStorageService = new LocalStorageService(resolveStorageRootAbsolute());

// FORZAR: SIEMPRE permitir TODOS los tipos de archivo
// Ignorar completamente ALLOWED_MIME_TYPES del .env
// El sistema debe aceptar CUALQUIER tipo de archivo
const allowedMimeTypes: string[] = ['*']; // SIEMPRE ['*'] - NO CAMBIAR

console.log('File upload config:', {
  maxFileSize: maxFileSize,
  maxBulkUploadFiles,
  allowedMimeTypes: allowedMimeTypes,
  envValue: process.env.ALLOWED_MIME_TYPES || 'no configurado',
  willAllowAll: true,
  note: '✅ PERMITIENDO TODOS LOS TIPOS DE ARCHIVO (forzado)'
});

const uploadFileUseCase = new UploadFileUseCase(
  archivoRepository,
  tempStorageService,
  permanentStorageService,
  maxFileSize,
  allowedMimeTypes,
  usuarioRepository,
  categoriaRepository
);

const downloadFileUseCase = new DownloadFileUseCase(
  archivoRepository,
  carpetaRepository,
  tempStorageService,
  permanentStorageService
);

const listFilesUseCase = new ListFilesUseCase(archivoRepository, carpetaRepository);
const getUserStorageSummaryUseCase = new GetUserStorageSummaryUseCase(
  archivoRepository,
  usuarioRepository
);
const updateFileVigenciaUseCase = new UpdateFileVigenciaUseCase(archivoRepository);

const politicaSubidaRepository = new PoliticaSubidaRepository();
const auditoriaRepository = new AuditoriaRepository();

async function resolverDueñoEspacioSubida(uploadFolderId: string | null, uploaderUserId: string): Promise<string> {
  if (!uploadFolderId) {
    return uploaderUserId;
  }
  const c = await carpetaRepository.findById(uploadFolderId);
  if (!c) {
    throw new ForbiddenError('Carpeta destino inválida');
  }
  const puede = await carpetaRepository.usuarioPuedeAccederACarpeta(uploaderUserId, uploadFolderId);
  if (!puede) {
    throw new ForbiddenError('No tienes acceso para subir archivos en esta carpeta');
  }
  return c.idUsuario;
}

// Todas las rutas requieren autenticación
router.use(authMiddleware(jwtService));

// Resumen de almacenamiento del usuario (total y desglose por tipo)
router.get('/storage-summary', async (req, res, next) => {
  try {
    const userId = (req as { user: { userId: string } }).user.userId;
    const summary = await getUserStorageSummaryUseCase.execute(userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// Límites de subida efectivos para el usuario autenticado
router.get('/upload-limits', async (req, res, next) => {
  try {
    const userId = (req as { user: { userId: string } }).user.userId;
    const usuario = await usuarioRepository.findById(userId);
    const maxFileSizeBytes = Math.min(maxFileSize, usuario?.maxTamanoArchivoBytes ?? maxFileSize);

    res.json({
      success: true,
      data: {
        maxFileSizeBytes,
        maxBulkUploadFiles,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Subir archivo
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (multerErr) => {
    if (multerErr) {
      if (multerErr instanceof multer.MulterError && multerErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: `El archivo supera el tamaño máximo permitido (${formatByteLimit(maxFileSize)})`,
        });
      }
      return next(multerErr);
    }

    void (async () => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
        }

        const userId = (req as any).user.userId;
        const folderIdRaw = req.body.folderId;
        const folderIdNorm =
          folderIdRaw && String(folderIdRaw).trim().length > 0 ? String(folderIdRaw).trim() : null;

        const espacioDueño = await resolverDueñoEspacioSubida(folderIdNorm, userId);
        const politica = await politicaSubidaRepository.resolveEffective(espacioDueño, folderIdNorm);
        const exentosList = politica ? await politicaSubidaRepository.findExemptions(politica.id) : [];

        const usuarioSube = await usuarioRepository.findById(userId);
        const serverHardMax = Math.min(
          maxFileSize,
          usuarioSube?.maxTamanoArchivoBytes ?? maxFileSize
        );

        assertMatchesUploadPolicy(req.file, politica, {
          uploaderId: userId,
          uploaderRole: (req as any).user.rol ?? 'USER',
          exemptUserIds: exentosList,
          serverHardMaxBytes: serverHardMax
        });

        const areaDestino =
          typeof req.body?.areaDestino === 'string' && req.body.areaDestino.trim().length > 0
            ? req.body.areaDestino.trim()
            : null;

        const { archivo } = await uploadFileUseCase.execute(req.file, userId, folderIdNorm, {
          areaDestino,
          jwtRol: (req as { user?: { rol?: string } }).user?.rol ?? null,
          vigencia: parseUploadVigenciaFromBody(req.body as Record<string, unknown>),
        });

        try {
          await auditoriaRepository.registrar({
            idUsuario: userId,
            tipoAccion: AUDIT_ACCION_ARCHIVO_SUBIDO,
            idArchivo: archivo.id,
            idCarpeta: archivo.idCarpeta,
            ip: getClientIp(req),
            userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
            detalle: safeJsonDetalle({
              nombreOriginal: archivo.nombreOriginal,
              mimeType: archivo.mimeType,
              tamanoBytes: archivo.tamanoBytes,
              idUsuarioPropietario: archivo.idUsuario,
              rutasArchivo: rutasRelativasCompletasArchivo(
                archivo.rutaFisica,
                archivo.nombreFisico,
                archivo.rutasEspejo
              ),
            }),
          });
        } catch (e) {
          console.error('Auditoría (subida): no se pudo registrar', e);
        }

        res.json({
          success: true,
          message: 'Archivo subido correctamente',
          data: {
            id: archivo.id,
            nombre: archivo.nombreOriginal,
            tamaño: archivo.tamanoBytes,
            mimeType: archivo.mimeType
          }
        });
      } catch (error) {
        next(error);
      }
    })();
  });
});

// Listar archivos
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const folderId = req.query.folderId as string | undefined;
    const isAdmin = String((req as any).user?.rol ?? '').toUpperCase() === 'ADMIN';
    const vigencia = parseArchivosVigenciaQuery(req.query.vigencia, isAdmin);

    const archivos = await listFilesUseCase.execute(
      userId,
      folderId === undefined ? undefined : folderId || null,
      vigencia,
      isAdmin
    );

    const propietariosUnicos = [...new Set(archivos.map((a) => a.idUsuario))];
    const nombrePorUsuarioId = new Map<string, string>();
    await Promise.all(
      propietariosUnicos.map(async (uid) => {
        const usuario = await usuarioRepository.findById(uid);
        nombrePorUsuarioId.set(uid, usuario?.nombre ?? '—');
      })
    );

    const categoriasActivas = await categoriaRepository.findAllActivas();
    const codigoPorSegmentoNas = new Map<string, string>();
    for (const cat of categoriasActivas) {
      const seg = sanitizarCodigoParaCarpetaNas(cat.codigo);
      if (seg) codigoPorSegmentoNas.set(seg.toUpperCase(), cat.codigo);
    }

    const resolverCategoriasNas = (rutaFisica: string, rutasEspejo: string[] | null) => {
      const segmentos = listarAreasNasArchivo(rutaFisica, rutasEspejo);
      return segmentos.map((seg) => codigoPorSegmentoNas.get(seg.toUpperCase()) ?? seg);
    };

    res.json({
      success: true,
      data: archivos.map((a) => ({
        id: a.id,
        nombre: a.nombreOriginal,
        tamaño: a.tamanoBytes,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
        folderId: a.idCarpeta,
        idUsuario: a.idUsuario,
        usuarioResponsableNombre: nombrePorUsuarioId.get(a.idUsuario) ?? '—',
        categoriasNas: resolverCategoriasNas(a.rutaFisica, a.rutasEspejo),
        activo: !a.estaEliminado() && a.estaEnVentanaVigencia(),
        esPermanente: a.esPermanente,
        fechaInicioVigencia: a.fechaInicioVigencia,
        fechaFinVigencia: a.fechaFinVigencia,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Recuperar archivo (quita baja lógica; restablece disponibilidad permanente)
router.put('/:id/reactivar', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const fileId = req.params.id;
    const isAdmin = String((req as any).user?.rol ?? '').toUpperCase() === 'ADMIN';

    const archivo = await archivoRepository.findByIdIncluyendoBaja(fileId);
    if (!archivo || !archivo.estaEliminado()) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado o ya está activo' });
    }

    const puede = archivo.idUsuario === userId || isAdmin;
    if (!puede) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    await archivoRepository.reactivar(fileId);

    try {
      await auditoriaRepository.registrar({
        idUsuario: userId,
        tipoAccion: AUDIT_ACCION_ARCHIVO_REACTIVADO,
        idArchivo: archivo.id,
        idCarpeta: archivo.idCarpeta,
        ip: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        detalle: safeJsonDetalle({
          nombreOriginal: archivo.nombreOriginal,
          mimeType: archivo.mimeType,
          tamanoBytes: archivo.tamanoBytes,
          idUsuarioPropietario: archivo.idUsuario,
        }),
      });
    } catch (e) {
      console.error('Auditoría (reactivar archivo): no se pudo registrar', e);
    }

    res.json({ success: true, message: 'Archivo recuperado correctamente' });
  } catch (error) {
    next(error);
  }
});

// Editar permanencia / ventana de vigencia
router.put('/:id/vigencia', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const fileId = req.params.id;
    const isAdmin = String((req as any).user?.rol ?? '').toUpperCase() === 'ADMIN';

    const archivo = await archivoRepository.findByIdIncluyendoBaja(fileId);
    if (!archivo) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    const vigencia = parseUploadVigenciaFromBody(req.body as Record<string, unknown>);

    await updateFileVigenciaUseCase.execute(fileId, userId, isAdmin, vigencia);

    try {
      await auditoriaRepository.registrar({
        idUsuario: userId,
        tipoAccion: AUDIT_ACCION_ARCHIVO_VIGENCIA,
        idArchivo: archivo.id,
        idCarpeta: archivo.idCarpeta,
        ip: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        detalle: safeJsonDetalle({
          nombreOriginal: archivo.nombreOriginal,
          esPermanente: vigencia.esPermanente,
          fechaInicioVigencia: vigencia.fechaInicioVigencia?.toISOString() ?? null,
          fechaFinVigencia: vigencia.fechaFinVigencia?.toISOString() ?? null,
        }),
      });
    } catch (e) {
      console.error('Auditoría (vigencia archivo): no se pudo registrar', e);
    }

    res.json({ success: true, message: 'Permanencia actualizada correctamente' });
  } catch (error) {
    next(error);
  }
});

// Descargar archivo
router.get('/:id/download', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const fileId = req.params.id;

    const { buffer, nombreOriginal, mimeType } = await downloadFileUseCase.execute(fileId, userId);

    // Codificar el nombre del archivo para soportar caracteres especiales (ñ, acentos, etc.)
    const encodedFileName = encodeURIComponent(nombreOriginal);
    
    res.setHeader('Content-Type', mimeType);
    // Usar RFC 5987 para nombres de archivo con caracteres especiales
    res.setHeader('Content-Disposition', `attachment; filename="${nombreOriginal}"; filename*=UTF-8''${encodedFileName}`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// Inactivar archivo (baja lógica; el archivo permanece en el almacenamiento NAS)
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const fileId = req.params.id;

    const archivo = await archivoRepository.findById(fileId);
    if (!archivo || archivo.idUsuario !== userId) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    try {
      await auditoriaRepository.registrar({
        idUsuario: userId,
        tipoAccion: AUDIT_ACCION_ARCHIVO_INACTIVADO,
        idArchivo: archivo.id,
        idCarpeta: archivo.idCarpeta,
        ip: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        detalle: safeJsonDetalle({
          nombreOriginal: archivo.nombreOriginal,
          mimeType: archivo.mimeType,
          tamanoBytes: archivo.tamanoBytes,
          idUsuarioPropietario: archivo.idUsuario,
        }),
      });
    } catch (e) {
      console.error('Auditoría (inactivar archivo): no se pudo registrar', e);
    }

    await archivoRepository.delete(fileId);
    res.json({ success: true, message: 'Archivo inactivado correctamente' });
  } catch (error) {
    next(error);
  }
});

// Renombrar archivo
router.put('/:id/rename', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const renameFileUseCase = new RenameFileUseCase(archivoRepository);
    const archivo = await renameFileUseCase.execute(req.params.id, nombre, userId);

    res.json({ success: true, data: archivo });
  } catch (error) {
    next(error);
  }
});

// Mover archivo
router.put('/:id/move', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const isAdmin = String((req as any).user?.rol ?? '').toUpperCase() === 'ADMIN';
    const { idCarpeta } = req.body;

    const moveFileUseCase = new MoveFileUseCase(archivoRepository, carpetaRepository, rolRepository);
    const archivo = await moveFileUseCase.execute(req.params.id, idCarpeta || null, userId, isAdmin);

    res.json({ success: true, data: archivo });
  } catch (error) {
    next(error);
  }
});

export default router;

