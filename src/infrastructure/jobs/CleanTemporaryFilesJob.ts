import cron from 'node-cron';
import { IArchivoRepository } from '../../domain/repositories/IArchivoRepository';
import { IStorageService } from '../storage/IStorageService';
import { Archivo } from '../../domain/entities/Archivo';

export class CleanTemporaryFilesJob {
  constructor(
    private archivoRepository: IArchivoRepository,
    private tempStorageService: IStorageService,
    private permanentStorageService: IStorageService
  ) {}

  /** Tiempo en disco temporal antes de mover a STORAGE_ROOT_PATH (TEMP_FILE_TTL_MINUTES en .env). */
  private ttlMs(): number {
    const raw = parseInt(process.env.TEMP_FILE_TTL_MINUTES || '1', 10);
    const minutes = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return minutes * 60 * 1000;
  }

  start(): void {
    // Ejecutar cada minuto
    cron.schedule('* * * * *', async () => {
      await this.cleanExpiredTemporaryFiles();
    });
  }

  private async cleanExpiredTemporaryFiles(): Promise<void> {
    const archivosTemporales = await this.archivoRepository.findTemporaryFiles();
    
    for (const archivo of archivosTemporales) {
      const ahora = new Date();
      const tiempoTranscurrido = ahora.getTime() - archivo.createdAt.getTime();

      if (tiempoTranscurrido > this.ttlMs()) {
        try {
          // Leer del temporal
          const contenido = await this.tempStorageService.getFile('', archivo.nombreFisico);
          
          // Guardar en almacenamiento permanente
          await this.permanentStorageService.saveFile(
            archivo.rutaFisica,
            archivo.nombreFisico,
            contenido
          );

          for (const dirEsp of archivo.rutasEspejo ?? []) {
            await this.permanentStorageService.saveFile(dirEsp, archivo.nombreFisico, contenido);
          }

          await this.tempStorageService.deleteFile('', archivo.nombreFisico);

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
            false, // enTemporal
            null, // rutaTemporal
            archivo.createdAt,
            new Date(),
            archivo.lastDownloadAt,
            archivo.rutasEspejo,
            archivo.esPermanente,
            archivo.fechaInicioVigencia,
            archivo.fechaFinVigencia,
            archivo.deletedAt
          );
          
          await this.archivoRepository.update(archivoActualizado);
          
          console.log(`Archivo ${archivo.id} movido a almacenamiento permanente`);
        } catch (error) {
          console.error(`Error moviendo archivo ${archivo.id}:`, error);
        }
      }
    }
  }
}

