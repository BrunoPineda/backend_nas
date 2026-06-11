import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { EnlaceRepository } from '../../../../infrastructure/database/sqlserver/repositories/EnlaceRepository';
import { ArchivoRepository } from '../../../../infrastructure/database/sqlserver/repositories/ArchivoRepository';
import { CreateLinkUseCase } from '../../../../application/use-cases/links/CreateLinkUseCase';
import { ListLinksUseCase } from '../../../../application/use-cases/links/ListLinksUseCase';
import { RevokeLinkUseCase } from '../../../../application/use-cases/links/RevokeLinkUseCase';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const enlaceRepository = new EnlaceRepository();
const archivoRepository = new ArchivoRepository();
const createLinkUseCase = new CreateLinkUseCase(enlaceRepository, archivoRepository);
const listLinksUseCase = new ListLinksUseCase(enlaceRepository);
const revokeLinkUseCase = new RevokeLinkUseCase(enlaceRepository, archivoRepository);

router.use(authMiddleware(jwtService));

// Crear enlace
router.post('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { fileId, tipo, expiresAt, maxVisits } = req.body;

    if (!fileId || !tipo) {
      return res.status(400).json({ success: false, error: 'fileId y tipo son requeridos' });
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
    const enlace = await createLinkUseCase.execute(
      { fileId, tipo, expiresAt: expiresAtDate, maxVisits },
      userId
    );

    res.json({
      success: true,
      data: {
        id: enlace.id,
        token: enlace.token,
        esTemporal: enlace.esTemporal,
        fechaExpiracion: enlace.fechaExpiracion,
        maxVisitas: enlace.maxVisitas,
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/v/${enlace.token}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// Listar enlaces del usuario
router.get('/my', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const enlaces = await listLinksUseCase.execute(userId);

    res.json({
      success: true,
      data: enlaces.map(e => ({
        id: e.id,
        token: e.token,
        esTemporal: e.esTemporal,
        fechaExpiracion: e.fechaExpiracion,
        maxVisitas: e.maxVisitas,
        visitasActuales: e.visitasActuales,
        fechaUltimaVisita: e.fechaUltimaVisita,
        activo: e.activo,
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/v/${e.token}`,
        estaExpirado: e.estaExpirado()
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Revocar enlace
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    await revokeLinkUseCase.execute(req.params.id, userId);
    res.json({ success: true, message: 'Enlace revocado correctamente' });
  } catch (error) {
    next(error);
  }
});

export default router;

