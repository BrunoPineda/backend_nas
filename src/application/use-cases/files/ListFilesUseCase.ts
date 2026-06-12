import type { ArchivosListadoVigencia, IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { Archivo } from '../../../domain/entities/Archivo';
import { ForbiddenError } from '../../../shared/errors/AppError';

export class ListFilesUseCase {
  constructor(
    private archivoRepository: IArchivoRepository,
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(
    idUsuario: string,
    folderId?: string | null,
    vigencia: ArchivosListadoVigencia = 'activos',
    isAdmin = false
  ): Promise<Archivo[]> {
    if (folderId === undefined) {
      return await this.archivoRepository.findVisiblesParaUsuario(
        idUsuario,
        isAdmin,
        undefined,
        vigencia
      );
    }
    if (folderId === null) {
      // Raíz: propios + de la misma unidad (categoría compartida), salvo propietarios privados.
      return await this.archivoRepository.findVisiblesParaUsuario(
        idUsuario,
        isAdmin,
        null,
        vigencia
      );
    }

    const carpeta = await this.carpetaRepository.findById(folderId);
    if (!carpeta) {
      return [];
    }

    if (carpeta.idUsuario === idUsuario) {
      return await this.archivoRepository.findByUsuario(idUsuario, folderId, vigencia);
    }

    const puede = await this.carpetaRepository.usuarioPuedeAccederACarpeta(idUsuario, folderId);
    if (!puede) {
      throw new ForbiddenError('No tienes acceso a esta carpeta');
    }

    return await this.archivoRepository.findByCarpetaYUsuarioPropietario(
      folderId,
      carpeta.idUsuario,
      vigencia
    );
  }
}

