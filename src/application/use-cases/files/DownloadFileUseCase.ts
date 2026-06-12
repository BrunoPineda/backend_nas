import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { IStorageService } from '../../../infrastructure/storage/IStorageService';
import { NotFoundError } from '../../../shared/errors/AppError';
import { Archivo } from '../../../domain/entities/Archivo';

export class DownloadFileUseCase {
  constructor(
    private archivoRepository: IArchivoRepository,
    private carpetaRepository: ICarpetaRepository,
    private tempStorageService: IStorageService,
    private permanentStorageService: IStorageService
  ) {}

  async execute(idArchivo: string, idUsuario: string): Promise<{
    buffer: Buffer;
    nombreOriginal: string;
    mimeType: string;
  }> {
    const archivo = await this.archivoRepository.findById(idArchivo);

    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }

    if (archivo.idUsuario !== idUsuario) {
      if (!archivo.idCarpeta) {
        throw new NotFoundError('Archivo no encontrado');
      }
      const puede = await this.carpetaRepository.usuarioPuedeAccederACarpeta(idUsuario, archivo.idCarpeta);
      if (!puede) {
        throw new NotFoundError('Archivo no encontrado');
      }
    }

    if (!archivo.esPermanente && !archivo.estaEnVentanaVigencia()) {
      throw new NotFoundError('Archivo no disponible (fuera del periodo de vigencia)');
    }

    let buffer: Buffer;

    // Si está en temporal, leer de ahí
    if (archivo.enTemporal && archivo.rutaTemporal) {
      try {
        buffer = await this.tempStorageService.getFile('', archivo.nombreFisico);
      } catch (error) {
        // Si no está en temporal, intentar leer del almacenamiento permanente
        buffer = await this.permanentStorageService.getFile(
          archivo.rutaFisica,
          archivo.nombreFisico
        );
      }
    } else {
      // Leer del almacenamiento permanente
      buffer = await this.permanentStorageService.getFile(
        archivo.rutaFisica,
        archivo.nombreFisico
      );
    }

    // Actualizar fecha de última descarga
    const archivoActualizado = new Archivo(
      archivo.id,
      archivo.idUsuario,
      archivo.idCarpeta,
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
      new Date(),
      archivo.rutasEspejo,
      archivo.esPermanente,
      archivo.fechaInicioVigencia,
      archivo.fechaFinVigencia,
      archivo.deletedAt
    );
    await this.archivoRepository.update(archivoActualizado);

    return {
      buffer,
      nombreOriginal: archivo.nombreOriginal,
      mimeType: archivo.mimeType
    };
  }
}

