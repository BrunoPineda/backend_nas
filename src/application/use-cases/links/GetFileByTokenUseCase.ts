import { IEnlaceRepository } from '../../../domain/repositories/IEnlaceRepository';
import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { IStorageService } from '../../../infrastructure/storage/IStorageService';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetFileByTokenUseCase {
  constructor(
    private enlaceRepository: IEnlaceRepository,
    private archivoRepository: IArchivoRepository,
    private tempStorageService: IStorageService,
    private permanentStorageService: IStorageService
  ) {}

  async execute(token: string): Promise<{
    buffer: Buffer;
    nombreOriginal: string;
    mimeType: string;
    esImagen: boolean;
    esVideo: boolean;
    esPdf: boolean;
    esAudio: boolean;
  }> {
    const enlace = await this.enlaceRepository.findByToken(token);
    if (!enlace) {
      throw new NotFoundError('Enlace no encontrado');
    }

    // Verificar si está expirado
    if (enlace.estaExpirado()) {
      throw new NotFoundError('Este enlace ha expirado');
    }

    const archivo = await this.archivoRepository.findById(enlace.idArchivo);
    if (!archivo || archivo.estaEliminado()) {
      throw new NotFoundError('Archivo no encontrado');
    }

    if (!archivo.esPermanente && !archivo.estaEnVentanaVigencia()) {
      throw new NotFoundError('Este enlace ya no está disponible (periodo de vigencia finalizado o aún no iniciado)');
    }

    // Incrementar contador de visitas
    await this.enlaceRepository.incrementarVisita(enlace.id);

    // Obtener el archivo del almacenamiento
    let buffer: Buffer;
    if (archivo.enTemporal && archivo.rutaTemporal) {
      try {
        buffer = await this.tempStorageService.getFile('', archivo.nombreFisico);
      } catch {
        buffer = await this.permanentStorageService.getFile(
          archivo.rutaFisica,
          archivo.nombreFisico
        );
      }
    } else {
      buffer = await this.permanentStorageService.getFile(
        archivo.rutaFisica,
        archivo.nombreFisico
      );
    }

    const esImagen = archivo.mimeType.startsWith('image/');
    const esVideo = archivo.mimeType.startsWith('video/');
    const mt = archivo.mimeType.toLowerCase();
    const nombreLower = archivo.nombreOriginal.toLowerCase();
    const esPdf =
      mt === 'application/pdf' ||
      mt === 'application/x-pdf' ||
      nombreLower.endsWith('.pdf');
    const esAudio =
      archivo.mimeType.startsWith('audio/') ||
      /\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(archivo.nombreOriginal);

    return {
      buffer,
      nombreOriginal: archivo.nombreOriginal,
      mimeType: archivo.mimeType,
      esImagen,
      esVideo,
      esPdf,
      esAudio
    };
  }
}

