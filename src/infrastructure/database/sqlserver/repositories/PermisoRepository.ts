import { v4 as uuidv4 } from 'uuid';
import { IPermisoRepository } from '../../../../domain/repositories/IPermisoRepository';
import { Permiso } from '../../../../domain/entities/Permiso';
import { query } from '../connection';
import { r } from '../column';

export class PermisoRepository implements IPermisoRepository {
  private mapRowToPermiso(row: Record<string, unknown>): Permiso {
    return new Permiso(
      String(r(row, 'ID_PERMISO', 'id')),
      String(r(row, 'CO_PERMISO', 'nombre')),
      (r(row, 'DE_PERMISO', 'descripcion') as string) ?? null,
      r(row, 'FE_CREACION', 'created_at') as Date
    );
  }

  async findAll(): Promise<Permiso[]> {
    const result = await query('SELECT * FROM dbo.NASTM_PERMISOS ORDER BY CO_PERMISO', []);
    return result.rows.map((row) => this.mapRowToPermiso(row as Record<string, unknown>));
  }

  async findById(id: string): Promise<Permiso | null> {
    const result = await query('SELECT * FROM dbo.NASTM_PERMISOS WHERE ID_PERMISO = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToPermiso(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByNombre(nombre: string): Promise<Permiso | null> {
    const result = await query('SELECT * FROM dbo.NASTM_PERMISOS WHERE CO_PERMISO = $1', [nombre]);
    return result.rows.length > 0 ? this.mapRowToPermiso(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(permiso: Omit<Permiso, 'id' | 'createdAt'>): Promise<Permiso> {
    const id = uuidv4();
    await query(`INSERT INTO dbo.NASTM_PERMISOS (ID_PERMISO, CO_PERMISO, DE_PERMISO) VALUES ($1, $2, $3)`, [
      id,
      permiso.nombre,
      permiso.descripcion,
    ]);
    const result = await query('SELECT * FROM dbo.NASTM_PERMISOS WHERE ID_PERMISO = $1', [id]);
    return this.mapRowToPermiso(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, permiso: Partial<Omit<Permiso, 'id' | 'createdAt'>>): Promise<Permiso> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (permiso.nombre !== undefined) {
      updates.push(`CO_PERMISO = $${paramIndex++}`);
      values.push(permiso.nombre);
    }
    if (permiso.descripcion !== undefined) {
      updates.push(`DE_PERMISO = $${paramIndex++}`);
      values.push(permiso.descripcion);
    }

    values.push(id);

    await query(`UPDATE dbo.NASTM_PERMISOS SET ${updates.join(', ')} WHERE ID_PERMISO = $${paramIndex}`, values);
    const result = await query('SELECT * FROM dbo.NASTM_PERMISOS WHERE ID_PERMISO = $1', [id]);
    return this.mapRowToPermiso(result.rows[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await query('DELETE FROM dbo.NASTM_PERMISOS WHERE ID_PERMISO = $1', [id]);
  }
}
