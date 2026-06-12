import { v4 as uuidv4 } from 'uuid';
import { IRolRepository } from '../../../../domain/repositories/IRolRepository';
import { Rol } from '../../../../domain/entities/Rol';
import { query } from '../connection';
import { r } from '../column';
import { useIntranetUserDatabase } from '../connection';
import { IntranetPermissionService } from '../../../../application/services/IntranetPermissionService';

export class RolRepository implements IRolRepository {
  private intranetPerm = new IntranetPermissionService();

  private async codUsuarioFromNasId(idUsuario: string): Promise<string | null> {
    const result = await query(
      `SELECT NU_DNI, NU_NUMERO_DOCUMENTO FROM dbo.NASTM_USUARIOS WHERE ID_USUARIO = $1`,
      [idUsuario]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    const cod = row.NU_DNI ?? row.nu_dni ?? row.NU_NUMERO_DOCUMENTO ?? row.nu_numero_documento;
    return cod != null ? String(cod).trim() : null;
  }
  private mapRowToRol(row: Record<string, unknown>): Rol {
    const nu = r(row, 'NU_ID_ROL_INTRANET', 'nu_id_rol_intranet');
    return new Rol(
      String(r(row, 'ID_ROL', 'id')),
      String(r(row, 'NO_ROL', 'nombre')),
      (r(row, 'DE_ROL', 'descripcion') as string) ?? null,
      Boolean(r(row, 'IN_ES_SISTEMA', 'es_sistema')),
      r(row, 'FE_CREACION', 'created_at') as Date,
      r(row, 'FE_ACTUALIZACION', 'updated_at') as Date,
      nu != null ? Number(nu) : null
    );
  }

  async findNasIntranetRoles(): Promise<Rol[]> {
    const result = await query(
      `SELECT * FROM dbo.NASTM_ROLES
       WHERE NU_ID_ROL_INTRANET BETWEEN 1072 AND 1080
       ORDER BY NU_ID_ROL_INTRANET`,
      []
    );
    return result.rows.map((row) => this.mapRowToRol(row as Record<string, unknown>));
  }

  async findAll(): Promise<Rol[]> {
    const result = await query('SELECT * FROM dbo.NASTM_ROLES ORDER BY NO_ROL', []);
    return result.rows.map((row) => this.mapRowToRol(row as Record<string, unknown>));
  }

  async findById(id: string): Promise<Rol | null> {
    const result = await query('SELECT * FROM dbo.NASTM_ROLES WHERE ID_ROL = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToRol(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByName(nombre: string): Promise<Rol | null> {
    const result = await query('SELECT * FROM dbo.NASTM_ROLES WHERE NO_ROL = $1', [nombre]);
    return result.rows.length > 0 ? this.mapRowToRol(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(rol: Omit<Rol, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rol> {
    const id = uuidv4();
    await query(
      `INSERT INTO dbo.NASTM_ROLES (ID_ROL, NO_ROL, DE_ROL, IN_ES_SISTEMA)
       VALUES ($1, $2, $3, $4)`,
      [id, rol.nombre, rol.descripcion, rol.esSistema]
    );
    const result = await query('SELECT * FROM dbo.NASTM_ROLES WHERE ID_ROL = $1', [id]);
    return this.mapRowToRol(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, rol: Partial<Omit<Rol, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Rol> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (rol.nombre !== undefined) {
      updates.push(`NO_ROL = $${paramIndex++}`);
      values.push(rol.nombre);
    }
    if (rol.descripcion !== undefined) {
      updates.push(`DE_ROL = $${paramIndex++}`);
      values.push(rol.descripcion);
    }
    if (rol.esSistema !== undefined) {
      updates.push(`IN_ES_SISTEMA = $${paramIndex++}`);
      values.push(rol.esSistema);
    }

    updates.push('FE_ACTUALIZACION = SYSUTCDATETIME()');
    values.push(id);

    await query(`UPDATE dbo.NASTM_ROLES SET ${updates.join(', ')} WHERE ID_ROL = $${paramIndex}`, values);
    const result = await query('SELECT * FROM dbo.NASTM_ROLES WHERE ID_ROL = $1', [id]);
    return this.mapRowToRol(result.rows[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await query('DELETE FROM dbo.NASTM_ROLES WHERE ID_ROL = $1 AND IN_ES_SISTEMA = 0', [id]);
  }

  async getPermisosByRol(idRol: string): Promise<string[]> {
    const result = await query(
      'SELECT ID_PERMISO FROM dbo.NASTD_ROLES_PERMISOS WHERE ID_ROL = $1',
      [idRol]
    );
    return result.rows.map((row) => String(r(row as Record<string, unknown>, 'ID_PERMISO', 'id_permiso')));
  }

  async assignPermiso(idRol: string, idPermiso: string): Promise<void> {
    await query(
      `INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS WHERE ID_ROL = $1 AND ID_PERMISO = $2
       )`,
      [idRol, idPermiso]
    );
  }

  async removePermiso(idRol: string, idPermiso: string): Promise<void> {
    await query('DELETE FROM dbo.NASTD_ROLES_PERMISOS WHERE ID_ROL = $1 AND ID_PERMISO = $2', [
      idRol,
      idPermiso,
    ]);
  }

  async usuarioTieneCodigoPermiso(idUsuario: string, codigoPermiso: string): Promise<boolean> {
    if (useIntranetUserDatabase()) {
      const cod = await this.codUsuarioFromNasId(idUsuario);
      if (cod) {
        return this.intranetPerm.usuarioTieneCodigoPermiso(cod, codigoPermiso);
      }
    }
    const result = await query(
      `SELECT 1 AS uno
       FROM dbo.NASTM_USUARIOS AS u
       INNER JOIN dbo.NASTD_ROLES_PERMISOS AS rp ON rp.ID_ROL = u.ID_ROL
       INNER JOIN dbo.NASTM_PERMISOS AS p ON p.ID_PERMISO = rp.ID_PERMISO
       WHERE u.ID_USUARIO = $1
         AND u.ES_VIGENTE = 1
         AND p.CO_PERMISO = $2`,
      [idUsuario, codigoPermiso]
    );
    return result.rows.length > 0;
  }

  async listCodigosPermisoByUsuario(idUsuario: string): Promise<string[]> {
    if (useIntranetUserDatabase()) {
      const cod = await this.codUsuarioFromNasId(idUsuario);
      if (cod) {
        return this.intranetPerm.listCodigosPermisoByCodUsuario(cod);
      }
    }
    const result = await query(
      `SELECT p.CO_PERMISO AS codigo
       FROM dbo.NASTM_USUARIOS AS u
       INNER JOIN dbo.NASTD_ROLES_PERMISOS AS rp ON rp.ID_ROL = u.ID_ROL
       INNER JOIN dbo.NASTM_PERMISOS AS p ON p.ID_PERMISO = rp.ID_PERMISO
       WHERE u.ID_USUARIO = $1 AND u.ES_VIGENTE = 1
       ORDER BY p.CO_PERMISO`,
      [idUsuario]
    );
    return result.rows.map((row) =>
      String((row as Record<string, unknown>).codigo ?? (row as Record<string, unknown>).CO_PERMISO)
    );
  }

  async getCategoriaIdsByRol(idRol: string): Promise<string[]> {
    const result = await query(
      `SELECT rc.ID_CATEGORIA
       FROM dbo.NASTD_ROLES_CATEGORIAS AS rc
       INNER JOIN dbo.NASTM_CATEGORIAS AS c ON c.ID_CATEGORIA = rc.ID_CATEGORIA
       WHERE rc.ID_ROL = $1
         AND (c.ES_VIGENTE = 1 OR c.ES_VIGENTE IS NULL)
       ORDER BY c.CO_CATEGORIA`,
      [idRol]
    );
    return result.rows.map((row) =>
      String(r(row as Record<string, unknown>, 'ID_CATEGORIA', 'id_categoria'))
    );
  }

  async getRoleCategoryMatrix(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    const result = await query(
      `SELECT rc.ID_ROL, rc.ID_CATEGORIA
       FROM dbo.NASTD_ROLES_CATEGORIAS AS rc
       INNER JOIN dbo.NASTM_CATEGORIAS AS c ON c.ID_CATEGORIA = rc.ID_CATEGORIA
       WHERE c.ES_VIGENTE = 1 OR c.ES_VIGENTE IS NULL
       ORDER BY rc.ID_ROL`
    );
    for (const row of result.rows) {
      const rec = row as Record<string, unknown>;
      const idRol = String(r(rec, 'ID_ROL', 'id_rol'));
      const idCat = String(r(rec, 'ID_CATEGORIA', 'id_categoria'));
      const list = map.get(idRol) ?? [];
      list.push(idCat);
      map.set(idRol, list);
    }
    return map;
  }

  async replaceCategoriasForRol(idRol: string, categoriaIds: string[]): Promise<void> {
    await query('DELETE FROM dbo.NASTD_ROLES_CATEGORIAS WHERE ID_ROL = $1', [idRol]);
    const unique = [...new Set(categoriaIds.filter(Boolean))];
    for (const idCat of unique) {
      await query(
        `INSERT INTO dbo.NASTD_ROLES_CATEGORIAS (ID_ROL, ID_CATEGORIA)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM dbo.NASTD_ROLES_CATEGORIAS WHERE ID_ROL = $1 AND ID_CATEGORIA = $2
         )`,
        [idRol, idCat]
      );
    }
  }
}
