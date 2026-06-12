import { CategoriaConUso, ICategoriaRepository } from '../../../../domain/repositories/ICategoriaRepository';
import { Categoria } from '../../../../domain/entities/Categoria';
import { query } from '../connection';
import { r } from '../column';
import { randomUUID } from 'crypto';
import { ValidationError, NotFoundError } from '../../../../shared/errors/AppError';

export class CategoriaRepository implements ICategoriaRepository {
  private mapRow(row: Record<string, unknown>): Categoria {
    const activaRaw = row['ES_VIGENTE'] ?? row['es_vigente'];
    const activa = activaRaw === undefined || activaRaw === null ? true : Boolean(activaRaw);
    return new Categoria(
      String(r(row, 'ID_CATEGORIA', 'id_categoria')),
      String(r(row, 'CO_CATEGORIA', 'co_categoria')),
      String(r(row, 'DE_CATEGORIA', 'de_categoria')),
      r(row, 'FE_CREACION', 'fe_creacion') as Date,
      activa
    );
  }

  async findAll(): Promise<Categoria[]> {
    return this.findAllActivas();
  }

  async findAllActivas(): Promise<Categoria[]> {
    const result = await query(
      `SELECT * FROM dbo.NASTM_CATEGORIAS
       WHERE ES_VIGENTE = 1 OR ES_VIGENTE IS NULL
       ORDER BY CO_CATEGORIA`,
      []
    );
    return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  async findAllConUso(incluirInactivas: boolean): Promise<CategoriaConUso[]> {
    const sql =
      `SELECT c.*,
        (SELECT COUNT(*) FROM dbo.NASTD_USUARIO_CATEGORIAS uc WHERE uc.ID_CATEGORIA = c.ID_CATEGORIA) AS usuarios_asignados,
        (SELECT COUNT(*) FROM dbo.NASTM_ARCHIVOS a
         WHERE a.FE_BAJA IS NULL
           AND (
             REPLACE(a.DE_RUTA_FISICA, '\', '/') LIKE c.CO_CATEGORIA + '/%'
             OR (
               a.DE_RUTAS_ESPEJO IS NOT NULL
               AND REPLACE(CAST(a.DE_RUTAS_ESPEJO AS NVARCHAR(MAX)), '\', '/')
                 LIKE N'%"' + c.CO_CATEGORIA + '/%'
             )
           )
        ) AS archivos_asignados
       FROM dbo.NASTM_CATEGORIAS c` +
      (incluirInactivas ? '' : ' WHERE c.ES_VIGENTE = 1 OR c.ES_VIGENTE IS NULL') +
      ' ORDER BY c.CO_CATEGORIA';

    const result = await query(sql, []);
    return result.rows.map((row) => {
      const cat = this.mapRow(row as Record<string, unknown>);
      const raw = row as Record<string, unknown>;
      return Object.assign(cat, {
        usuariosAsignados: parseInt(String(raw.usuarios_asignados ?? raw.USUARIOS_ASIGNADOS ?? 0), 10),
        archivosAsignados: parseInt(String(raw.archivos_asignados ?? raw.ARCHIVOS_ASIGNADOS ?? 0), 10),
      }) as CategoriaConUso;
    });
  }

  async findById(id: string): Promise<Categoria | null> {
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS WHERE ID_CATEGORIA = $1', [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async findByCodigo(codigo: string): Promise<Categoria | null> {
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS WHERE CO_CATEGORIA = $1', [
      codigo.toUpperCase().trim(),
    ]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(codigo: string, descripcion: string): Promise<Categoria> {
    const co = codigo.toUpperCase().trim();
    const existing = await this.findByCodigo(co);
    if (existing) {
      throw new ValidationError(`Ya existe una categoría con código ${co}`);
    }
    const id = randomUUID();
    await query(
      `INSERT INTO dbo.NASTM_CATEGORIAS (ID_CATEGORIA, CO_CATEGORIA, DE_CATEGORIA, ES_VIGENTE)
       VALUES ($1, $2, $3, 1)`,
      [id, co, descripcion.trim()]
    );
    const result = await query('SELECT * FROM dbo.NASTM_CATEGORIAS WHERE ID_CATEGORIA = $1', [id]);
    const cat = this.mapRow(result.rows[0] as Record<string, unknown>);
    await this.assignToAllAdminUsers(cat.id);
    return cat;
  }

  async updateDescripcion(id: string, descripcion: string): Promise<Categoria> {
    const desc = descripcion.trim();
    if (!desc) throw new ValidationError('La descripción es obligatoria');
    const cat = await this.findById(id);
    if (!cat) throw new NotFoundError('Categoría no encontrada');
    await query('UPDATE dbo.NASTM_CATEGORIAS SET DE_CATEGORIA = $2 WHERE ID_CATEGORIA = $1', [id, desc]);
    const updated = await this.findById(id);
    return updated!;
  }

  async inactivar(id: string): Promise<void> {
    const rows = await this.findAllConUso(true);
    const row = rows.find((c) => c.id === id);
    if (!row) throw new NotFoundError('Categoría no encontrada');
    if (!row.activa) throw new ValidationError('La categoría ya está inactiva');
    if (row.archivosAsignados > 0) {
      throw new ValidationError(
        'No se puede inactivar: la categoría tiene archivos en el NAS. Elimine o mueva los archivos antes de inactivarla.'
      );
    }
    await query('UPDATE dbo.NASTM_CATEGORIAS SET ES_VIGENTE = 0 WHERE ID_CATEGORIA = $1', [id]);
  }

  async reactivar(id: string): Promise<void> {
    const cat = await this.findById(id);
    if (!cat) throw new NotFoundError('Categoría no encontrada');
    await query('UPDATE dbo.NASTM_CATEGORIAS SET ES_VIGENTE = 1 WHERE ID_CATEGORIA = $1', [id]);
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
