import { query } from '../../infrastructure/database/sqlserver/connection';
import {
  IntranetAuthRepository,
  type IntranetRolAsignado,
} from '../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import {
  NAS_INTRANET_ROLE_ID_MIN,
  NAS_INTRANET_ROLE_ID_MAX,
  rolNasDisplayLabel,
} from '../../shared/constants/nasRoles';

/** Único rol con permisos de administrador NAS: 00 UTI - Admin NAS (COD 1072). */
const NAS_ADMIN_INTRANET_ID = 1072;

export type NasRolResuelto = {
  idRolNas: string;
  noRol: string;
  iIdRolIntranet: number;
  vNombreIntranet: string;
};

export class IntranetPermissionService {
  constructor(
    private intranetAuth = new IntranetAuthRepository()
  ) {}

  async resolveNasRolesFromIntranet(codUsuario: string): Promise<NasRolResuelto[]> {
    const asignados = await this.intranetAuth.listRolesNasActivos(codUsuario);
    if (asignados.length === 0) return [];

    const ids = asignados.map((r) => r.iIdRole);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `SELECT ID_ROL, NO_ROL, NU_ID_ROL_INTRANET
       FROM dbo.NASTM_ROLES
       WHERE NU_ID_ROL_INTRANET IN (${placeholders})`,
      ids
    );

