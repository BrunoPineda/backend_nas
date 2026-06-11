import { IUsuarioRepository } from '../../../../domain/repositories/IUsuarioRepository';
import { Usuario } from '../../../../domain/entities/Usuario';
import { query } from '../connection';
import { r } from '../column';

export class UsuarioRepository implements IUsuarioRepository {
  private mapRowBase(row: Record<string, unknown>): Usuario {
    return new Usuario(
      String(r(row, 'ID_USUARIO', 'id_usuario')),
      String(r(row, 'NO_COMPLETO', 'no_completo')),
      String(r(row, 'DI_CORREO', 'di_correo')),
      String(r(row, 'CO_PASSWORD_HASH', 'co_password_hash')),
      r(row, 'ID_ROL', 'id_rol') as string | null,
      Boolean(r(row, 'ES_VIGENTE', 'es_vigente')),
      parseInt(String(r(row, 'CA_LIMITE_ALMACENAMIENTO_BYTES', 'ca_limite_almacenamiento_bytes')), 10),
      parseInt(String(r(row, 'CA_MAX_ARCHIVO_BYTES', 'ca_max_archivo_bytes')), 10),
      r(row, 'FE_CREACION', 'fe_creacion', 'created_at') as Date,
      r(row, 'FE_ACTUALIZACION', 'fe_actualizacion', 'updated_at') as Date,
      (r(row, 'FE_ULTIMO_LOGIN', 'fe_ultimo_login', 'last_login_at') as Date) ?? null,
      Boolean(r(row, 'IN_ES_PRIVADO', 'in_es_privado')),
      []
    );
  }

  private async withCategorias(u: Usuario): Promise<Usuario> {
    const ids = await this.fetchCategoriaIds(u.id);
    return new Usuario(
      u.id,
      u.nombre,
      u.email,
      u.passwordHash,
      u.idRol,
      u.activo,
      u.limiteAlmacenamientoBytes,
      u.maxTamanoArchivoBytes,
      u.createdAt,
      u.updatedAt,
      u.lastLoginAt,
      u.esPrivado,
      ids
    );
  }

  private async fetchCategoriaIds(idUsuario: string): Promise<string[]> {
    const result = await query(
      'SELECT ID_CATEGORIA FROM dbo.NASTD_USUARIO_CATEGORIAS WHERE ID_USUARIO = $1',
      [idUsuario]
    );
    return result.rows.map((row) =>
      String(r(row as Record<string, unknown>, 'ID_CATEGORIA', 'id_categoria'))
    );
  }

  private async replaceCategorias(idUsuario: string, categoriaIds: string[]): Promise<void> {
    await query('DELETE FROM dbo.NASTD_USUARIO_CATEGORIAS WHERE ID_USUARIO = $1', [idUsuario]);
    for (const cid of categoriaIds) {
      await query(
        'INSERT INTO dbo.NASTD_USUARIO_CATEGORIAS (ID_USUARIO, ID_CATEGORIA) VALUES ($1, $2)',
        [idUsuario, cid]
      );
    }
  }

  async compartenCategoria(idUsuarioA: string, idUsuarioB: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 AS ok
       FROM dbo.NASTD_USUARIO_CATEGORIAS a
       INNER JOIN dbo.NASTD_USUARIO_CATEGORIAS b
         ON a.ID_CATEGORIA = b.ID_CATEGORIA
       WHERE a.ID_USUARIO = $1 AND b.ID_USUARIO = $2`,
      [idUsuarioA, idUsuarioB]
    );
    return result.rows.length > 0;
  }

  /** Asegura que un usuario ADMIN tenga filas para todas las categorías existentes. */
  async syncTodasCategoriasParaAdmin(idUsuario: string): Promise<void> {
    await query(
      `INSERT INTO dbo.NASTD_USUARIO_CATEGORIAS (ID_USUARIO, ID_CATEGORIA)
       SELECT $1, c.ID_CATEGORIA
       FROM dbo.NASTM_CATEGORIAS c
       WHERE NOT EXISTS (
         SELECT 1 FROM dbo.NASTD_USUARIO_CATEGORIAS x
         WHERE x.ID_USUARIO = $1 AND x.ID_CATEGORIA = c.ID_CATEGORIA
       )`,
      [idUsuario]
    );
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_USUARIOS WHERE DI_CORREO = $1 AND ES_VIGENTE = 1',
      [email]
    );
    if (result.rows.length === 0) return null;
    const u = this.mapRowBase(result.rows[0] as Record<string, unknown>);
    return this.withCategorias(u);
  }

  async findAll(): Promise<Usuario[]> {
    const result = await query('SELECT * FROM dbo.NASTM_USUARIOS ORDER BY FE_CREACION DESC', []);
    const usuarios = result.rows.map((row) => this.mapRowBase(row as Record<string, unknown>));
    return Promise.all(usuarios.map((u) => this.withCategorias(u)));
  }

  async findById(id: string): Promise<Usuario | null> {
    const result = await query('SELECT * FROM dbo.NASTM_USUARIOS WHERE ID_USUARIO = $1', [id]);
    if (result.rows.length === 0) return null;
    const u = this.mapRowBase(result.rows[0] as Record<string, unknown>);
    return this.withCategorias(u);
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE dbo.NASTM_USUARIOS SET ES_VIGENTE = 0 WHERE ID_USUARIO = $1', [id]);
  }

  async save(usuario: Usuario): Promise<Usuario> {
    await query(
      `INSERT INTO dbo.NASTM_USUARIOS (
        ID_USUARIO, NO_COMPLETO, DI_CORREO, CO_PASSWORD_HASH, ID_ROL, ES_VIGENTE, IN_ES_PRIVADO,
        CA_LIMITE_ALMACENAMIENTO_BYTES, CA_MAX_ARCHIVO_BYTES, FE_CREACION, FE_ACTUALIZACION
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        usuario.id,
        usuario.nombre,
        usuario.email,
        usuario.passwordHash,
        usuario.idRol,
        usuario.activo,
        usuario.esPrivado,
        usuario.limiteAlmacenamientoBytes,
        usuario.maxTamanoArchivoBytes,
        usuario.createdAt,
        usuario.updatedAt,
      ]
    );
    await this.replaceCategorias(usuario.id, usuario.categoriaIds);
    const reloaded = await this.findById(usuario.id);
    return reloaded!;
  }

  async update(usuario: Usuario): Promise<Usuario> {
    await query(
      `UPDATE dbo.NASTM_USUARIOS SET
        NO_COMPLETO = $2,
        DI_CORREO = $3,
        CO_PASSWORD_HASH = $4,
        ID_ROL = $5,
        ES_VIGENTE = $6,
        IN_ES_PRIVADO = $7,
        CA_LIMITE_ALMACENAMIENTO_BYTES = $8,
        CA_MAX_ARCHIVO_BYTES = $9,
        FE_ULTIMO_LOGIN = $10,
        FE_ACTUALIZACION = $11
      WHERE ID_USUARIO = $1`,
      [
        usuario.id,
        usuario.nombre,
        usuario.email,
        usuario.passwordHash,
        usuario.idRol,
        usuario.activo,
        usuario.esPrivado,
        usuario.limiteAlmacenamientoBytes,
        usuario.maxTamanoArchivoBytes,
        usuario.lastLoginAt,
        usuario.updatedAt,
      ]
    );
    await this.replaceCategorias(usuario.id, usuario.categoriaIds);
    const reloaded = await this.findById(usuario.id);
    return reloaded!;
  }
}
