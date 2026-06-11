import { IEnlaceRepository } from '../../../../domain/repositories/IEnlaceRepository';
import { Enlace } from '../../../../domain/entities/Enlace';
import { query } from '../connection';
import { r } from '../column';

export class EnlaceRepository implements IEnlaceRepository {
  private mapRowToEnlace(row: Record<string, unknown>): Enlace {
    return new Enlace(
      String(r(row, 'ID_ENLACE', 'id')),
      String(r(row, 'ID_ARCHIVO', 'id_archivo')),
      String(r(row, 'CO_TOKEN', 'token')),
      Boolean(r(row, 'IN_ES_TEMPORAL', 'es_temporal')),
      (r(row, 'FE_EXPIRACION', 'fecha_expiracion') as Date) ?? null,
      (r(row, 'CA_MAX_VISITAS', 'max_visitas') as number) ?? null,
      Number(r(row, 'CA_VISITAS', 'visitas_actuales') ?? 0),
      (r(row, 'FE_ULTIMA_VISITA', 'fecha_ultima_visita') as Date) ?? null,
      Boolean(r(row, 'ES_VIGENTE', 'activo')),
      r(row, 'FE_CREACION', 'created_at') as Date,
      (r(row, 'ID_USUARIO_CREADOR', 'created_by') as string) ?? null
    );
  }

  async save(enlace: Enlace): Promise<Enlace> {
    await query(
      `INSERT INTO dbo.NASTM_ENLACES (
        ID_ENLACE, ID_ARCHIVO, CO_TOKEN, IN_ES_TEMPORAL, FE_EXPIRACION,
        CA_MAX_VISITAS, CA_VISITAS, ES_VIGENTE, FE_CREACION, ID_USUARIO_CREADOR
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        enlace.id,
        enlace.idArchivo,
        enlace.token,
        enlace.esTemporal,
        enlace.fechaExpiracion,
        enlace.maxVisitas,
        enlace.visitasActuales,
        enlace.activo,
        enlace.createdAt,
        enlace.createdBy,
      ]
    );
    const result = await query('SELECT * FROM dbo.NASTM_ENLACES WHERE ID_ENLACE = $1', [enlace.id]);
    return this.mapRowToEnlace(result.rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<Enlace | null> {
    const result = await query('SELECT * FROM dbo.NASTM_ENLACES WHERE ID_ENLACE = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToEnlace(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByToken(token: string): Promise<Enlace | null> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_ENLACES WHERE CO_TOKEN = $1 AND ES_VIGENTE = 1',
      [token]
    );
    return result.rows.length > 0 ? this.mapRowToEnlace(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByArchivo(idArchivo: string): Promise<Enlace[]> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_ENLACES WHERE ID_ARCHIVO = $1 ORDER BY FE_CREACION DESC',
      [idArchivo]
    );
    return result.rows.map((row) => this.mapRowToEnlace(row as Record<string, unknown>));
  }

  async findByUsuario(idUsuario: string): Promise<Enlace[]> {
    const result = await query(
      `SELECT e.* FROM dbo.NASTM_ENLACES e
       INNER JOIN dbo.NASTM_ARCHIVOS a ON e.ID_ARCHIVO = a.ID_ARCHIVO
       WHERE a.ID_USUARIO = $1
       ORDER BY e.FE_CREACION DESC`,
      [idUsuario]
    );
    return result.rows.map((row) => this.mapRowToEnlace(row as Record<string, unknown>));
  }

  async update(enlace: Enlace): Promise<Enlace> {
    await query(
      `UPDATE dbo.NASTM_ENLACES SET
        FE_EXPIRACION = $2,
        CA_MAX_VISITAS = $3,
        CA_VISITAS = $4,
        FE_ULTIMA_VISITA = $5,
        ES_VIGENTE = $6
      WHERE ID_ENLACE = $1`,
      [
        enlace.id,
        enlace.fechaExpiracion,
        enlace.maxVisitas,
        enlace.visitasActuales,
        enlace.fechaUltimaVisita,
        enlace.activo,
      ]
    );
    const result = await query('SELECT * FROM dbo.NASTM_ENLACES WHERE ID_ENLACE = $1', [enlace.id]);
    return this.mapRowToEnlace(result.rows[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE dbo.NASTM_ENLACES SET ES_VIGENTE = 0 WHERE ID_ENLACE = $1', [id]);
  }

  async incrementarVisita(id: string): Promise<void> {
    await query(
      `UPDATE dbo.NASTM_ENLACES SET
        CA_VISITAS = CA_VISITAS + 1,
        FE_ULTIMA_VISITA = SYSUTCDATETIME()
      WHERE ID_ENLACE = $1`,
      [id]
    );
  }
}
