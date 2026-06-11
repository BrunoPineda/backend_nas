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
      
      // Si pasó más de 1 minuto
      if (tiempoTranscurrido > 60000) {
        try {
          // Leer del temporal
          const contenido = await this.tempStorageService.getFile('', archivo.nombreFisico);
          
          // Guardar en almacenamiento permanente
          await this.permanentStorageService.saveFile(
            archivo.rutaFisica,
            archivo.nombreFisico,
            contenido
          );
          
          // Eliminar del temporal
          await this.tempStorageService.deleteFile('', archivo.nombreFisico);
          
          // Actualizar en BD
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
            new Date(), // updatedAt
            archivo.lastDownloadAt,
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

