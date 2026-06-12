import { queryUserDb, intranetTable, viaticoTable, useIntranetUserDatabase } from '../connection';
import { sqlFiltroRolNasIntranet } from '../../../../shared/constants/nasRoles';

export type IntranetUsuario = {
  iId: number;
  codUsuario: string;
  email: string | null;
  fullname: string | null;
  usuario: string | null;
  password: Buffer | null;
  bEstado: boolean;
  iRolLegacy: number | null;
  /** Clave encriptada Sicontigo (VIATICO.tbl_mst_usuario.vClave) */
  vClave: string | null;
};

export type IntranetRolAsignado = {
  iIdRole: number;
  vNombre: string;
  vDescripcion: string | null;
};

export class IntranetAuthRepository {
  /** Solo consultas SELECT sobre BDJUNTOS. El módulo NAS no modifica Intranet. */
  isEnabled(): boolean {
    return useIntranetUserDatabase();
  }

  async findByLogin(login: string): Promise<IntranetUsuario | null> {
    if (!this.isEnabled()) return null;
    const t = intranetTable('tbl_mst_usuarios');
    const loginTrim = login.trim();
    const result = await queryUserDb(
      `SELECT iId, codUsuario, email, fullname, usuario, password, bEstado, iRol
       FROM ${t}
       WHERE email = $1 OR usuario = $1 OR codUsuario = $1`,
      [loginTrim]
    );
    if (result.rows.length === 0) return null;
    const user = this.mapUsuario(result.rows[0] as Record<string, unknown>);
    user.vClave = await this.fetchVClaveByLogin(loginTrim);
    return user;
  }

  async findByCodUsuario(codUsuario: string): Promise<IntranetUsuario | null> {
    if (!this.isEnabled()) return null;
    const t = intranetTable('tbl_mst_usuarios');
    const result = await queryUserDb(
      `SELECT iId, codUsuario, email, fullname, usuario, password, bEstado, iRol
       FROM ${t}
       WHERE codUsuario = $1`,
      [codUsuario.trim()]
    );
    if (result.rows.length === 0) return null;
    const user = this.mapUsuario(result.rows[0] as Record<string, unknown>);
    user.vClave = await this.fetchVClaveByLogin(codUsuario.trim());
    return user;
  }

  /**
   * Credencial legacy en VIATICO.tbl_mst_usuario (Sicontigo vClave).
   * WHERE vCodPersonal = login OR vUsuario = login
   */
  private async fetchVClaveByLogin(login: string): Promise<string | null> {
    const t = viaticoTable('tbl_mst_usuario');
    const id = login.trim();
    if (!id) return null;

    const result = await queryUserDb(
      `SELECT TOP 1 vCodPersonal, vUsuario, vClave, vActivo, iReset
       FROM ${t}
       WHERE (vCodPersonal = $1 OR vUsuario = $1)
         AND vActivo = N'SI'
       ORDER BY iIdCodClave DESC`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    const clave = row.vClave ?? row.VCLAVE;
    return clave != null ? String(clave).trim() : null;
  }

  async findUsuariosPaginated(options: {
    page: number;
    limit: number;
    nombre?: string;
    numeroDocumento?: string;
    email?: string;
  }): Promise<{ rows: IntranetUsuario[]; total: number }> {
    if (!this.isEnabled()) return { rows: [], total: 0 };
    const { page, limit, nombre, numeroDocumento, email } = options;
    const offset = (page - 1) * limit;
    const t = intranetTable('tbl_mst_usuarios');
    const tUr = intranetTable('tbl_ctrl_usuario_role');
    const tR = intranetTable('tbl_ctrl_usuarios_rol');
    const filtroNas = sqlFiltroRolNasIntranet('ur', 'r');

    let whereClause = `EXISTS (
      SELECT 1
      FROM ${tUr} AS ur
      INNER JOIN ${tR} AS r ON r.iId = ur.iIdRole
      WHERE ur.codUsuario = u.codUsuario
        AND ur.bEstado = 1
        AND ${filtroNas}
    )`;
    const params: unknown[] = [];
    let n = 1;

    if (nombre?.trim()) {
      whereClause += ` AND u.fullname LIKE $${n}`;
      params.push(`%${nombre.trim()}%`);
      n++;
    }
    if (numeroDocumento?.trim()) {
      whereClause += ` AND (u.codUsuario LIKE $${n} OR u.usuario LIKE $${n})`;
      params.push(`%${numeroDocumento.trim()}%`);
      n++;
    }
    if (email?.trim()) {
      whereClause += ` AND u.email LIKE $${n}`;
      params.push(`%${email.trim()}%`);
      n++;
    }

    const countResult = await queryUserDb(
      `SELECT COUNT(*) AS total FROM ${t} AS u WHERE ${whereClause}`,
      params
    );
    const total = Number((countResult.rows[0] as Record<string, unknown>)?.total ?? 0);

    const offsetIdx = n++;
    const limitIdx = n++;
    const listParams = [...params, offset, limit];
    const result = await queryUserDb(
      `SELECT u.iId, u.codUsuario, u.email, u.fullname, u.usuario, u.password, u.bEstado, u.iRol
       FROM ${t} AS u
       WHERE ${whereClause}
       ORDER BY u.fullname ASC, u.codUsuario ASC
       OFFSET $${offsetIdx} ROWS FETCH NEXT $${limitIdx} ROWS ONLY`,
      listParams
    );

    return {
      rows: result.rows.map((row) => this.mapUsuario(row as Record<string, unknown>)),
      total,
    };
  }

  /** Roles NAS activos de varios usuarios (admin listado). */
  async listRolesNasActivosBatch(codUsuarios: string[]): Promise<Map<string, IntranetRolAsignado[]>> {
    const map = new Map<string, IntranetRolAsignado[]>();
    const docs = [...new Set(codUsuarios.map((c) => c.trim()).filter(Boolean))];
    if (!this.isEnabled() || docs.length === 0) return map;

    const tUr = intranetTable('tbl_ctrl_usuario_role');
    const tR = intranetTable('tbl_ctrl_usuarios_rol');
    const filtroNas = sqlFiltroRolNasIntranet('ur', 'r');
    const placeholders = docs.map((_, i) => `$${i + 1}`).join(', ');
    const result = await queryUserDb(
      `SELECT ur.codUsuario, ur.iIdRole, r.vNombre, r.vDescripcion
       FROM ${tUr} AS ur
       INNER JOIN ${tR} AS r ON r.iId = ur.iIdRole
       WHERE ur.codUsuario IN (${placeholders})
         AND ur.bEstado = 1
         AND ${filtroNas}
       ORDER BY ur.codUsuario, ur.iIdRole`,
      docs
    );

    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const cod = String(r.codUsuario ?? r.CODUSUARIO ?? '').trim();
      if (!cod) continue;
      const rol: IntranetRolAsignado = {
        iIdRole: Number(r.iIdRole ?? r.IIDROLE ?? 0),
        vNombre: String(r.vNombre ?? r.VNOMBRE ?? ''),
        vDescripcion: (r.vDescripcion ?? r.VDESCRIPCION ?? null) as string | null,
      };
      const list = map.get(cod) ?? [];
      list.push(rol);
      map.set(cod, list);
    }
    return map;
  }

