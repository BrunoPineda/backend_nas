import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { Archivo } from '../../../domain/entities/Archivo';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/AppError';

export class RenameFileUseCase {
  constructor(
    private archivoRepository: IArchivoRepository
  ) {}

  async execute(idArchivo: string, nuevoNombre: string, idUsuario: string): Promise<Archivo> {
    if (!nuevoNombre || nuevoNombre.trim().length === 0) {
      throw new ValidationError('El nombre del archivo es requerido');
    }

    const archivo = await this.archivoRepository.findById(idArchivo);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }

    if (archivo.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para renombrar este archivo');
    }

    const archivoActualizado = new Archivo(
      archivo.id,
      archivo.idUsuario,
      archivo.idCarpeta,
      nuevoNombre.trim(),
      archivo.nombreFisico,
      archivo.rutaFisica,
      archivo.mimeType,
      archivo.tamanoBytes,
      archivo.hashSha256,
      archivo.enTemporal,
      archivo.rutaTemporal,
      archivo.createdAt,
      new Date(),
      archivo.lastDownloadAt,
      archivo.deletedAt
    );

    return await this.archivoRepository.update(archivoActualizado);
  }
}

