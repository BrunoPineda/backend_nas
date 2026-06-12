import { Router } from 'express';
import dotenv from 'dotenv';
import { authMiddleware } from '../middleware/auth.middleware';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { CarpetaRepository } from '../../../../infrastructure/database/sqlserver/repositories/CarpetaRepository';
import { UsuarioRepository } from '../../../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import { CreateFolderUseCase } from '../../../../application/use-cases/folders/CreateFolderUseCase';
import { ListFoldersUseCase } from '../../../../application/use-cases/folders/ListFoldersUseCase';
import { RenameFolderUseCase } from '../../../../application/use-cases/folders/RenameFolderUseCase';
import { InactivateFolderUseCase } from '../../../../application/use-cases/folders/InactivateFolderUseCase';
import { RecoverFolderUseCase } from '../../../../application/use-cases/folders/RecoverFolderUseCase';
import { MoveFolderUseCase } from '../../../../application/use-cases/folders/MoveFolderUseCase';
import { ShareFolderUseCase } from '../../../../application/use-cases/folders/ShareFolderUseCase';
import { PoliticaSubidaRepository } from '../../../../infrastructure/database/sqlserver/repositories/PoliticaSubidaRepository';
import { RolRepository } from '../../../../infrastructure/database/sqlserver/repositories/RolRepository';
import { AuditoriaRepository } from '../../../../infrastructure/database/sqlserver/repositories/AuditoriaRepository';
import { ForbiddenError, ValidationError } from '../../../../shared/errors/AppError';
import { Carpeta } from '../../../../domain/entities/Carpeta';
import {
  AUDIT_ACCION_CARPETA_INACTIVADA,
  AUDIT_ACCION_CARPETA_REACTIVADA,
} from '../../../../application/constants/folderAudit';
import { getClientIp, safeJsonDetalle } from '../utils/requestContext';

dotenv.config();

const políticaRepo = new PoliticaSubidaRepository();

function puedeAdministrarEspacioUsuario(authPayload: any, espacioDueñoId: string): boolean {
  const admin = authPayload?.rol && String(authPayload.rol).toUpperCase() === 'ADMIN';
  return admin || authPayload.userId === espacioDueñoId;
}

async function dueñoEspacioSegúnCarpetaNavegada(browseFolderId: string | null, jwtUserId: string): Promise<string> {
  if (!browseFolderId || !browseFolderId.trim()) {
    return jwtUserId;
  }
  const c = await carpetaRepository.findById(browseFolderId.trim());
  if (!c) {
    throw new ValidationError('Carpeta actual no válida para políticas');
  }
  const ok = await carpetaRepository.usuarioPuedeAccederACarpeta(jwtUserId, browseFolderId.trim());
  if (!ok) {
    throw new ForbiddenError('No tienes acceso para administrar políticas en este lugar');
  }
  return c.idUsuario;
}

/** Misma semántica que en files.routes para destino real de la subida. */
async function dueñoEspacioSegúnDestinoSubida(uploadFolderId: string | null, jwtUserId: string): Promise<string> {
  if (!uploadFolderId) {
    return jwtUserId;
  }
  const c = await carpetaRepository.findById(uploadFolderId);
  if (!c) throw new ForbiddenError('Carpeta destino inválida');
  const puede = await carpetaRepository.usuarioPuedeAccederACarpeta(jwtUserId, uploadFolderId);
  if (!puede) throw new ForbiddenError('No tienes acceso para subir en esta ubicación');
  return c.idUsuario;
}

function dtoPolíticaEfectiva(policy: import('../../../../infrastructure/database/sqlserver/repositories/PoliticaSubidaRepository').PoliticaSubidaRow | null) {
  if (!policy) {
    return {
      inheritsOnly: true,
      allowPhotos: true,
      allowVideos: true,
      allowDocuments: true,
      allowOthers: true,
      allowMultiple: true,
      maxMbPerFile: null as number | null,
      extensionsCsv: '' as string
    };
  }
  return {
    inheritsOnly: false,
    allowPhotos: policy.permiteFotos,
    allowVideos: policy.permiteVideos,
    allowDocuments: policy.permiteDocumentos,
    allowOthers: policy.permiteOtros,
    allowMultiple: policy.permiteMultiples,
    maxMbPerFile: policy.maxPesoMb,
    extensionsCsv: policy.extensionesPermitidas || ''
  };
}

