import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../../../security/JwtService';
import { UnauthorizedError } from '../../../../shared/errors/AppError';
import { UsuarioRepository } from '../../../database/sqlserver/repositories/UsuarioRepository';

const usuarioRepository = new UsuarioRepository();

export const authMiddleware = (jwtService: JwtService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Token no proporcionado');
      }

      const token = authHeader.substring(7);
      const payload = jwtService.verifyToken(token);
      
      // Validar que el usuario existe y está activo
      const usuario = await usuarioRepository.findById(payload.userId);
      if (!usuario) {
        throw new UnauthorizedError('Usuario no encontrado. Por favor, inicia sesión nuevamente');
      }
      
      if (!usuario.activo) {
        throw new UnauthorizedError('Tu cuenta ha sido desactivada. Contacta al administrador');
      }
      
      (req as any).user = payload;
      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        next(error);
      } else {
        next(new UnauthorizedError('Token inválido o expirado'));
      }
    }
  };
};

