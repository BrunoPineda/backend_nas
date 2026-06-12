import { ArchivosListadoVigencia, IArchivoRepository } from '../../../../domain/repositories/IArchivoRepository';
import { Archivo } from '../../../../domain/entities/Archivo';
import { query } from '../connection';
import { r } from '../column';
import type { UploadVigenciaParsed } from '../../../../application/services/UploadVigenciaParser';

export class ArchivoRepository implements IArchivoRepository {
  private mapRowToArchivo(row: Record<string, unknown>): Archivo {
    let rutasEspejo: string[] | null = null;
    const rawEsp = r(row, 'DE_RUTAS_ESPEJO', 'de_rutas_espejo') as string | null | undefined;
    if (rawEsp != null && String(rawEsp).trim().length > 0) {
      try {
        const parsed = JSON.parse(String(rawEsp)) as unknown;
        if (Array.isArray(parsed)) {
          rutasEspejo = parsed.filter((x) => typeof x === 'string').map(String);
        }
      } catch {
        rutasEspejo = null;
      }
    }
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
      rutasEspejo,
      row['IN_ES_PERMANENTE'] === undefined && row['in_es_permanente'] === undefined
        ? true
        : Boolean(r(row, 'IN_ES_PERMANENTE', 'in_es_permanente')),
      (r(row, 'FE_INICIO_VIGENCIA', 'fecha_inicio_vigencia') as Date) ?? null,
      (r(row, 'FE_FIN_VIGENCIA', 'fecha_fin_vigencia') as Date) ?? null,
      (r(row, 'FE_BAJA', 'deleted_at') as Date) ?? null
    );
  }

  async save(archivo: Archivo): Promise<Archivo> {
    await query(
      `INSERT INTO dbo.NASTM_ARCHIVOS (
        ID_ARCHIVO, ID_USUARIO, ID_CARPETA, NO_ARCHIVO_ORIGINAL, NO_ARCHIVO_FISICO,
        DE_RUTA_FISICA, TI_MIME, CA_TAMANO_BYTES, CO_HASH_SHA256, IN_EN_TEMPORAL,
        DE_RUTA_TEMPORAL, FE_CREACION, FE_ACTUALIZACION, DE_RUTAS_ESPEJO,
        IN_ES_PERMANENTE, FE_INICIO_VIGENCIA, FE_FIN_VIGENCIA
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
        archivo.rutasEspejo && archivo.rutasEspejo.length > 0
          ? JSON.stringify(archivo.rutasEspejo)
          : null,
        archivo.esPermanente ? 1 : 0,
        archivo.fechaInicioVigencia,
        archivo.fechaFinVigencia,
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

  async findByIdIncluyendoBaja(id: string): Promise<Archivo | null> {
    const result = await query('SELECT * FROM dbo.NASTM_ARCHIVOS WHERE ID_ARCHIVO = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToArchivo(result.rows[0] as Record<string, unknown>) : null;
  }

  private static filtroVigenciaSql(
    alias: string,
    vigencia: ArchivosListadoVigencia = 'activos'
  ): string {
    if (vigencia === 'activos') {
      return (
        ` AND ${alias}.FE_BAJA IS NULL` +
        ` AND (${alias}.IN_ES_PERMANENTE = 1 OR (` +
        `SYSUTCDATETIME() >= ${alias}.FE_INICIO_VIGENCIA AND ` +
        `SYSUTCDATETIME() <= ${alias}.FE_FIN_VIGENCIA))`
      );
    }
    if (vigencia === 'inactivos') return ` AND ${alias}.FE_BAJA IS NOT NULL`;
    if (vigencia === 'permanentes') {
      return ` AND ${alias}.FE_BAJA IS NULL AND ${alias}.IN_ES_PERMANENTE = 1`;
    }
    if (vigencia === 'temporales') {
      return ` AND ${alias}.FE_BAJA IS NULL AND ${alias}.IN_ES_PERMANENTE = 0`;
    }
    return '';
  }

  async findByUsuario(
    idUsuario: string,
    folderId?: string | null,
    vigencia: ArchivosListadoVigencia = 'activos'
  ): Promise<Archivo[]> {
    let sql =
      'SELECT * FROM dbo.NASTM_ARCHIVOS AS a WHERE a.ID_USUARIO = $1' +
      ArchivoRepository.filtroVigenciaSql('a', vigencia);
    const params: unknown[] = [idUsuario];

    if (folderId !== undefined) {
      if (folderId === null) {
        sql += ' AND a.ID_CARPETA IS NULL';
      } else {
        sql += ' AND a.ID_CARPETA = $2';
        params.push(folderId);
      }
    }

    sql += ' ORDER BY a.FE_CREACION DESC';

    const result = await query(sql, params);
    return result.rows.map((row) => this.mapRowToArchivo(row as Record<string, unknown>));
  }

  async findVisiblesParaUsuario(
    idUsuario: string,
    isAdmin: boolean,
    folderId?: string | null,
    vigencia: ArchivosListadoVigencia = 'activos'
  ): Promise<Archivo[]> {
    let sql =
      `SELECT a.* FROM dbo.NASTM_ARCHIVOS AS a
       INNER JOIN dbo.NASTM_USUARIOS u ON u.ID_USUARIO = a.ID_USUARIO
       WHERE (
         a.ID_USUARIO = $1
         OR (
           a.ID_USUARIO <> $1
           AND EXISTS (
             SELECT 1
             FROM dbo.NASTD_USUARIO_CATEGORIAS uc1
             INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS uc2 ON uc1.ID_CATEGORIA = uc2.ID_CATEGORIA
             WHERE uc1.ID_USUARIO = $1 AND uc2.ID_USUARIO = a.ID_USUARIO
           )
           AND (
             $2 = 1
             OR ISNULL(u.IN_ES_PRIVADO, 0) = 0
           )
         )
       )` + ArchivoRepository.filtroVigenciaSql('a', vigencia);
    const params: unknown[] = [idUsuario, isAdmin ? 1 : 0];

    if (folderId !== undefined) {
      if (folderId === null) {
        sql += ' AND a.ID_CARPETA IS NULL';
      } else {
        sql += ' AND a.ID_CARPETA = $3';
        params.push(folderId);
      }
    }

    sql += ' ORDER BY a.FE_CREACION DESC';

    const result = await query(sql, params);
    return result.rows.map((row) => this.mapRowToArchivo(row as Record<string, unknown>));
  }

  async esVisibleParaUsuario(
    idArchivo: string,
    idUsuario: string,
    isAdmin: boolean
  ): Promise<boolean> {
    const result = await query(
      `SELECT 1 AS ok
       FROM dbo.NASTM_ARCHIVOS AS a
       INNER JOIN dbo.NASTM_USUARIOS AS u ON u.ID_USUARIO = a.ID_USUARIO
       WHERE a.ID_ARCHIVO = $1
         AND a.FE_BAJA IS NULL
         AND (
           a.ID_USUARIO = $2
           OR (
             a.ID_USUARIO <> $2
             AND EXISTS (
               SELECT 1
               FROM dbo.NASTD_USUARIO_CATEGORIAS AS uc1
               INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS AS uc2 ON uc1.ID_CATEGORIA = uc2.ID_CATEGORIA
               WHERE uc1.ID_USUARIO = $2 AND uc2.ID_USUARIO = a.ID_USUARIO
             )
             AND ($3 = 1 OR ISNULL(u.IN_ES_PRIVADO, 0) = 0)
           )
         )`,
      [idArchivo, idUsuario, isAdmin ? 1 : 0]
    );
    return result.rows.length > 0;
  }

  async findByCarpetaYUsuarioPropietario(
    idCarpeta: string,
    idUsuarioPropietario: string,
    vigencia: ArchivosListadoVigencia = 'activos'
  ): Promise<Archivo[]> {
    const result = await query(
      `SELECT * FROM dbo.NASTM_ARCHIVOS AS a
       WHERE a.ID_CARPETA = $1 AND a.ID_USUARIO = $2` +
        ArchivoRepository.filtroVigenciaSql('a', vigencia) +
        ` ORDER BY a.FE_CREACION DESC`,
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
        ID_USUARIO = $3,
        ID_CARPETA = $4,
        IN_EN_TEMPORAL = $5,
        DE_RUTA_TEMPORAL = $6,
        FE_ULTIMA_DESCARGA = $7,
        FE_ACTUALIZACION = $8
      WHERE ID_ARCHIVO = $1`,
      [
        archivo.id,
        archivo.nombreOriginal,
        archivo.idUsuario,
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

  async updateVigencia(id: string, vigencia: UploadVigenciaParsed): Promise<void> {
    await query(
      `UPDATE dbo.NASTM_ARCHIVOS SET
        IN_ES_PERMANENTE = $2,
        FE_INICIO_VIGENCIA = $3,
        FE_FIN_VIGENCIA = $4,
        FE_ACTUALIZACION = SYSUTCDATETIME(),
        FE_BAJA = NULL
      WHERE ID_ARCHIVO = $1`,
      [
        id,
        vigencia.esPermanente ? 1 : 0,
        vigencia.esPermanente ? null : vigencia.fechaInicioVigencia,
        vigencia.esPermanente ? null : vigencia.fechaFinVigencia,
      ]
    );
  }

  async reactivar(id: string): Promise<void> {
    await query(
      `UPDATE dbo.NASTM_ARCHIVOS SET
        FE_BAJA = NULL,
        FE_ACTUALIZACION = SYSUTCDATETIME(),
        IN_ES_PERMANENTE = 1,
        FE_INICIO_VIGENCIA = NULL,
        FE_FIN_VIGENCIA = NULL
      WHERE ID_ARCHIVO = $1`,
      [id]
    );
  }

  async findIdsVigenciaVencida(): Promise<string[]> {
    const result = await query(
      `SELECT ID_ARCHIVO AS id FROM dbo.NASTM_ARCHIVOS
       WHERE IN_ES_PERMANENTE = 0
         AND FE_BAJA IS NULL
         AND FE_FIN_VIGENCIA IS NOT NULL
         AND SYSUTCDATETIME() > FE_FIN_VIGENCIA`,
      []
    );
    return result.rows.map((row) => String((row as Record<string, unknown>).id));
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

  async getStorageBreakdownByUsuario(
    idUsuario: string
  ): Promise<Array<{ tipo: string; cantidad: number; bytes: number }>> {
    const result = await query(
      `SELECT
         CASE
           WHEN a.TI_MIME LIKE 'image/%' THEN 'images'
           WHEN a.TI_MIME LIKE 'video/%' THEN 'videos'
           WHEN a.TI_MIME LIKE 'audio/%' THEN 'audio'
           WHEN a.TI_MIME LIKE '%pdf%'
             OR a.TI_MIME LIKE '%document%'
             OR a.TI_MIME LIKE 'text/%' THEN 'documents'
           ELSE 'other'
         END AS tipo,
         COUNT(*) AS cantidad,
         COALESCE(SUM(a.CA_TAMANO_BYTES), 0) AS bytes
       FROM dbo.NASTM_ARCHIVOS AS a
       WHERE a.ID_USUARIO = $1 AND a.FE_BAJA IS NULL
       GROUP BY
         CASE
           WHEN a.TI_MIME LIKE 'image/%' THEN 'images'
           WHEN a.TI_MIME LIKE 'video/%' THEN 'videos'
           WHEN a.TI_MIME LIKE 'audio/%' THEN 'audio'
           WHEN a.TI_MIME LIKE '%pdf%'
             OR a.TI_MIME LIKE '%document%'
             OR a.TI_MIME LIKE 'text/%' THEN 'documents'
           ELSE 'other'
         END`,
      [idUsuario]
    );
    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        tipo: String(r.tipo ?? r.TIPO ?? 'other'),
        cantidad: parseInt(String(r.cantidad ?? r.CANTIDAD ?? 0), 10),
        bytes: parseInt(String(r.bytes ?? r.BYTES ?? 0), 10),
      };
    });
  }
}
