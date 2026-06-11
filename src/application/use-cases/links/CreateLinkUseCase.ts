import { IEnlaceRepository } from '../../../domain/repositories/IEnlaceRepository';
import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { Enlace } from '../../../domain/entities/Enlace';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/AppError';

export interface CreateLinkRequest {
  fileId: string;
  tipo: 'permanent' | 'temporary';
  expiresAt?: Date;
  maxVisits?: number;
}

export class CreateLinkUseCase {
  constructor(
    private enlaceRepository: IEnlaceRepository,
    private archivoRepository: IArchivoRepository
  ) {}

  async execute(request: CreateLinkRequest, idUsuario: string): Promise<Enlace> {
    const archivo = await this.archivoRepository.findById(request.fileId);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }

    if (archivo.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para crear enlaces de este archivo');
    }

    // Validar parámetros para enlaces temporales
    if (request.tipo === 'temporary') {
      if (!request.expiresAt && !request.maxVisits) {
        throw new ValidationError('Los enlaces temporales deben tener fecha de expiración o máximo de visitas');
      }

      if (request.expiresAt && request.expiresAt <= new Date()) {
        throw new ValidationError('La fecha de expiración debe ser futura');
      }

      if (request.maxVisits && request.maxVisits <= 0) {
        throw new ValidationError('El máximo de visitas debe ser mayor a 0');
      }
    }

    // Generar token seguro
    const token = this.generarTokenSeguro();

    const enlace = new Enlace(
      uuidv4(),
      request.fileId,
      token,
      request.tipo === 'temporary',
      request.expiresAt || null,
      request.maxVisits || null,
      0,
      null,
      true,
      new Date(),
      idUsuario
    );

    return await this.enlaceRepository.save(enlace);
  }

  private generarTokenSeguro(): string {
    const randomBytes = Math.random().toString(36) + Date.now().toString(36);
    const hash = createHash('sha256')
      .update(randomBytes + uuidv4())
      .digest('hex')
      .substring(0, 32);
    return hash;
  }
}

