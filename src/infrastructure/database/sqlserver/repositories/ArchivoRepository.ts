import { IArchivoRepository } from '../../../../domain/repositories/IArchivoRepository';
import { Archivo } from '../../../../domain/entities/Archivo';
import { query } from '../connection';
import { r } from '../column';

export class ArchivoRepository implements IArchivoRepository {
  private mapRowToArchivo(row: Record<string, unknown>): Archivo {
    return new Archivo(
      String(r(row, 'ID_ARCHIVO', 'id')),
      String(r(row, 'ID_USUARIO', 'id_usuario')),
      (r(row, 'ID_CARPETA', 'id_carpeta') as string) ?? null,
      String(r(row, 'NO_ARCHIVO_ORIGINAL', 'nombre_original')),
      String(r(row, 'NO_ARCHIVO_FISICO', 'nombre_fisico')),
      String(r(row, 'DE_RUTA_FISICA', 'ruta_fisica')),
      String(r(row, 'TI_MIME', 'mime_type')),
      parseInt(String(r(row, 'CA_TAMANO_BYTES', 'tamano_bytes')), 10),
      (r(row, 'CO_HASH_SHA256', 'hash_sha256') as string) ?? null,
      Boolean(r(row, 'IN_EN_TEMPORAL', 'en_temporal')),
      (r(row, 'DE_RUTA_TEMPORAL', 'ruta_temporal') as string) ?? null,
      r(row, 'FE_CREACION', 'created_at') as Date,
      r(row, 'FE_ACTUALIZACION', 'updated_at') as Date,
      (r(row, 'FE_ULTIMA_DESCARGA', 'last_download_at') as Date) ?? null,
      (r(row, 'FE_BAJA', 'deleted_at') as Date) ?? null
    );
  }

  async save(archivo: Archivo): Promise<Archivo> {
    await query(
      `INSERT INTO dbo.NASTM_ARCHIVOS (
        ID_ARCHIVO, ID_USUARIO, ID_CARPETA, NO_ARCHIVO_ORIGINAL, NO_ARCHIVO_FISICO,
        DE_RUTA_FISICA, TI_MIME, CA_TAMANO_BYTES, CO_HASH_SHA256, IN_EN_TEMPORAL,
        DE_RUTA_TEMPORAL, FE_CREACION, FE_ACTUALIZACION
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
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
        archivo.updatedAt,
      ]
    );
    const result = await query('SELECT * FROM dbo.NASTM_ARCHIVOS WHERE ID_ARCHIVO = $1', [archivo.id]);
    return this.mapRowToArchivo(result.rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<Archivo | null> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_ARCHIVOS WHERE ID_ARCHIVO = $1 AND FE_BAJA IS NULL',
      [id]
    );
    return result.rows.length > 0 ? this.mapRowToArchivo(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByUsuario(idUsuario: string, folderId?: string | null): Promise<Archivo[]> {
    let sql = 'SELECT * FROM dbo.NASTM_ARCHIVOS WHERE ID_USUARIO = $1 AND FE_BAJA IS NULL';
    const params: unknown[] = [idUsuario];

    if (folderId !== undefined) {
      if (folderId === null) {
        sql += ' AND ID_CARPETA IS NULL';
      } else {
        sql += ' AND ID_CARPETA = $2';
        params.push(folderId);
      }
    }

    sql += ' ORDER BY FE_CREACION DESC';

    const result = await query(sql, params);
    return result.rows.map((row) => this.mapRowToArchivo(row as Record<string, unknown>));
  }

  async findByCarpetaYUsuarioPropietario(idCarpeta: string, idUsuarioPropietario: string): Promise<Archivo[]> {
    const result = await query(
      `SELECT * FROM dbo.NASTM_ARCHIVOS
       WHERE ID_CARPETA = $1 AND ID_USUARIO = $2 AND FE_BAJA IS NULL
       ORDER BY FE_CREACION DESC`,
      [idCarpeta, idUsuarioPropietario]
    );
    return result.rows.map((row) => this.mapRowToArchivo(row as Record<string, unknown>));
  }

  async findTemporaryFiles(): Promise<Archivo[]> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_ARCHIVOS WHERE IN_EN_TEMPORAL = 1 AND FE_BAJA IS NULL',
      []
    );
    return result.rows.map((row) => this.mapRowToArchivo(row as Record<string, unknown>));
  }

  async update(archivo: Archivo): Promise<Archivo> {
    await query(
      `UPDATE dbo.NASTM_ARCHIVOS SET
        NO_ARCHIVO_ORIGINAL = $2,
        ID_CARPETA = $3,
        IN_EN_TEMPORAL = $4,
        DE_RUTA_TEMPORAL = $5,
        FE_ULTIMA_DESCARGA = $6,
        FE_ACTUALIZACION = $7
      WHERE ID_ARCHIVO = $1`,
      [
        archivo.id,
        archivo.nombreOriginal,
        archivo.idCarpeta,
        archivo.enTemporal,
        archivo.rutaTemporal,
        archivo.lastDownloadAt,
        archivo.updatedAt,
      ]
    );
    const result = await query('SELECT * FROM dbo.NASTM_ARCHIVOS WHERE ID_ARCHIVO = $1', [archivo.id]);
    return this.mapRowToArchivo(result.rows[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE dbo.NASTM_ARCHIVOS SET FE_BAJA = SYSUTCDATETIME() WHERE ID_ARCHIVO = $1', [id]);
  }

  async countByUsuario(idUsuario: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) AS count FROM dbo.NASTM_ARCHIVOS WHERE ID_USUARIO = $1 AND FE_BAJA IS NULL',
      [idUsuario]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>).count), 10);
  }

  async getTotalSizeByUsuario(idUsuario: string): Promise<number> {
    const result = await query(
      'SELECT COALESCE(SUM(CA_TAMANO_BYTES), 0) AS total FROM dbo.NASTM_ARCHIVOS WHERE ID_USUARIO = $1 AND FE_BAJA IS NULL',
      [idUsuario]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>).total), 10);
  }
}