  async listRolesNasActivos(codUsuario: string): Promise<IntranetRolAsignado[]> {
    if (!this.isEnabled()) return [];
    const tUr = intranetTable('tbl_ctrl_usuario_role');
    const tR = intranetTable('tbl_ctrl_usuarios_rol');
    const result = await queryUserDb(
      `SELECT ur.iIdRole, r.vNombre, r.vDescripcion
       FROM ${tUr} AS ur
       INNER JOIN ${tR} AS r ON r.iId = ur.iIdRole
       WHERE ur.codUsuario = $1
         AND ur.bEstado = 1
         AND ur.iIdRole BETWEEN 1072 AND 1080
       ORDER BY ur.iIdRole`,
      [codUsuario.trim()]
    );
    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        iIdRole: Number(r.iIdRole ?? r.IIDROLE ?? 0),
        vNombre: String(r.vNombre ?? r.VNOMBRE ?? ''),
        vDescripcion: (r.vDescripcion ?? r.VDESCRIPCION ?? null) as string | null,
      };
    });
  }

  /** Catálogo roles NAS en BDJUNTOS (COD 1072–1080): vNombre + vDescripcion. */
  async listRolesNasCatalogMap(): Promise<Map<number, IntranetRolAsignado>> {
    const map = new Map<number, IntranetRolAsignado>();
    if (!this.isEnabled()) return map;

    const tR = intranetTable('tbl_ctrl_usuarios_rol');
    const result = await queryUserDb(
      `SELECT r.iId, r.vNombre, r.vDescripcion
       FROM ${tR} AS r
       WHERE r.iId BETWEEN 1072 AND 1080
       ORDER BY r.iId`,
      []
    );

    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const iId = Number(r.iId ?? r.IID ?? 0);
      if (!iId) continue;
      map.set(iId, {
        iIdRole: iId,
        vNombre: String(r.vNombre ?? r.VNOMBRE ?? ''),
        vDescripcion: (r.vDescripcion ?? r.VDESCRIPCION ?? null) as string | null,
      });
    }
    return map;
  }

  private mapUsuario(row: Record<string, unknown>): IntranetUsuario {
    const pwd = row.password ?? row.PASSWORD;
    return {
      iId: Number(row.iId ?? row.IID ?? 0),
      codUsuario: String(row.codUsuario ?? row.CODUSUARIO ?? ''),
      email: (row.email ?? row.EMAIL ?? null) as string | null,
      fullname: (row.fullname ?? row.FULLNAME ?? null) as string | null,
      usuario: (row.usuario ?? row.USUARIO ?? null) as string | null,
      password: Buffer.isBuffer(pwd) ? pwd : pwd != null ? Buffer.from(String(pwd)) : null,
      bEstado: Boolean(row.bEstado ?? row.BESTADO ?? false),
      iRolLegacy: row.iRol != null || row.IROL != null ? Number(row.iRol ?? row.IROL) : null,
      vClave: null,
    };
  }
}
