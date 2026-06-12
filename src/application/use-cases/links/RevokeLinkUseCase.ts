import { IEnlaceRepository } from '../../../domain/repositories/IEnlaceRepository';
import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';
import { usuarioPuedeGestionarEnlacesDeArchivo } from '../../services/ArchivoEnlaceAccessService';

export class RevokeLinkUseCase {
  constructor(
    private enlaceRepository: IEnlaceRepository,
    private archivoRepository: IArchivoRepository,
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idEnlace: string, idUsuario: string, opts?: { isAdmin?: boolean }): Promise<void> {
    const enlace = await this.enlaceRepository.findById(idEnlace);
    if (!enlace) {
      throw new NotFoundError('Enlace no encontrado');
    }

    const archivo = await this.archivoRepository.findById(enlace.idArchivo);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }

    const puede = await usuarioPuedeGestionarEnlacesDeArchivo(
      idUsuario,
      archivo,
      Boolean(opts?.isAdmin),
      this.carpetaRepository,
      this.archivoRepository
    );
    if (!puede) {
      throw new ForbiddenError('No tienes permisos para revocar este enlace');
    }

    await this.enlaceRepository.delete(idEnlace);
  }
}
