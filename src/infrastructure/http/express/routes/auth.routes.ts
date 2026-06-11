import { Router } from 'express';
import dotenv from 'dotenv';
import { LoginUseCase } from '../../../../application/use-cases/auth/LoginUseCase';
import { UsuarioRepository } from '../../../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import { RolRepository } from '../../../../infrastructure/database/sqlserver/repositories/RolRepository';
import { PasswordService } from '../../../../infrastructure/security/PasswordService';
import { JwtService } from '../../../../infrastructure/security/JwtService';
import { errorMiddleware } from '../middleware/error.middleware';

dotenv.config();

const router = Router();

// Inicializar servicios
const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();
const passwordService = new PasswordService();
const jwtService = new JwtService(
  process.env.JWT_SECRET || 'default-secret-change-in-production',
  process.env.JWT_EXPIRES_IN || '1h',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  process.env.JWT_REFRESH_EXPIRES_IN || '7d'
);

const loginUseCase = new LoginUseCase(usuarioRepository, rolRepository, passwordService, jwtService);

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    const result = await loginUseCase.execute({ email, password });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Health check para auth
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

export default router;

