import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { CarpetaRepository } from '../../../../infrastructure/database/sqlserver/repositories/CarpetaRepository';
import { UsuarioRepository } from '../../../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import { CreateFolderUseCase } from '../../../../application/use-cases/folders/CreateFolderUseCase';
import { ListFoldersUseCase } from '../../../../application/use-cases/folders/ListFoldersUseCase';
import { RenameFolderUseCase } from '../../../../application/use-cases/folders/RenameFolderUseCase';
import { DeleteFolderUseCase } from '../../../../application/use-cases/folders/DeleteFolderUseCase';
import { MoveFolderUseCase } from '../../../../application/use-cases/folders/MoveFolderUseCase';
import { ShareFolderUseCase } from '../../../../application/use-cases/folders/ShareFolderUseCase';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const carpetaRepository = new CarpetaRepository();
const usuarioRepository = new UsuarioRepository();
const createFolderUseCase = new CreateFolderUseCase(carpetaRepository, usuarioRepository);
const listFoldersUseCase = new ListFoldersUseCase(carpetaRepository);
const renameFolderUseCase = new RenameFolderUseCase(carpetaRepository);
const deleteFolderUseCase = new DeleteFolderUseCase(carpetaRepository);
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
      data: carpetas.map(c => ({
        id: c.id,
        nombre: c.nombre,
        idPadre: c.idPadre,
        esCompartida: c.esCompartida,
        esPublica: c.esPublica,
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Listar carpetas
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const idPadre = req.query.idPadre as string | undefined;
    const tree = req.query.tree === 'true';
    const sharedRoot = req.query.sharedRoot as string | undefined;

    let carpetas;
    if (tree) {
      if (sharedRoot) {
        carpetas = await listFoldersUseCase.executeSharedTree(userId, sharedRoot);
      } else {
        carpetas = await listFoldersUseCase.executeTree(userId);
      }
    } else {
      carpetas = await listFoldersUseCase.execute(userId, idPadre === undefined ? undefined : idPadre || null);
    }

    res.json({
      success: true,
      data: carpetas.map(c => ({
        id: c.id,
        nombre: c.nombre,
        idPadre: c.idPadre,
        esCompartida: c.esCompartida,
        esPublica: c.esPublica,
        createdAt: c.createdAt
      }))
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

// Eliminar carpeta
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const forzar = req.query.forzar === 'true';

    await deleteFolderUseCase.execute(req.params.id, userId, forzar);
    res.json({ success: true, message: 'Carpeta eliminada correctamente' });
  } catch (error) {
    next(error);
  }
});

export default router;