async function carpetasConResponsable(carpetas: Carpeta[]) {
  const propietariosUnicos = [...new Set(carpetas.map((c) => c.idUsuario))];
  const nombrePorUsuarioId = new Map<string, string>();
  await Promise.all(
    propietariosUnicos.map(async (uid) => {
      const usuario = await usuarioRepository.findById(uid);
      nombrePorUsuarioId.set(uid, usuario?.nombre ?? '—');
    })
  );
  return carpetas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    idPadre: c.idPadre,
    esCompartida: c.esCompartida,
    esPublica: c.esPublica,
    createdAt: c.createdAt,
    idUsuario: c.idUsuario,
    usuarioResponsableNombre: nombrePorUsuarioId.get(c.idUsuario) ?? '—',
    activo: !c.estaEliminada(),
  }));
}

const router = Router();
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const carpetaRepository = new CarpetaRepository();
const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();
const auditoriaRepository = new AuditoriaRepository();
const createFolderUseCase = new CreateFolderUseCase(carpetaRepository, usuarioRepository);
const listFoldersUseCase = new ListFoldersUseCase(carpetaRepository);
const renameFolderUseCase = new RenameFolderUseCase(carpetaRepository);
const inactivateFolderUseCase = new InactivateFolderUseCase(carpetaRepository, rolRepository);
const recoverFolderUseCase = new RecoverFolderUseCase(carpetaRepository, rolRepository);
const moveFolderUseCase = new MoveFolderUseCase(carpetaRepository);
const shareFolderUseCase = new ShareFolderUseCase(carpetaRepository, usuarioRepository);

router.use(authMiddleware(jwtService));

// Carpetas compartidas conmigo (lista plana; el front arma pestañas raíz)
router.get('/shared', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const carpetas = await carpetaRepository.findCompartidasByUsuario(userId);
    res.json({
      success: true,
      data: await carpetasConResponsable(carpetas),
    });
  } catch (error) {
    next(error);
  }
});

// Listar carpetas
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const isAdmin = String((req as any).user?.rol ?? '').toUpperCase() === 'ADMIN';
    const idPadre = req.query.idPadre as string | undefined;
    const tree = req.query.tree === 'true';
    const sharedRoot = req.query.sharedRoot as string | undefined;

    let carpetas;
    if (tree) {
      if (sharedRoot) {
        carpetas = await listFoldersUseCase.executeSharedTree(userId, sharedRoot);
      } else {
        carpetas = await listFoldersUseCase.executeTree(userId, isAdmin);
      }
    } else {
      carpetas = await listFoldersUseCase.execute(
        userId,
        idPadre === undefined ? undefined : idPadre || null,
        isAdmin
      );
    }

    res.json({
      success: true,
      data: await carpetasConResponsable(carpetas),
    });
  } catch (error) {
    next(error);
  }
});

// Crear carpeta
router.post('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { nombre, idPadre } = req.body;

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const carpeta = await createFolderUseCase.execute(nombre, userId, idPadre || null);
    res.json({ success: true, data: carpeta });
  } catch (error) {
    next(error);
  }
});

// Renombrar carpeta
router.put('/:id/rename', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const carpeta = await renameFolderUseCase.execute(req.params.id, nombre, userId);
    res.json({ success: true, data: carpeta });
  } catch (error) {
    next(error);
  }
});

// Mover carpeta
router.put('/:id/move', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { idPadre } = req.body;

    const carpeta = await moveFolderUseCase.execute(req.params.id, idPadre || null, userId);
    res.json({ success: true, data: carpeta });
  } catch (error) {
    next(error);
  }
});

// Compartir carpeta
router.post('/:id/share', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { idUsuario, permiso } = req.body;

    if (!idUsuario) {
      return res.status(400).json({ success: false, error: 'El ID del usuario es requerido' });
    }

    await shareFolderUseCase.execute(req.params.id, userId, idUsuario, permiso || 'READ');
    res.json({ success: true, message: 'Carpeta compartida correctamente' });
  } catch (error) {
    next(error);
  }
});

