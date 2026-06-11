import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/AppError';

export class DeleteFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idCarpeta: string, idUsuario: string, forzar: boolean = false): Promise<void> {
    const carpeta = await this.carpetaRepository.findById(idCarpeta);
    if (!carpeta) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    if (carpeta.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para eliminar esta carpeta');
    }

    // Verificar si tiene archivos
    const cantidadArchivos = await this.carpetaRepository.countArchivos(idCarpeta);
    if (cantidadArchivos > 0 && !forzar) {
      throw new ValidationError(`La carpeta contiene ${cantidadArchivos} archivo(s). Debes eliminarlos primero o usar la opción de forzar eliminación.`);
    }

    await this.carpetaRepository.delete(idCarpeta);
  }
}

