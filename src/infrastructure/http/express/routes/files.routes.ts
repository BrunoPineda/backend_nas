import { Router } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { UploadFileUseCase } from '../../../../application/use-cases/files/UploadFileUseCase';
import { DownloadFileUseCase } from '../../../../application/use-cases/files/DownloadFileUseCase';
import { ListFilesUseCase } from '../../../../application/use-cases/files/ListFilesUseCase';
import { RenameFileUseCase } from '../../../../application/use-cases/files/RenameFileUseCase';
import { MoveFileUseCase } from '../../../../application/use-cases/files/MoveFileUseCase';
import { authMiddleware } from '../middleware/auth.middleware';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { ArchivoRepository } from '../../../../infrastructure/database/sqlserver/repositories/ArchivoRepository';
import { CarpetaRepository } from '../../../../infrastructure/database/sqlserver/repositories/CarpetaRepository';
import { TemporaryStorageService } from '../../../../infrastructure/storage/local/TemporaryStorageService';
import { LocalStorageService } from '../../../../infrastructure/storage/local/LocalStorageService';

dotenv.config();

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Inicializar servicios
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const archivoRepository = new ArchivoRepository();
const carpetaRepository = new CarpetaRepository();
const tempStorageService = new TemporaryStorageService(process.env.TEMP_STORAGE_PATH || './temp');
const permanentStorageService = new LocalStorageService(process.env.STORAGE_ROOT_PATH || '../storage');

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_BYTES || '104857600');

// FORZAR: SIEMPRE permitir TODOS los tipos de archivo
// Ignorar completamente ALLOWED_MIME_TYPES del .env
// El sistema debe aceptar CUALQUIER tipo de archivo
const allowedMimeTypes: string[] = ['*']; // SIEMPRE ['*'] - NO CAMBIAR

console.log('File upload config:', {
  maxFileSize: maxFileSize,
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
  allowedMimeTypes
);

const downloadFileUseCase = new DownloadFileUseCase(
  archivoRepository,
  carpetaRepository,
  tempStorageService,
  permanentStorageService
);

const listFilesUseCase = new ListFilesUseCase(archivoRepository, carpetaRepository);

// Todas las rutas requieren autenticación
router.use(authMiddleware(jwtService));

// Subir archivo
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
    }

    const userId = (req as any).user.userId;
    const folderId = req.body.folderId || null;

    const archivo = await uploadFileUseCase.execute(req.file, userId, folderId);

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
});

// Listar archivos
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const folderId = req.query.folderId as string | undefined;

    const archivos = await listFilesUseCase.execute(
      userId,
      folderId === undefined ? undefined : folderId || null
    );

    res.json({
      success: true,
      data: archivos.map(a => ({
        id: a.id,
        nombre: a.nombreOriginal,
        tamaño: a.tamanoBytes,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
        folderId: a.idCarpeta
      }))
    });
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

// Eliminar archivo
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const fileId = req.params.id;

    const archivo = await archivoRepository.findById(fileId);
    if (!archivo || archivo.idUsuario !== userId) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    await archivoRepository.delete(fileId);
    res.json({ success: true, message: 'Archivo eliminado correctamente' });
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
    const { idCarpeta } = req.body;

    const moveFileUseCase = new MoveFileUseCase(archivoRepository, carpetaRepository);
    const archivo = await moveFileUseCase.execute(req.params.id, idCarpeta || null, userId);

    res.json({ success: true, data: archivo });
  } catch (error) {
    next(error);
  }
});

export default router;