// Dejar de compartir carpeta
router.delete('/:id/share/:userId', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    await shareFolderUseCase.unshareFolder(req.params.id, userId, req.params.userId);
    res.json({ success: true, message: 'Carpeta dejada de compartir' });
  } catch (error) {
    next(error);
  }
});

router.get('/upload-policy/effective', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const fid = typeof req.query.folderId === 'string' && req.query.folderId.trim() ? req.query.folderId.trim() : null;
    const espacioDueño = await dueñoEspacioSegúnDestinoSubida(fid, userId);
    const efectiva = await políticaRepo.resolveEffective(espacioDueño, fid);
    res.json({
      success: true,
      data: dtoPolíticaEfectiva(efectiva)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/upload-policy/settings', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const jwtUserId = user.userId;
    const browseId =
      typeof req.query.browseFolderId === 'string' && req.query.browseFolderId.trim()
        ? req.query.browseFolderId.trim()
        : null;
    const rawScope = req.query.scopeFolderId as string | undefined;
    const scopeNorm =
      rawScope === '__root__' || rawScope === '' || typeof rawScope === 'undefined'
        ? null
        : rawScope.trim().length > 0
          ? rawScope.trim()
          : null;

    const espacioDueño = await dueñoEspacioSegúnCarpetaNavegada(browseId, jwtUserId);
    if (!puedeAdministrarEspacioUsuario(user, espacioDueño)) {
      throw new ForbiddenError('No puedes configurar políticas de subida aquí');
    }

    if (scopeNorm) {
      const carp = await carpetaRepository.findById(scopeNorm);
      if (!carp || carp.idUsuario !== espacioDueño) {
        throw new ValidationError('La carpeta seleccionada no pertenece a este espacio de archivos');
      }
    }

    const explicit = await políticaRepo.findExact(espacioDueño, scopeNorm);
    const exemptionsUserIds = explicit ? await políticaRepo.findExemptions(explicit.id) : [];

    res.json({
      success: true,
      data: explicit
        ? {
            configured: true,
            scopeFolderId: scopeNorm,
            allowPhotos: explicit.permiteFotos,
            allowVideos: explicit.permiteVideos,
            allowDocuments: explicit.permiteDocumentos,
            allowOthers: explicit.permiteOtros,
            allowMultiple: explicit.permiteMultiples,
            maxMbPerFile: explicit.maxPesoMb,
            extensionsCsv: explicit.extensionesPermitidas || '',
            exemptionsUserIds
          }
        : {
            configured: false,
            scopeFolderId: scopeNorm,
            allowPhotos: true,
            allowVideos: true,
            allowDocuments: true,
            allowOthers: true,
            allowMultiple: true,
            maxMbPerFile: null as number | null,
            extensionsCsv: '',
            exemptionsUserIds: [] as string[]
          }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/upload-policy', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const jwtUserId = user.userId;
    const body = req.body as {
      browseFolderId?: string | null;
      scopeFolderId?: string | null | '__root__';
      allowPhotos?: boolean;
      allowVideos?: boolean;
      allowDocuments?: boolean;
      allowOthers?: boolean;
      allowMultiple?: boolean;
      maxMbPerFile?: number | null;
      extensionsCsv?: string;
      exemptionsUserIds?: string[];
    };

    const browseNorm =
      typeof body.browseFolderId === 'string' && body.browseFolderId.trim() ? body.browseFolderId.trim() : null;
    const scopeNorm =
      body.scopeFolderId === '__root__' || body.scopeFolderId === '' || body.scopeFolderId == null
        ? null
        : typeof body.scopeFolderId === 'string' && body.scopeFolderId.trim()
          ? body.scopeFolderId.trim()
          : null;

    const espacioDueño = await dueñoEspacioSegúnCarpetaNavegada(browseNorm, jwtUserId);
    if (!puedeAdministrarEspacioUsuario(user, espacioDueño)) {
      throw new ForbiddenError('No puedes configurar políticas de subida aquí');
    }

    if (scopeNorm) {
      const carp = await carpetaRepository.findById(scopeNorm);
      if (!carp || carp.idUsuario !== espacioDueño) {
        throw new ValidationError('La carpeta seleccionada no pertenece a este espacio de archivos');
      }
    }

    let parsedMaxMb: number | null = null;
    if (typeof body.maxMbPerFile === 'number' && !Number.isNaN(body.maxMbPerFile) && body.maxMbPerFile > 0) {
      parsedMaxMb = body.maxMbPerFile;
    }

    const guardado = await políticaRepo.upsertPolitica({
      idUsuarioDueno: espacioDueño,
      idCarpeta: scopeNorm,
      permiteFotos: Boolean(body.allowPhotos),
      permiteVideos: Boolean(body.allowVideos),
      permiteDocumentos: Boolean(body.allowDocuments),
      permiteOtros: Boolean(body.allowOthers),
      permiteMultiples: Boolean(body.allowMultiple ?? true),
      maxPesoMb: parsedMaxMb,
      extensionesPermitidas:
        typeof body.extensionsCsv === 'string' && body.extensionsCsv.trim().length
          ? body.extensionsCsv.trim()
          : null
    });

    await políticaRepo.replaceExemptions(guardado.id, Array.isArray(body.exemptionsUserIds) ? body.exemptionsUserIds : []);

    res.json({ success: true, message: 'Política guardada correctamente', data: { idPolitica: guardado.id } });
  } catch (error) {
    next(error);
  }
});

router.delete('/upload-policy', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const jwtUserId = user.userId;
    const browseNorm =
      typeof req.query.browseFolderId === 'string' && req.query.browseFolderId.trim()
        ? req.query.browseFolderId.trim()
        : null;
    const rs = req.query.scopeFolderId as string | undefined;
    const scopeNorm =
      rs === '__root__' || rs === '' || typeof rs === 'undefined'
        ? null
        : String(rs || '').trim() || null;

    const espacioDueño = await dueñoEspacioSegúnCarpetaNavegada(browseNorm, jwtUserId);
    if (!puedeAdministrarEspacioUsuario(user, espacioDueño)) {
      throw new ForbiddenError('No puedes configurar políticas de subida aquí');
    }
    await políticaRepo.deletePolitica(espacioDueño, scopeNorm);
    res.json({ success: true, message: 'Política eliminada; se usará configuración por defecto o herencia' });
  } catch (error) {
    next(error);
  }
});

