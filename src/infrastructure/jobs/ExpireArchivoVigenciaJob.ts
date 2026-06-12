import cron from 'node-cron';
import { IArchivoRepository } from '../../domain/repositories/IArchivoRepository';

/** Inactiva archivos cuya FE_FIN_VIGENCIA ya pasó (solo no permanentes). */
export class ExpireArchivoVigenciaJob {
  constructor(private archivoRepository: IArchivoRepository) {}

  start(): void {
    cron.schedule('* * * * *', async () => {
      await this.inactivarVencidos();
    });
  }

  private async inactivarVencidos(): Promise<void> {
    const ids = await this.archivoRepository.findIdsVigenciaVencida();
    for (const id of ids) {
      try {
        await this.archivoRepository.delete(id);
        console.log(`[Vigencia] Archivo ${id} inactivado automáticamente (fin de vigencia)`);
      } catch (e) {
        console.error(`[Vigencia] Error inactivando archivo ${id}:`, e);
      }
    }
  }
}
