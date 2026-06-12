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
import { GetRoleCategoryMatrixUseCase } from '../../../../application/use-cases/roles/GetRoleCategoryMatrixUseCase';
import { UpdateRoleCategoryMatrixUseCase } from '../../../../application/use-cases/roles/UpdateRoleCategoryMatrixUseCase';
import { ListPermissionsUseCase } from '../../../../application/use-cases/roles/ListPermissionsUseCase';
import { ListFileAuditLogsUseCase } from '../../../../application/use-cases/audit/ListFileAuditLogsUseCase';
import { ExportAuditFilesXlsxUseCase } from '../../../../application/use-cases/audit/ExportAuditFilesXlsxUseCase';
import { PasswordService } from '../../../security/PasswordService';
import { AuditoriaRepository } from '../../../database/sqlserver/repositories/AuditoriaRepository';
import { PERMISO_ADMIN_VIEW_FILE_AUDIT } from '../../../../application/constants/fileAudit';
import { requirePermisoCodigoMiddleware } from '../middleware/requirePermiso.middleware';
import dotenv from 'dotenv';
import { mkdirNasFolderForCodigo, resolveStorageRootAbsolute } from '../../../../application/services/NasCategoryFolderService';

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
const auditoriaRepository = new AuditoriaRepository();
const passwordService = new PasswordService();

const auditoriaArchivosMw = requirePermisoCodigoMiddleware(
  rolRepository,
  PERMISO_ADMIN_VIEW_FILE_AUDIT
);

// Middleware de autenticación
router.use(authMiddleware(jwtService));

// ========== USUARIOS ==========
router.get('/users', async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const nombre = typeof req.query.nombre === 'string' ? req.query.nombre : undefined;
    const numeroDocumento = typeof req.query.numeroDocumento === 'string' ? req.query.numeroDocumento : undefined;
    const email = typeof req.query.email === 'string' ? req.query.email : undefined;

    const useCase = new ListUsersUseCase(usuarioRepository, rolRepository, categoriaRepository);
    const users = await useCase.execute({ page, limit, nombre, numeroDocumento, email });
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

router.get('/roles/category-matrix', async (req, res, next) => {
  try {
    const useCase = new GetRoleCategoryMatrixUseCase(rolRepository, categoriaRepository);
    const data = await useCase.execute();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put('/roles/category-matrix', async (req, res, next) => {
  try {
    const assignments = (req.body?.assignments ?? {}) as Record<string, string[]>;
    const useCase = new UpdateRoleCategoryMatrixUseCase(rolRepository, categoriaRepository);
    await useCase.execute(assignments);
    res.json({ success: true, message: 'Matriz roles × categorías actualizada' });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const manage = String(req.query.manage ?? '').toLowerCase() === 'true';
    if (manage) {
      const incluirInactivas = String(req.query.incluirInactivas ?? 'true').toLowerCase() !== 'false';
      const data = await categoriaRepository.findAllConUso(incluirInactivas);
      res.json({ success: true, data });
      return;
    }
    const data = await categoriaRepository.findAllActivas();
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
    try {
      await mkdirNasFolderForCodigo(resolveStorageRootAbsolute(), codigo.trim());
    } catch (e) {
      console.warn('Crear carpeta física por nueva categoría NAS:', e);
    }
    res.json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { descripcion } = req.body as { descripcion?: string };
    if (!descripcion?.trim()) {
      res.status(400).json({ success: false, error: 'descripcion es obligatoria' });
      return;
    }
    const cat = await categoriaRepository.updateDescripcion(req.params.id, descripcion.trim());
    res.json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
});

router.put('/categories/:id/inactivar', async (req, res, next) => {
  try {
    await categoriaRepository.inactivar(req.params.id);
    res.json({ success: true, message: 'Categoría inactivada' });
  } catch (error) {
    next(error);
  }
});

router.put('/categories/:id/reactivar', async (req, res, next) => {
  try {
    const cat = await categoriaRepository.findById(req.params.id);
    if (!cat) {
      res.status(404).json({ success: false, error: 'Categoría no encontrada' });
      return;
    }
    await categoriaRepository.reactivar(req.params.id);
    try {
      await mkdirNasFolderForCodigo(resolveStorageRootAbsolute(), cat.codigo);
    } catch (e) {
      console.warn('Recrear carpeta NAS al reactivar categoría:', e);
    }
    res.json({ success: true, message: 'Categoría reactivada' });
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

// ========== AUDITORÍA (archivos) ==========
router.get('/audit/files/export', auditoriaArchivosMw, async (req, res, next) => {
  try {
    const accion =
      typeof req.query.accion === 'string' ? req.query.accion : undefined;
    const buscar =
      typeof req.query.buscar === 'string' ? req.query.buscar : undefined;

    const useCase = new ExportAuditFilesXlsxUseCase(auditoriaRepository);
    const { buffer, filename } = await useCase.execute({ accion, buscar });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/audit/files', auditoriaArchivosMw, async (req, res, next) => {
  try {
    const pageRaw = Number.parseInt(String(req.query.page || '1'), 10);
    const limitRaw = Number.parseInt(String(req.query.limit || '50'), 10);
    const accion =
      typeof req.query.accion === 'string' ? req.query.accion : undefined;
    const buscar =
      typeof req.query.buscar === 'string' ? req.query.buscar : undefined;

    const useCase = new ListFileAuditLogsUseCase(auditoriaRepository);
    const resultado = await useCase.execute({
      page: Number.isFinite(pageRaw) ? pageRaw : 1,
      limit: Number.isFinite(limitRaw) ? limitRaw : 50,
      accion,
      buscar,
    });

    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
});

export default router;