    const byIntranetId = new Map<number, { idRolNas: string; noRol: string }>();
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const nu = Number(r.NU_ID_ROL_INTRANET ?? r.nu_id_rol_intranet);
      byIntranetId.set(nu, {
        idRolNas: String(r.ID_ROL ?? r.id_rol),
        noRol: String(r.NO_ROL ?? r.no_rol),
      });
    }

    const resolved: NasRolResuelto[] = [];
    for (const a of asignados) {
      const nas = byIntranetId.get(a.iIdRole);
      if (nas) {
        resolved.push({
          idRolNas: nas.idRolNas,
          noRol: nas.noRol,
          iIdRolIntranet: a.iIdRole,
          vNombreIntranet: a.vNombre,
        });
      }
    }

    return resolved;
  }

  /** Roles efectivos para permisos/categorías: admin → solo NAS_ADMIN; si no, todos los NAS operativos. */
  async resolveAccessRoles(codUsuario: string): Promise<NasRolResuelto[]> {
    const asignados = await this.intranetAuth.listRolesNasActivos(codUsuario);
    const resolved = await this.resolveNasRolesFromIntranet(codUsuario);
    if (resolved.length === 0) return [];

    if (this.isNasAdminFromRoles(asignados)) {
      const admin =
        resolved.find((r) => r.iIdRolIntranet === NAS_ADMIN_INTRANET_ID) ??
        resolved.find((r) => r.noRol === 'NAS_ADMIN');
      if (admin) return [admin];
      const adminNas = await this.fetchNasAdminRol();
      if (adminNas) {
        return [
          {
            idRolNas: adminNas.idRolNas,
            noRol: adminNas.noRol,
            iIdRolIntranet: NAS_ADMIN_INTRANET_ID,
            vNombreIntranet: 'Admin NAS',
          },
        ];
      }
    }

    return resolved.filter(
      (r) =>
        r.iIdRolIntranet >= NAS_INTRANET_ROLE_ID_MIN &&
        r.iIdRolIntranet <= NAS_INTRANET_ROLE_ID_MAX &&
        r.iIdRolIntranet !== NAS_ADMIN_INTRANET_ID
    );
  }

  /** Unidades visibles según roles BDJUNTOS + matriz roles×categorías. Admin → todas. */
  async resolveEffectiveCategoryIds(codUsuario: string): Promise<string[]> {
    const asignados = await this.intranetAuth.listRolesNasActivos(codUsuario);
    if (asignados.length === 0) return [];

    if (this.isNasAdminFromRoles(asignados)) {
      const result = await query(
        `SELECT ID_CATEGORIA FROM dbo.NASTM_CATEGORIAS
         WHERE ES_VIGENTE = 1 OR ES_VIGENTE IS NULL`
      );
      return result.rows.map((row) =>
        String((row as Record<string, unknown>).ID_CATEGORIA ?? (row as Record<string, unknown>).id_categoria)
      );
    }

    const accessRoles = await this.resolveAccessRoles(codUsuario);
    const idRolesNas = [...new Set(accessRoles.map((r) => r.idRolNas).filter(Boolean))];
    const catIds = new Set<string>();

    if (idRolesNas.length > 0) {
      const placeholders = idRolesNas.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `SELECT DISTINCT rc.ID_CATEGORIA AS id
         FROM dbo.NASTD_ROLES_CATEGORIAS AS rc
         INNER JOIN dbo.NASTM_CATEGORIAS AS c ON c.ID_CATEGORIA = rc.ID_CATEGORIA
         WHERE rc.ID_ROL IN (${placeholders})
           AND (c.ES_VIGENTE = 1 OR c.ES_VIGENTE IS NULL)`,
        idRolesNas
      );
      for (const row of result.rows) {
        const id = String((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).ID_CATEGORIA);
        if (id) catIds.add(id);
      }
    }

    // Respaldo: NAS_UAS → categoría UAS si la matriz aún no tiene filas
    for (const rol of accessRoles) {
      if (rol.noRol.startsWith('NAS_') && rol.noRol !== 'NAS_ADMIN') {
        const cod = rol.noRol.replace(/^NAS_/, '');
        const fb = await query(
          `SELECT TOP 1 ID_CATEGORIA FROM dbo.NASTM_CATEGORIAS
           WHERE CO_CATEGORIA = $1 AND (ES_VIGENTE = 1 OR ES_VIGENTE IS NULL)`,
          [cod]
        );
        if (fb.rows.length > 0) {
          const id = String((fb.rows[0] as Record<string, unknown>).ID_CATEGORIA);
          if (id) catIds.add(id);
        }
      }
    }

    return [...catIds];
  }

  async listCodigosPermisoByCodUsuario(codUsuario: string): Promise<string[]> {
    const accessRoles = await this.resolveAccessRoles(codUsuario);
    if (accessRoles.length === 0) return [];

    const idRoles = accessRoles.map((r) => r.idRolNas);
    const placeholders = idRoles.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `SELECT DISTINCT p.CO_PERMISO AS codigo
       FROM dbo.NASTD_ROLES_PERMISOS AS rp
       INNER JOIN dbo.NASTM_PERMISOS AS p ON p.ID_PERMISO = rp.ID_PERMISO
       WHERE rp.ID_ROL IN (${placeholders})
       ORDER BY p.CO_PERMISO`,
      idRoles
    );
    return result.rows.map((row) =>
      String((row as Record<string, unknown>).codigo ?? (row as Record<string, unknown>).CO_PERMISO)
    );
  }

  async usuarioTieneCodigoPermiso(codUsuario: string, codigoPermiso: string): Promise<boolean> {
    const permisos = await this.listCodigosPermisoByCodUsuario(codUsuario);
    return permisos.includes(codigoPermiso);
  }

  /** Solo COD 1072 (00 UTI - Admin NAS) es administrador del módulo. */
  isNasAdminFromRoles(roles: IntranetRolAsignado[] | NasRolResuelto[]): boolean {
    return roles.some((r) => {
      const id = 'iIdRole' in r ? r.iIdRole : r.iIdRolIntranet;
      return id === NAS_ADMIN_INTRANET_ID;
    });
  }

  private async fetchNasAdminRol(): Promise<{ idRolNas: string; noRol: string } | null> {
    const result = await query(
      `SELECT TOP 1 ID_ROL, NO_ROL FROM dbo.NASTM_ROLES WHERE NO_ROL = N'NAS_ADMIN'`
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      idRolNas: String(row.ID_ROL ?? row.id_rol),
      noRol: String(row.NO_ROL ?? row.no_rol),
    };
  }

  async jwtRolLabel(codUsuario: string): Promise<string> {
    const intranetRoles = await this.intranetAuth.listRolesNasActivos(codUsuario);
    if (this.isNasAdminFromRoles(intranetRoles)) return 'ADMIN';
    const nas = await this.resolveNasRolesFromIntranet(codUsuario);
    if (nas.length > 0) return nas[0].noRol;
    return 'USER';
  }

  /** Etiqueta visible en UI (p. ej. "1076 — 00 UTI - NAS" o "1072 — 00 UTI - Admin NAS"). */
  async jwtRolDisplayLabel(codUsuario: string): Promise<string> {
    const intranetRoles = await this.intranetAuth.listRolesNasActivos(codUsuario);

    if (this.isNasAdminFromRoles(intranetRoles)) {
      const adminNas = intranetRoles.find((r) => r.iIdRole === NAS_ADMIN_INTRANET_ID);
      if (adminNas) {
        return rolNasDisplayLabel(NAS_ADMIN_INTRANET_ID, adminNas.vNombre, 'NAS_ADMIN');
      }
    }

    const nasOps = intranetRoles
      .filter(
        (r) =>
          r.iIdRole >= NAS_INTRANET_ROLE_ID_MIN &&
          r.iIdRole <= NAS_INTRANET_ROLE_ID_MAX &&
          r.iIdRole !== NAS_ADMIN_INTRANET_ID
      )
      .sort((a, b) => a.iIdRole - b.iIdRole);

    if (nasOps.length > 0) {
      return nasOps
        .map((r) => rolNasDisplayLabel(r.iIdRole, r.vNombre, ''))
        .join(', ');
    }

    return 'USER';
  }

  /** Rol NAS inicial en DB_NAS: solo roles Intranet 1072–1080. */
  async primaryNasRolId(codUsuario: string): Promise<string | null> {
    const asignados = await this.intranetAuth.listRolesNasActivos(codUsuario);
    const nasOperativos = asignados.filter(
      (a) => a.iIdRole >= NAS_INTRANET_ROLE_ID_MIN && a.iIdRole <= NAS_INTRANET_ROLE_ID_MAX
    );

    if (nasOperativos.length > 0) {
      const ids = nasOperativos.map((a) => a.iIdRole);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `SELECT ID_ROL, NO_ROL, NU_ID_ROL_INTRANET
         FROM dbo.NASTM_ROLES
         WHERE NU_ID_ROL_INTRANET IN (${placeholders})`,
        ids
      );
      const byIntranetId = new Map<number, string>();
      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        byIntranetId.set(
          Number(r.NU_ID_ROL_INTRANET ?? r.nu_id_rol_intranet),
          String(r.ID_ROL ?? r.id_rol)
        );
      }
      const adminOp = nasOperativos.find((a) => a.iIdRole === NAS_ADMIN_INTRANET_ID);
      const target = adminOp ?? nasOperativos[0];
      return byIntranetId.get(target.iIdRole) ?? null;
    }

    return null;
  }
}