// Recuperar carpeta inactiva (solo permiso folder.delete_any)
router.put('/:id/reactivar', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const carpeta = await recoverFolderUseCase.execute(req.params.id, userId);

    try {
      await auditoriaRepository.registrar({
        idUsuario: userId,
        tipoAccion: AUDIT_ACCION_CARPETA_REACTIVADA,
        idCarpeta: carpeta.id,
        ip: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        detalle: safeJsonDetalle({
          nombreCarpeta: carpeta.nombre,
          idUsuarioPropietario: carpeta.idUsuario,
          idPadre: carpeta.idPadre,
        }),
      });
    } catch (e) {
      console.error('Auditoría (reactivar carpeta): no se pudo registrar', e);
    }

    res.json({ success: true, message: 'Carpeta recuperada correctamente' });
  } catch (error) {
    next(error);
  }
});

// Inactivar carpeta (baja lógica; permisos folder.delete / folder.delete_any)
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const resultado = await inactivateFolderUseCase.execute(req.params.id, userId);

    try {
      await auditoriaRepository.registrar({
        idUsuario: userId,
        tipoAccion: AUDIT_ACCION_CARPETA_INACTIVADA,
        idCarpeta: resultado.carpeta.id,
        ip: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        detalle: safeJsonDetalle({
          nombreCarpeta: resultado.carpeta.nombre,
          idUsuarioPropietario: resultado.carpeta.idUsuario,
          idPadre: resultado.carpeta.idPadre,
          carpetasInactivadas: resultado.carpetasInactivadas,
          modoAdmin: resultado.modoAdmin,
        }),
      });
    } catch (e) {
      console.error('Auditoría (inactivar carpeta): no se pudo registrar', e);
    }

    res.json({
      success: true,
      message:
        resultado.carpetasInactivadas > 1
          ? `Carpeta inactivada (${resultado.carpetasInactivadas} carpetas en el subárbol)`
          : 'Carpeta inactivada correctamente',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

