import { ICategoriaRepository } from '../../../../domain/repositories/ICategoriaRepository';
import { Categoria } from '../../../../domain/entities/Categoria';
import { query } from '../connection';
import { r } from '../column';
import { randomUUID } from 'crypto';

export class CategoriaRepository implements ICategoriaRepository {
  private mapRow(row: Record<string, unknown>): Categoria {
    return new Categoria(
      String(r(row, 'ID_CATEGORIA', 'id_categoria')),
      String(r(row, 'CO_CATEGORIA', 'co_categoria')),
      String(r(row, 'DE_CATEGORIA', 'de_categoria')),
      r(row, 'FE_CREACION', 'fe_creacion') as Date
    );
  }

  async findAll(): Promise<Categoria[]> {
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS ORDER BY CO_CATEGORIA', []);
    return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  async findById(id: string): Promise<Categoria | null> {
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS WHERE ID_CATEGORIA = $1', [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByCodigo(codigo: string): Promise<Categoria | null> {
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS WHERE CO_CATEGORIA = $1', [codigo]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(codigo: string, descripcion: string): Promise<Categoria> {
    const id = randomUUID();
    await query(
      `INSERT INTO dbo.NASTM_CATEGORIAS (ID_CATEGORIA, CO_CATEGORIA, DE_CATEGORIA) VALUES ($1, $2, $3)`,
      [id, codigo.toUpperCase().trim(), descripcion]
    );
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS WHERE ID_CATEGORIA = $1', [id]);
    const cat = this.mapRow(result.rows[0] as Record<string, unknown>);
    await this.assignToAllAdminUsers(cat.id);
    return cat;
  }

  async assignToAllAdminUsers(idCategoria: string): Promise<void> {
    await query(
      `INSERT INTO dbo.NASTD_USUARIO_CATEGORIAS (ID_USUARIO, ID_CATEGORIA)
       SELECT u.ID_USUARIO, $1
       FROM dbo.NASTM_USUARIOS u
       INNER JOIN dbo.NASTM_ROLES r ON r.ID_ROL = u.ID_ROL
       WHERE r.NO_ROL = N'ADMIN'
         AND NOT EXISTS (
           SELECT 1 FROM dbo.NASTD_USUARIO_CATEGORIAS uc
           WHERE uc.ID_USUARIO = u.ID_USUARIO AND uc.ID_CATEGORIA = $1
         )`,
      [idCategoria]
    );
  }
}
