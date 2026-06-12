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

  async findTreeVisibleParaUsuario(idUsuario: string, isAdmin: boolean): Promise<Carpeta[]> {
    const result = await query(
      `WITH visible_users AS (
        SELECT u.ID_USUARIO
        FROM dbo.NASTM_USUARIOS u
        WHERE u.ID_USUARIO = $1
        UNION
        SELECT u2.ID_USUARIO
        FROM dbo.NASTM_USUARIOS u2
        WHERE u2.ID_USUARIO <> $1
          AND EXISTS (
            SELECT 1
            FROM dbo.NASTD_USUARIO_CATEGORIAS uc1
            INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS uc2 ON uc1.ID_CATEGORIA = uc2.ID_CATEGORIA
            WHERE uc1.ID_USUARIO = $1 AND uc2.ID_USUARIO = u2.ID_USUARIO
          )
          AND (
            $2 = 1
            OR ISNULL(u2.IN_ES_PRIVADO, 0) = 0
          )
      ),
      folder_tree AS (
        SELECT c.*
        FROM dbo.NASTM_CARPETAS c
        INNER JOIN visible_users vu ON vu.ID_USUARIO = c.ID_USUARIO
        WHERE c.FE_BAJA IS NULL AND c.ID_CARPETA_PADRE IS NULL
        UNION ALL
        SELECT c.*
        FROM dbo.NASTM_CARPETAS c
        INNER JOIN folder_tree ft ON c.ID_CARPETA_PADRE = ft.ID_CARPETA
        WHERE c.FE_BAJA IS NULL
      )
      SELECT * FROM folder_tree ORDER BY NO_CARPETA ASC`,
      [idUsuario, isAdmin ? 1 : 0]
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

  async findByIdIncluyendoBaja(id: string): Promise<Carpeta | null> {
    const result = await query('SELECT * FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToCarpeta(result.rows[0] as Record<string, unknown>) : null;
  }

  async reactivar(id: string): Promise<void> {
    await query(
      `UPDATE dbo.NASTM_CARPETAS SET FE_BAJA = NULL, FE_ACTUALIZACION = SYSUTCDATETIME() WHERE ID_CARPETA = $1`,
      [id]
    );
  }

  async countSubcarpetasActivas(idCarpeta: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) AS count FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA_PADRE = $1 AND FE_BAJA IS NULL',
      [idCarpeta]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>).count), 10);
  }

  async estaVacia(idCarpeta: string): Promise<boolean> {
    const [archivos, subcarpetas] = await Promise.all([
      this.countArchivos(idCarpeta),
      this.countSubcarpetasActivas(idCarpeta),
    ]);
    return archivos === 0 && subcarpetas === 0;
  }

  async inactivarSubarbol(idRaiz: string): Promise<number> {
    const result = await query(
      `WITH sub AS (
        SELECT ID_CARPETA FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1 AND FE_BAJA IS NULL
        UNION ALL
        SELECT c.ID_CARPETA FROM dbo.NASTM_CARPETAS c
        INNER JOIN sub s ON c.ID_CARPETA_PADRE = s.ID_CARPETA
        WHERE c.FE_BAJA IS NULL
      )
      UPDATE c
      SET c.FE_BAJA = SYSUTCDATETIME(), c.FE_ACTUALIZACION = SYSUTCDATETIME()
      FROM dbo.NASTM_CARPETAS c
      INNER JOIN sub ON sub.ID_CARPETA = c.ID_CARPETA
      WHERE c.FE_BAJA IS NULL`,
      [idRaiz]
    );
    return result.rowCount ?? 0;
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

    const acceso = await query(
      `SELECT
         CASE WHEN r.NO_ROL IN (N'ADMIN', N'NAS_ADMIN') THEN 1 ELSE 0 END AS es_admin,
         ISNULL(uo.IN_ES_PRIVADO, 0) AS owner_privado,
         CASE WHEN EXISTS (
           SELECT 1
           FROM dbo.NASTD_USUARIO_CATEGORIAS uc1
           INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS uc2 ON uc1.ID_CATEGORIA = uc2.ID_CATEGORIA
           WHERE uc1.ID_USUARIO = $1 AND uc2.ID_USUARIO = $2
         ) THEN 1 ELSE 0 END AS comparten_categoria
       FROM dbo.NASTM_USUARIOS uo
       LEFT JOIN dbo.NASTM_USUARIOS uv ON uv.ID_USUARIO = $1
       LEFT JOIN dbo.NASTM_ROLES r ON r.ID_ROL = uv.ID_ROL
       WHERE uo.ID_USUARIO = $2`,
      [idUsuario, carpeta.idUsuario]
    );

    if (acceso.rows.length === 0) {
      return false;
    }

    const row = acceso.rows[0] as Record<string, unknown>;
    const esAdmin = Number(row.es_admin ?? row.ES_ADMIN ?? 0) === 1;
    const ownerPrivado = Boolean(row.owner_privado ?? row.OWNER_PRIVADO);
    const compartenCategoria = Number(row.comparten_categoria ?? row.COMPARTEN_CATEGORIA ?? 0) === 1;

    if (!compartenCategoria) {
      return false;
    }

    if (esAdmin) {
      return true;
    }

    if (ownerPrivado) {
      return false;
    }

    return true;
  }

  async usuarioPuedeAccederACarpetaInactiva(idUsuario: string, idCarpeta: string): Promise<boolean> {
    const carpeta = await this.findByIdIncluyendoBaja(idCarpeta);
    if (!carpeta) {
      return false;
    }
    if (carpeta.idUsuario === idUsuario) {
      return true;
    }

    const acceso = await query(
      `SELECT
         CASE WHEN r.NO_ROL IN (N'ADMIN', N'NAS_ADMIN') THEN 1 ELSE 0 END AS es_admin,
         ISNULL(uo.IN_ES_PRIVADO, 0) AS owner_privado,
         CASE WHEN EXISTS (
           SELECT 1
           FROM dbo.NASTD_USUARIO_CATEGORIAS uc1
           INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS uc2 ON uc1.ID_CATEGORIA = uc2.ID_CATEGORIA
           WHERE uc1.ID_USUARIO = $1 AND uc2.ID_USUARIO = $2
         ) THEN 1 ELSE 0 END AS comparten_categoria
       FROM dbo.NASTM_USUARIOS uo
       LEFT JOIN dbo.NASTM_USUARIOS uv ON uv.ID_USUARIO = $1
       LEFT JOIN dbo.NASTM_ROLES r ON r.ID_ROL = uv.ID_ROL
       WHERE uo.ID_USUARIO = $2`,
      [idUsuario, carpeta.idUsuario]
    );

    if (acceso.rows.length === 0) {
      return false;
    }

    const row = acceso.rows[0] as Record<string, unknown>;
    const esAdmin = Number(row.es_admin ?? row.ES_ADMIN ?? 0) === 1;
    const ownerPrivado = Boolean(row.owner_privado ?? row.OWNER_PRIVADO);
    const compartenCategoria = Number(row.comparten_categoria ?? row.COMPARTEN_CATEGORIA ?? 0) === 1;

    if (!compartenCategoria) {
      return false;
    }
    if (esAdmin) {
      return true;
    }
    if (ownerPrivado) {
      return false;
    }
    return true;
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
