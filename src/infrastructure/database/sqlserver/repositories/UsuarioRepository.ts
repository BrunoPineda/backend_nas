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
      [],
      r(row, 'NU_DNI', 'nu_dni') as string | null,
      r(row, 'AP_PATERNO', 'ap_paterno') as string | null,
      r(row, 'AP_MATERNO', 'ap_materno') as string | null,
      r(row, 'NO_USUARIO', 'no_usuario') as string | null,
      r(row, 'NU_TELEFONO', 'nu_telefono') as string | null,
      r(row, 'NU_NUMERO_DOCUMENTO', 'nu_numero_documento') as string | null
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
      ids,
      u.dni,
      u.apellidoPaterno,
      u.apellidoMaterno,
      u.username,
      u.telefono,
      u.numeroDocumento
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

  async syncCategoriaIds(idUsuario: string, categoriaIds: string[]): Promise<void> {
    const unique = [...new Set(categoriaIds.filter(Boolean))];
    await this.replaceCategorias(idUsuario, unique);
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

  async findByDni(dni: string): Promise<Usuario | null> {
    const result = await query(
      'SELECT * FROM dbo.NASTM_USUARIOS WHERE (NU_DNI = $1 OR NU_NUMERO_DOCUMENTO = $1) AND ES_VIGENTE = 1',
      [dni]
    );
    if (result.rows.length === 0) return null;
    const u = this.mapRowBase(result.rows[0] as Record<string, unknown>);
    return this.withCategorias(u);
  }

  async findByDocumentoAdmin(documento: string): Promise<Usuario | null> {
    const doc = documento.trim();
    const result = await query(
      'SELECT * FROM dbo.NASTM_USUARIOS WHERE NU_DNI = $1 OR NU_NUMERO_DOCUMENTO = $1',
      [doc]
    );
    if (result.rows.length === 0) return null;
    const u = this.mapRowBase(result.rows[0] as Record<string, unknown>);
    return this.withCategorias(u);
  }

  async findByDocumentos(documentos: string[]): Promise<Map<string, Usuario>> {
    const docs = [...new Set(documentos.map((d) => d.trim()).filter(Boolean))];
    const map = new Map<string, Usuario>();
    if (docs.length === 0) return map;

    const placeholders = docs.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `SELECT * FROM dbo.NASTM_USUARIOS
       WHERE NU_DNI IN (${placeholders}) OR NU_NUMERO_DOCUMENTO IN (${placeholders})`,
      [...docs, ...docs]
    );

    for (const row of result.rows) {
      const u = this.mapRowBase(row as Record<string, unknown>);
      const full = await this.withCategorias(u);
      const doc = (full.numeroDocumento || full.dni || '').trim();
      if (doc) map.set(doc, full);
    }
    return map;
  }

  async findAll(): Promise<Usuario[]> {
    const result = await query('SELECT * FROM dbo.NASTM_USUARIOS ORDER BY FE_CREACION DESC', []);
    const usuarios = result.rows.map((row) => this.mapRowBase(row as Record<string, unknown>));
    return Promise.all(usuarios.map((u) => this.withCategorias(u)));
  }

  async findPaginated(options: {
    page: number;
    limit: number;
    nombre?: string;
    numeroDocumento?: string;
    email?: string;
  }): Promise<{ rows: Usuario[]; total: number }> {
    const { page, limit, nombre, numeroDocumento, email } = options;
    const offset = (page - 1) * limit;

    let whereClause = '1 = 1';
    const params: unknown[] = [];
    let paramCounter = 1;

    if (nombre && nombre.trim() !== '') {
      whereClause += ` AND NO_COMPLETO LIKE $${paramCounter}`;
      params.push(`%${nombre.trim()}%`);
      paramCounter++;
    }

    if (numeroDocumento && numeroDocumento.trim() !== '') {
      whereClause += ` AND (NU_NUMERO_DOCUMENTO LIKE $${paramCounter} OR NU_DNI LIKE $${paramCounter})`;
      params.push(`%${numeroDocumento.trim()}%`);
      paramCounter++;
    }

    if (email && email.trim() !== '') {
      whereClause += ` AND DI_CORREO LIKE $${paramCounter}`;
      params.push(`%${email.trim()}%`);
      paramCounter++;
    }

    // 1. Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM dbo.NASTM_USUARIOS WHERE ${whereClause}`,
      params
    );
    const total = parseInt(String(countResult.rows[0]?.total || 0), 10);

    // 2. Fetch paginated users
    const paginatedParams = [...params];
    paginatedParams.push(offset);
    const offsetParamIndex = paramCounter++;
    
    paginatedParams.push(limit);
    const limitParamIndex = paramCounter++;

    const sql = `
      SELECT * FROM dbo.NASTM_USUARIOS
      WHERE ${whereClause}
      ORDER BY FE_CREACION DESC
      OFFSET $${offsetParamIndex} ROWS
      FETCH NEXT $${limitParamIndex} ROWS ONLY
    `;

    const result = await query(sql, paginatedParams);
    const usuarios = result.rows.map((row) => this.mapRowBase(row as Record<string, unknown>));
    const rows = await Promise.all(usuarios.map((u) => this.withCategorias(u)));

    return { rows, total };
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

  async recordIntranetLogin(idUsuario: string, activo: boolean): Promise<void> {
    const ahora = new Date();
    await query(
      `UPDATE dbo.NASTM_USUARIOS SET
        FE_ULTIMO_LOGIN = $2,
        FE_ACTUALIZACION = $2,
        ES_VIGENTE = $3
      WHERE ID_USUARIO = $1`,
      [idUsuario, ahora, activo]
    );
  }

  async updateNasAdminConfig(
    idUsuario: string,
    config: {
      idRol: string | null;
      limiteAlmacenamientoBytes: number;
      maxTamanoArchivoBytes: number;
      esPrivado: boolean;
      categoriaIds: string[];
    }
  ): Promise<Usuario> {
    const ahora = new Date();
    await query(
      `UPDATE dbo.NASTM_USUARIOS SET
        ID_ROL = $2,
        IN_ES_PRIVADO = $3,
        CA_LIMITE_ALMACENAMIENTO_BYTES = $4,
        CA_MAX_ARCHIVO_BYTES = $5,
        FE_ACTUALIZACION = $6
      WHERE ID_USUARIO = $1`,
      [
        idUsuario,
        config.idRol,
        config.esPrivado,
        config.limiteAlmacenamientoBytes,
        config.maxTamanoArchivoBytes,
        ahora,
      ]
    );
    await this.replaceCategorias(idUsuario, config.categoriaIds);
    const reloaded = await this.findById(idUsuario);
    if (!reloaded) {
      throw new Error('Usuario NAS no encontrado tras actualizar configuración');
    }
    return reloaded;
  }

  async save(usuario: Usuario): Promise<Usuario> {
    const primerNombre = usuario.nombre.split(' ')[0] || '';
    const numDoc = usuario.numeroDocumento || usuario.dni || '';
    await query(
      `INSERT INTO dbo.NASTM_USUARIOS (
        ID_USUARIO, NO_COMPLETO, DI_CORREO, CO_PASSWORD_HASH, ID_ROL, ES_VIGENTE, IN_ES_PRIVADO,
        CA_LIMITE_ALMACENAMIENTO_BYTES, CA_MAX_ARCHIVO_BYTES, FE_CREACION, FE_ACTUALIZACION,
        NU_DNI, NO_NOMBRE, AP_PATERNO, AP_MATERNO, NO_USUARIO, NU_TELEFONO, NU_NUMERO_DOCUMENTO
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
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
        usuario.dni || numDoc,
        primerNombre,
        usuario.apellidoPaterno,
        usuario.apellidoMaterno,
        usuario.username,
        usuario.telefono,
        numDoc
      ]
    );
    await this.replaceCategorias(usuario.id, usuario.categoriaIds);
    const reloaded = await this.findById(usuario.id);
    return reloaded!;
  }

  async update(usuario: Usuario): Promise<Usuario> {
    const primerNombre = usuario.nombre.split(' ')[0] || '';
    const numDoc = usuario.numeroDocumento || usuario.dni || '';
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
        FE_ACTUALIZACION = $11,
        NU_DNI = $12,
        NO_NOMBRE = $13,
        AP_PATERNO = $14,
        AP_MATERNO = $15,
        NO_USUARIO = $16,
        NU_TELEFONO = $17,
        NU_NUMERO_DOCUMENTO = $18
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
        usuario.dni || numDoc,
        primerNombre,
        usuario.apellidoPaterno,
        usuario.apellidoMaterno,
        usuario.username,
        usuario.telefono,
        numDoc
      ]
    );
    await this.replaceCategorias(usuario.id, usuario.categoriaIds);
    const reloaded = await this.findById(usuario.id);
    return reloaded!;
  }
}
