import path from 'path';
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

    const trimmed = nuevoNombre.trim();
    const extOrigen = path.extname(archivo.nombreOriginal);
    const extNuevo = path.extname(trimmed);
    if (extOrigen.toLowerCase() !== extNuevo.toLowerCase()) {
      throw new ValidationError(
        extOrigen === ''
          ? 'Este archivo no tiene extensión: no puede añadirse una nueva extensión al renombrar'
          : 'No está permitido cambiar la extensión del archivo; solo puedes editar el nombre'
      );
    }

    const archivoActualizado = new Archivo(
      archivo.id,
      archivo.idUsuario,
      archivo.idCarpeta,
      trimmed,
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
      archivo.rutasEspejo,
      archivo.esPermanente,
      archivo.fechaInicioVigencia,
      archivo.fechaFinVigencia,
      archivo.deletedAt
    );

    return await this.archivoRepository.update(archivoActualizado);
  }
}

