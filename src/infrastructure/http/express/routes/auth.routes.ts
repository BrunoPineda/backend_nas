import { Router } from 'express';
import dotenv from 'dotenv';
import { LoginUseCase } from '../../../../application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../../../application/use-cases/auth/RefreshTokenUseCase';
import { SyncExternalUserUseCase } from '../../../../application/use-cases/auth/SyncExternalUserUseCase';
import { UsuarioRepository } from '../../../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import { RolRepository } from '../../../../infrastructure/database/sqlserver/repositories/RolRepository';
import { CategoriaRepository } from '../../../../infrastructure/database/sqlserver/repositories/CategoriaRepository';
import { PasswordService } from '../../../../infrastructure/security/PasswordService';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { authMiddleware } from '../middleware/auth.middleware';
import { errorMiddleware } from '../middleware/error.middleware';
import { useIntranetUserDatabase } from '../../../database/sqlserver/connection';
import { decryptNasSsoCoduser, isValidNasSsoFlag } from '../../../security/nasSsoCrypto';

dotenv.config();

const router = Router();

// Inicializar servicios
const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();
const categoriaRepository = new CategoriaRepository();
const passwordService = new PasswordService();
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const loginUseCase = new LoginUseCase(
  usuarioRepository,
  rolRepository,
  categoriaRepository,
  passwordService,
  jwtService
);
const syncExternalUserUseCase = new SyncExternalUserUseCase(
  usuarioRepository,
  rolRepository,
  categoriaRepository,
  passwordService,
  jwtService
);
const refreshTokenUseCase = new RefreshTokenUseCase(
  usuarioRepository,
  rolRepository,
  jwtService
);

// Login
router.post('/login', async (req, res, next) => {
  try {
    const documento = String(req.body.documento ?? req.body.email ?? req.body.dni ?? '').trim();
    const { password } = req.body;

    if (!documento || !password) {
      return res.status(400).json({
        success: false,
        error: 'Documento y contraseña son requeridos'
      });
    }

    const result = await loginUseCase.execute({ documento, password });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Renovar access token (sin volver a pedir contraseña)
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = String(req.body.refreshToken ?? '').trim();
    const result = await refreshTokenUseCase.execute(refreshToken);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Sync External User (ConectaJuntos SSO)
// POST /auth/sync-external-user
// Body SSO intranet: { dniEncrypted } + header X-NAS-SSO-Flag · legacy: { dni, username, email, ... }
router.post('/sync-external-user', async (req, res, next) => {
  try {
    const {
      dni,
      dniEncrypted,
      username,
      email,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      telefono,
      rolNombreExterno,
    } = req.body;

    const intranetMode = useIntranetUserDatabase();
    let resolvedDni = typeof dni === 'string' ? dni.trim() : '';

    if (dniEncrypted) {
      const flag = req.get('X-NAS-SSO-Flag')?.trim();
      if (!isValidNasSsoFlag(flag)) {
        return res.status(401).json({
          success: false,
          error: 'Flag SSO inválido o ausente',
        });
      }
      try {
        resolvedDni = decryptNasSsoCoduser(String(dniEncrypted).trim());
      } catch {
        return res.status(400).json({
          success: false,
          error: 'DNI cifrado inválido',
        });
      }
    }

    if (!resolvedDni) {
      return res.status(400).json({
        success: false,
        error: 'dni es requerido',
      });
    }
    if (!intranetMode && (!email || !username)) {
      return res.status(400).json({
        success: false,
        error: 'dni, email y username son requeridos',
      });
    }

    const result = await syncExternalUserUseCase.execute({
      dni: resolvedDni,
      username: username || resolvedDni,
      email: email || '',
      nombre: nombre || username || resolvedDni,
      apellidoPaterno: apellidoPaterno || '',
      apellidoMaterno: apellidoMaterno || '',
      telefono,
      rolNombreExterno,
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Permisos del usuario autenticado (códigos CO_PERMISO)
router.get('/my-permissions', authMiddleware(jwtService), async (req, res, next) => {
  try {
    const user = (req as { user?: { userId?: string; permisos?: string[] } }).user;
    const permisos =
      user?.permisos != null
        ? user.permisos
        : await rolRepository.listCodigosPermisoByUsuario(user!.userId!);
    res.json({ success: true, data: permisos });
  } catch (error) {
    next(error);
  }
});

// Health check para auth
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

export default router;
