import { Router } from 'express';
import { EnlaceRepository } from '../../../../infrastructure/database/sqlserver/repositories/EnlaceRepository';
import { ArchivoRepository } from '../../../../infrastructure/database/sqlserver/repositories/ArchivoRepository';
import { TemporaryStorageService } from '../../../../infrastructure/storage/local/TemporaryStorageService';
import { LocalStorageService } from '../../../../infrastructure/storage/local/LocalStorageService';
import { GetFileByTokenUseCase } from '../../../../application/use-cases/links/GetFileByTokenUseCase';
import { NotFoundError } from '../../../../shared/errors/AppError';
import dotenv from 'dotenv';
import { resolveStorageRootAbsolute } from '../../../../application/services/NasCategoryFolderService';

dotenv.config();

const router = Router();

const enlaceRepository = new EnlaceRepository();
const archivoRepository = new ArchivoRepository();
const tempStorageService = new TemporaryStorageService(process.env.TEMP_STORAGE_PATH || './temp');
const permanentStorageService = new LocalStorageService(resolveStorageRootAbsolute());

const getFileByTokenUseCase = new GetFileByTokenUseCase(
  enlaceRepository,
  archivoRepository,
  tempStorageService,
  permanentStorageService
);

// Endpoint público para acceder a archivos por token
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { download } = req.query;

    const { buffer, nombreOriginal, mimeType, esImagen, esVideo, esPdf, esAudio } =
      await getFileByTokenUseCase.execute(token);

    // Codificar nombre del archivo para caracteres especiales
    const encodedFileName = encodeURIComponent(nombreOriginal);

    res.setHeader('Content-Type', mimeType);
    
    // Imagen, vídeo, PDF o audio sin ?download=true: inline en el navegador
    if ((esImagen || esVideo || esPdf || esAudio) && download !== 'true') {
      res.setHeader('Content-Disposition', `inline; filename="${nombreOriginal}"; filename*=UTF-8''${encodedFileName}`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${nombreOriginal}"; filename*=UTF-8''${encodedFileName}`);
    }

    res.send(buffer);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(410).json({
        success: false,
        error: error.message || 'Este enlace ha expirado o no es válido'
      });
    }
    next(error);
  }
});

export default router;

