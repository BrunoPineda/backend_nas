import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/AppError';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  // PostgreSQL: 23503 | SQL Server: 547 (foreign key)
  const pgCode = (err as any).code;
  const sqlNumber = (err as any).number ?? (err as any).originalError?.info?.number;
  if (pgCode === '23503' || sqlNumber === 547) {
    const detail = String((err as any).detail || (err as any).message || '');
    if (detail.includes('id_usuario') || detail.includes('usuario')) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado. Por favor, inicia sesión nuevamente',
        code: 'USER_NOT_FOUND'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Error de validación: Referencia inválida',
      code: 'FOREIGN_KEY_VIOLATION'
    });
  }

  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
};

