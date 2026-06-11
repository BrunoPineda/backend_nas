import { v4 as uuidv4 } from 'uuid';
import { IRolRepository } from '../../../../domain/repositories/IRolRepository';
import { Rol } from '../../../../domain/entities/Rol';
import { query } from '../connection';
import { r } from '../column';

export class RolRepository implements IRolRepository {
  private mapRowToRol(row: Record<string, unknown>): Rol {
    return new Rol(
      String(r(row, 'ID_ROL', 'id')),
      String(r(row, 'NO_ROL', 'nombre')),
      (r(row, 'DE_ROL', 'descripcion') as string) ?? null,
      Boolean(r(row, 'IN_ES_SISTEMA', 'es_sistema')),
      r(row, 'FE_CREACION', 'created_at') as Date,
      r(row, 'FE_ACTUALIZACION', 'updated_at') as Date
    );
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
}
