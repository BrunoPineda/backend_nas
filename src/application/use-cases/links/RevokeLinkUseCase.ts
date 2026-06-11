import { IEnlaceRepository } from '../../../domain/repositories/IEnlaceRepository';
import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';

export class RevokeLinkUseCase {
  constructor(
    private enlaceRepository: IEnlaceRepository,
    private archivoRepository: IArchivoRepository
  ) {}

  async execute(idEnlace: string, idUsuario: string): Promise<void> {
    const enlace = await this.enlaceRepository.findById(idEnlace);
    if (!enlace) {
      throw new NotFoundError('Enlace no encontrado');
    }

    const archivo = await this.archivoRepository.findById(enlace.idArchivo);
    if (!archivo || archivo.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para revocar este enlace');
    }

    await this.enlaceRepository.delete(idEnlace);
  }
}

