import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtService } from '../../../security/JwtService';
import { UnauthorizedError, ForbiddenError } from '../../../../shared/errors/AppError';
import { UsuarioRepository } from '../../../database/sqlserver/repositories/UsuarioRepository';
import { IntranetAuthRepository } from '../../../database/sqlserver/repositories/IntranetAuthRepository';
import { IntranetPermissionService } from '../../../../application/services/IntranetPermissionService';
import { syncIntranetUserCategories } from '../../../../application/services/IntranetUserCategorySync';
import { useIntranetUserDatabase } from '../../../database/sqlserver/connection';
import type { JwtPayload } from '../../../../shared/types';
import { MSG_USUARIO_SIN_ROL_NAS, tieneRolNasModulo } from '../../../../shared/constants/nasRoles';

const usuarioRepository = new UsuarioRepository();
const intranetAuth = new IntranetAuthRepository();
const intranetPerm = new IntranetPermissionService();

export const authMiddleware = (jwtService: JwtService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Token no proporcionado');
      }

      const token = authHeader.substring(7);
      const payload = jwtService.verifyToken(token);

      if (useIntranetUserDatabase() && payload.codUsuario) {
        await attachIntranetUser(req, payload);
      } else {
        await attachLocalUser(payload);
        (req as Request & { user: JwtPayload }).user = payload;
      }

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        next(error);
      } else if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError
      ) {
        next(new UnauthorizedError('Token inválido o expirado'));
      } else {
        next(error);
      }
    }
  };
};

async function attachIntranetUser(req: Request, payload: JwtPayload): Promise<void> {
  const intranet = await intranetAuth.findByCodUsuario(payload.codUsuario!);
  if (!intranet || !intranet.bEstado) {
    throw new UnauthorizedError('Usuario no encontrado o inactivo en Intranet');
  }

  const rolesNas = await intranetAuth.listRolesNasActivos(intranet.codUsuario);
  if (!tieneRolNasModulo(rolesNas)) {
    throw new ForbiddenError(MSG_USUARIO_SIN_ROL_NAS);
  }

  const permisos = await intranetPerm.listCodigosPermisoByCodUsuario(intranet.codUsuario);
  const rol = await intranetPerm.jwtRolLabel(intranet.codUsuario);

  const local = await usuarioRepository.findById(payload.userId);
  if (!local || !local.activo) {
    throw new UnauthorizedError('Perfil NAS no disponible. Iniciá sesión nuevamente.');
  }

  const categorias = await syncIntranetUserCategories(intranet.codUsuario, local.id);

  (req as Request & { user: JwtPayload }).user = {
    ...payload,
    rol,
    permisos,
    categorias,
    useIntranet: true,
  };
}

async function attachLocalUser(payload: JwtPayload): Promise<void> {
  const usuario = await usuarioRepository.findById(payload.userId);
  if (!usuario) {
    throw new UnauthorizedError('Usuario no encontrado. Por favor, inicia sesión nuevamente');
  }

  if (!usuario.activo) {
    throw new UnauthorizedError('Tu cuenta ha sido desactivada. Contacta al administrador');
  }
}
