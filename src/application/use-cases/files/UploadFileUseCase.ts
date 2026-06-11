import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { IStorageService } from '../../../infrastructure/storage/IStorageService';
import { Archivo } from '../../../domain/entities/Archivo';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import path from 'path';
import { FileValidator } from '../../../infrastructure/file-processing/FileValidator';

export class UploadFileUseCase {
  private fileValidator: FileValidator;

  constructor(
    private archivoRepository: IArchivoRepository,
    private tempStorageService: IStorageService,
    private permanentStorageService: IStorageService,
    maxFileSize: number,
    allowedMimeTypes: string[]
  ) {
    this.fileValidator = new FileValidator(maxFileSize, allowedMimeTypes);
  }

  async execute(
    file: Express.Multer.File,
    idUsuario: string,
    idCarpeta: string | null
  ): Promise<Archivo> {
    // 1. Validar archivo
    this.fileValidator.validate(file);

    // 2. Generar metadatos
    const fecha = new Date();
    const rutaFisica = this.generarRutaPorFecha(fecha);
    const nombreFisico = this.generarNombreCifrado(file.originalname);
    const hashSha256 = this.calcularHash(file.buffer);

    // 3. Guardar en temporal primero
    const rutaTemporal = await this.tempStorageService.saveFile(
      '',
      nombreFisico,
      file.buffer
    );

    // 4. Crear registro en BD
    const archivo = new Archivo(
      uuidv4(),
      idUsuario,
      idCarpeta,
      file.originalname,
      nombreFisico,
      rutaFisica,
      file.mimetype,
      file.size,
      hashSha256,
      true, // enTemporal
      rutaTemporal,
      fecha,
      fecha,
      null,
      null
    );

    const archivoGuardado = await this.archivoRepository.save(archivo);

    return archivoGuardado;
  }

  private generarRutaPorFecha(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}/${mes}/${dia}`;
  }

  private generarNombreCifrado(nombreOriginal: string): string {
    const extension = path.extname(nombreOriginal);
    const hash = createHash('sha256')
      .update(nombreOriginal + Date.now() + Math.random().toString())
      .digest('hex')
      .substring(0, 32);
    return `${hash}${extension}`;
  }

  private calcularHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

