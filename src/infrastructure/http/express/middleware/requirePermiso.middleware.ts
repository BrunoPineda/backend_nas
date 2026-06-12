import { Response, NextFunction, RequestHandler } from 'express';
import { IRolRepository } from '../../../../domain/repositories/IRolRepository';
import { ForbiddenError, UnauthorizedError } from '../../../../shared/errors/AppError';

/**
 * Requiere que el usuario tenga el permiso (CO_PERMISO) en su rol según BD.
 */
export function requirePermisoCodigoMiddleware(
  rolRepository: IRolRepository,
  codigoPermiso: string
): RequestHandler {
  return async (req, _res: Response, next: NextFunction) => {
    try {
      const userId = (req as { user?: { userId: string } }).user?.userId;
      if (!userId) {
        throw new UnauthorizedError('No autorizado');
      }
      const ok = await rolRepository.usuarioTieneCodigoPermiso(userId, codigoPermiso);
      if (!ok) {
        throw new ForbiddenError('No tienes permiso para esta operación');
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
