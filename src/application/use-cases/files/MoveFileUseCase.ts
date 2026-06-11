import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { Archivo } from '../../../domain/entities/Archivo';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';

export class MoveFileUseCase {
  constructor(
    private archivoRepository: IArchivoRepository,
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idArchivo: string, nuevoIdCarpeta: string | null, idUsuario: string): Promise<Archivo> {
    const archivo = await this.archivoRepository.findById(idArchivo);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }

    if (archivo.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para mover este archivo');
    }

    // Si se mueve a una carpeta, verificar que existe y pertenece al usuario
    if (nuevoIdCarpeta) {
      const carpeta = await this.carpetaRepository.findById(nuevoIdCarpeta);
      if (!carpeta || carpeta.idUsuario !== idUsuario) {
        throw new NotFoundError('La carpeta destino no existe o no tienes permisos');
      }
    }

    const archivoActualizado = new Archivo(
      archivo.id,
      archivo.idUsuario,
      nuevoIdCarpeta,
      archivo.nombreOriginal,
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

