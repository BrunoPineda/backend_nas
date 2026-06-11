import { ICarpetaRepository } from '../../../../domain/repositories/ICarpetaRepository';
import { Carpeta } from '../../../../domain/entities/Carpeta';
import { query } from '../connection';
import { r } from '../column';

export class CarpetaRepository implements ICarpetaRepository {
  private mapRowToCarpeta(row: Record<string, unknown>): Carpeta {
    return new Carpeta(
      String(r(row, 'ID_CARPETA', 'id')),
      String(r(row, 'NO_CARPETA', 'nombre')),
      (r(row, 'ID_CARPETA_PADRE', 'id_padre') as string) ?? null,
      String(r(row, 'ID_USUARIO', 'id_usuario')),
      Boolean(r(row, 'IN_ES_COMPARTIDA', 'es_compartida')),
      Boolean(r(row, 'IN_ES_PUBLICA', 'es_publica')),
      r(row, 'FE_CREACION', 'created_at') as Date,
      r(row, 'FE_ACTUALIZACION', 'updated_at') as Date,
      (r(row, 'FE_BAJA', 'deleted_at') as Date) ?? null
    );
  }

  async save(carpeta: Carpeta): Promise<Carpeta> {
    await query(
      `INSERT INTO dbo.NASTM_CARPETAS (
        ID_CARPETA, NO_CARPETA, ID_CARPETA_PADRE, ID_USUARIO, IN_ES_COMPARTIDA, IN_ES_PUBLICA, FE_CREACION, FE_ACTUALIZACION
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        carpeta.id,
        carpeta.nombre,
        carpeta.idPadre,
        carpeta.idUsuario,
        carpeta.esCompartida,
        carpeta.esPublica,
        carpeta.createdAt,
        carpeta.updatedAt,
      ]
    );
    const result = await query('SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1', [carpeta.id]);
    return this.mapRowToCarpeta(result.rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<Carpeta | null> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1 AND FE_BAJA IS NULL',
      [id]
    );
    return result.rows.length > 0 ? this.mapRowToCarpeta(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByUsuario(idUsuario: string, idPadre?: string | null): Promise<Carpeta[]> {
    let sql = 'SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_USUARIO = $1 AND FE_BAJA IS NULL';
    const params: unknown[] = [idUsuario];

    if (idPadre !== undefined) {
      if (idPadre === null) {
        sql += ' AND ID_CARPETA_PADRE IS NULL';
      } else {
        sql += ' AND ID_CARPETA_PADRE = $2';
        params.push(idPadre);
      }
    }

    sql += ' ORDER BY NO_CARPETA ASC';

    const result = await query(sql, params);
    return result.rows.map((row) => this.mapRowToCarpeta(row as Record<string, unknown>));
  }

  async findTreeByUsuario(idUsuario: string): Promise<Carpeta[]> {
    const result = await query(
      `WITH folder_tree AS (
        SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_USUARIO = $1 AND FE_BAJA IS NULL AND ID_CARPETA_PADRE IS NULL
        UNION ALL
        SELECT c.* FROM dbo.NASTM_CARPETAS c
        INNER JOIN folder_tree ft ON c.ID_CARPETA_PADRE = ft.ID_CARPETA
        WHERE c.FE_BAJA IS NULL
      )
      SELECT * FROM folder_tree ORDER BY NO_CARPETA ASC`,
      [idUsuario]
    );
    return result.rows.map((row) => this.mapRowToCarpeta(row as Record<string, unknown>));
  }

  async update(carpeta: Carpeta): Promise<Carpeta> {
    await query(
      `UPDATE dbo.NASTM_CARPETAS SET
        NO_CARPETA = $2,
        ID_CARPETA_PADRE = $3,
        IN_ES_COMPARTIDA = $4,
        IN_ES_PUBLICA = $5,
        FE_ACTUALIZACION = $6
      WHERE ID_CARPETA = $1`,
      [
        carpeta.id,
        carpeta.nombre,
        carpeta.idPadre,
        carpeta.esCompartida,
        carpeta.esPublica,
        carpeta.updatedAt,
      ]
    );
    const result = await query('SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1', [carpeta.id]);
    return this.mapRowToCarpeta(result.rows[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE dbo.NASTM_CARPETAS SET FE_BAJA = SYSUTCDATETIME() WHERE ID_CARPETA = $1', [id]);
  }

  async countArchivos(idCarpeta: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) AS count FROM dbo.NASTM_ARCHIVOS WHERE ID_CARPETA = $1 AND FE_BAJA IS NULL',
      [idCarpeta]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>).count), 10);
  }

  async findCompartidasByUsuario(idUsuario: string): Promise<Carpeta[]> {
    const result = await query(
      `SELECT c.* FROM dbo.NASTM_CARPETAS c
       INNER JOIN dbo.NASTD_CARPETAS_COMPARTIDAS cc ON c.ID_CARPETA = cc.ID_CARPETA
       INNER JOIN dbo.NASTM_USUARIOS uo ON uo.ID_USUARIO = c.ID_USUARIO AND ISNULL(uo.IN_ES_PRIVADO, 0) = 0
       WHERE cc.ID_USUARIO_COMPARTIDO = $1
         AND c.FE_BAJA IS NULL
         AND EXISTS (
           SELECT 1
           FROM dbo.NASTD_USUARIO_CATEGORIAS x
           INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS y ON x.ID_CATEGORIA = y.ID_CATEGORIA
           WHERE x.ID_USUARIO = $1 AND y.ID_USUARIO = c.ID_USUARIO
         )
       ORDER BY c.NO_CARPETA ASC`,
      [idUsuario]
    );
    return result.rows.map((row) => this.mapRowToCarpeta(row as Record<string, unknown>));
  }

  async usuarioPuedeAccederACarpeta(idUsuario: string, idCarpeta: string): Promise<boolean> {
    const carpeta = await this.findById(idCarpeta);
    if (!carpeta) {
      return false;
    }
    if (carpeta.idUsuario === idUsuario) {
      return true;
    }
    const ownerPriv = await query(
      'SELECT IN_ES_PRIVADO FROM dbo.NASTM_USUARIOS WHERE ID_USUARIO = $1',
      [carpeta.idUsuario]
    );
    if (ownerPriv.rows.length > 0) {
      const pr = ownerPriv.rows[0] as Record<string, unknown>;
      if (Boolean(r(pr, 'IN_ES_PRIVADO', 'in_es_privado'))) {
        return false;
      }
    }
    const result = await query(
      `WITH anc AS (
        SELECT ID_CARPETA, ID_CARPETA_PADRE, ID_USUARIO
        FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1 AND FE_BAJA IS NULL
        UNION ALL
        SELECT p.ID_CARPETA, p.ID_CARPETA_PADRE, p.ID_USUARIO
        FROM dbo.NASTM_CARPETAS p
        INNER JOIN anc a ON p.ID_CARPETA = a.ID_CARPETA_PADRE
        WHERE p.FE_BAJA IS NULL
      )
      SELECT 1 AS ok FROM anc x
      INNER JOIN dbo.NASTD_CARPETAS_COMPARTIDAS cc
        ON cc.ID_CARPETA = x.ID_CARPETA AND cc.ID_USUARIO_COMPARTIDO = $2
      WHERE EXISTS (
        SELECT 1 FROM dbo.NASTD_USUARIO_CATEGORIAS u1
        INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS u2 ON u1.ID_CATEGORIA = u2.ID_CATEGORIA
        WHERE u1.ID_USUARIO = $2 AND u2.ID_USUARIO = $3
      )`,
      [idCarpeta, idUsuario, carpeta.idUsuario]
    );
    return result.rows.length > 0;
  }

  async findSubarbolDesdeRaiz(idRaiz: string): Promise<Carpeta[]> {
    const result = await query(
      `WITH sub AS (
        SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1 AND FE_BAJA IS NULL
        UNION ALL
        SELECT c.* FROM dbo.NASTM_CARPETAS c
        INNER JOIN sub s ON c.ID_CARPETA_PADRE = s.ID_CARPETA
        WHERE c.FE_BAJA IS NULL
      )
      SELECT * FROM sub ORDER BY NO_CARPETA ASC`,
      [idRaiz]
    );
    return result.rows.map((row) => this.mapRowToCarpeta(row as Record<string, unknown>));
  }
}
