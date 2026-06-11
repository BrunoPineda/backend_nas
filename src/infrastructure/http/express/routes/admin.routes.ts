import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { JwtService } from '../../../security/JwtService';
import { UsuarioRepository } from '../../../database/sqlserver/repositories/UsuarioRepository';
import { RolRepository } from '../../../database/sqlserver/repositories/RolRepository';
import { PermisoRepository } from '../../../database/sqlserver/repositories/PermisoRepository';
import { CategoriaRepository } from '../../../database/sqlserver/repositories/CategoriaRepository';
import { ListUsersUseCase } from '../../../../application/use-cases/users/ListUsersUseCase';
import { CreateUserUseCase } from '../../../../application/use-cases/users/CreateUserUseCase';
import { UpdateUserUseCase } from '../../../../application/use-cases/users/UpdateUserUseCase';
import { DeleteUserUseCase } from '../../../../application/use-cases/users/DeleteUserUseCase';
import { ListRolesUseCase } from '../../../../application/use-cases/roles/ListRolesUseCase';
import { CreateRoleUseCase } from '../../../../application/use-cases/roles/CreateRoleUseCase';
import { UpdateRolePermissionsUseCase } from '../../../../application/use-cases/roles/UpdateRolePermissionsUseCase';
import { ListPermissionsUseCase } from '../../../../application/use-cases/roles/ListPermissionsUseCase';
import { PasswordService } from '../../../security/PasswordService';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();
const permisoRepository = new PermisoRepository();
const categoriaRepository = new CategoriaRepository();
const passwordService = new PasswordService();

// Middleware de autenticación
router.use(authMiddleware(jwtService));

// ========== USUARIOS ==========
router.get('/users', async (req, res, next) => {
  try {
    const useCase = new ListUsersUseCase(usuarioRepository, rolRepository, categoriaRepository);
    const users = await useCase.execute();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const useCase = new CreateUserUseCase(usuarioRepository, rolRepository, categoriaRepository, passwordService);
    const user = await useCase.execute(req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const useCase = new UpdateUserUseCase(usuarioRepository, rolRepository, categoriaRepository, passwordService);
    const user = await useCase.execute(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const useCase = new DeleteUserUseCase(usuarioRepository);
    await useCase.execute(req.params.id);
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    next(error);
  }
});

// ========== ROLES ==========
router.get('/roles', async (req, res, next) => {
  try {
    const useCase = new ListRolesUseCase(rolRepository, permisoRepository);
    const roles = await useCase.execute();
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
});

router.post('/roles', async (req, res, next) => {
  try {
    const useCase = new CreateRoleUseCase(rolRepository);
    const role = await useCase.execute(req.body);
    res.json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
});

router.put('/roles/:id/permissions', async (req, res, next) => {
  try {
    const useCase = new UpdateRolePermissionsUseCase(rolRepository);
    await useCase.execute(req.params.id, req.body.permisos || []);
    res.json({ success: true, message: 'Permisos actualizados' });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const data = await categoriaRepository.findAll();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { codigo, descripcion } = req.body as { codigo?: string; descripcion?: string };
    if (!codigo?.trim() || !descripcion?.trim()) {
      res.status(400).json({ success: false, error: 'codigo y descripcion son obligatorios' });
      return;
    }
    const cat = await categoriaRepository.create(codigo.trim(), descripcion.trim());
    res.json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
});

// ========== PERMISOS ==========
router.get('/permissions', async (req, res, next) => {
  try {
    const useCase = new ListPermissionsUseCase(permisoRepository);
    const permissions = await useCase.execute();
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

export default router;

