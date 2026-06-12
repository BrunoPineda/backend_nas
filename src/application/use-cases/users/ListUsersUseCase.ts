import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { MIN_USER_STORAGE_BYTES, DEFAULT_MAX_FILE_SIZE_BYTES } from '../../../shared/constants/storageLimits';
import { rolNasDisplayLabel } from '../../../shared/constants/nasRoles';
import type { Usuario } from '../../../domain/entities/Usuario';
import type { Rol } from '../../../domain/entities/Rol';

export class ListUsersUseCase {
  private intranetAuth = new IntranetAuthRepository();

  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository
  ) {}

  async execute(options?: {
    page?: number;
    limit?: number;
    nombre?: string;
    numeroDocumento?: string;
    email?: string;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const { nombre, numeroDocumento, email } = options || {};

    if (useIntranetUserDatabase()) {
      return this.executeFromIntranet({ page, limit, nombre, numeroDocumento, email });
    }

    const { rows: usuarios, total } = await this.usuarioRepository.findPaginated({
      page,
      limit,
      nombre,
      numeroDocumento,
      email,
    });

    return {
      items: await this.mapLocalUsers(usuarios),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      origenIntranet: false,
    };
  }

  private async executeFromIntranet(options: {
    page: number;
    limit: number;
    nombre?: string;
    numeroDocumento?: string;
    email?: string;
  }) {
    const { page, limit, nombre, numeroDocumento, email } = options;
    const { rows: intranetUsers, total } = await this.intranetAuth.findUsuariosPaginated({
      page,
      limit,
      nombre,
      numeroDocumento,
      email,
    });

    const docs = intranetUsers.map((u) => u.codUsuario.trim());
    const shadows = await this.usuarioRepository.findByDocumentos(docs);
    const rolesNasIntranet = await this.intranetAuth.listRolesNasActivosBatch(docs);
    const roles = await this.rolRepository.findNasIntranetRoles();
    const catalog = await this.intranetAuth.listRolesNasCatalogMap();
    const rolesMap = this.buildRoleLabelMap(roles, catalog);
    const cats = await this.categoriaRepository.findAll();
    const catById = new Map(cats.map((c) => [c.id, c]));

    const items = intranetUsers.map((iu) => {
      const doc = iu.codUsuario.trim();
      const shadow = shadows.get(doc);
      const rolesIntranet = rolesNasIntranet.get(doc) ?? [];
      return this.mapIntranetUser(iu, shadow, rolesMap, catById, rolesIntranet);
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      origenIntranet: true,
    };
  }

  private buildRoleLabelMap(
    roles: Rol[],
    catalog: Map<number, { vNombre: string }> = new Map()
  ): Map<string, string> {
    return new Map(
      roles.map((r) => {
        const nombreConecta =
          r.idRolIntranet != null ? catalog.get(r.idRolIntranet)?.vNombre ?? null : null;
        return [r.id, rolNasDisplayLabel(r.idRolIntranet, nombreConecta, r.nombre)];
      })
    );
  }

  private async mapLocalUsers(usuarios: Usuario[]) {
    const roles = await this.rolRepository.findAll();
    const catalog = useIntranetUserDatabase() ? await this.intranetAuth.listRolesNasCatalogMap() : new Map();
    const rolesMap = this.buildRoleLabelMap(roles, catalog);
    const cats = await this.categoriaRepository.findAll();
    const catById = new Map(cats.map((c) => [c.id, c]));

    return usuarios.map((u) => ({
      id: u.id,
      codUsuario: u.numeroDocumento || u.dni || '',
      origenIntranet: false,
      tienePerfilNas: true,
      nombre: u.nombre,
      email: u.email,
      idRol: u.idRol,
      rolNombre: u.idRol ? rolesMap.get(u.idRol) || null : null,
      activo: u.activo,
      limiteAlmacenamientoBytes: u.limiteAlmacenamientoBytes,
      maxTamanoArchivoBytes: u.maxTamanoArchivoBytes,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      esPrivado: u.esPrivado,
      categorias: u.categoriaIds.map((id) => {
        const c = catById.get(id);
        return c
          ? { id: c.id, codigo: c.codigo, descripcion: c.descripcion }
          : { id, codigo: '', descripcion: '' };
      }),
      numeroDocumento: u.numeroDocumento || u.dni || '',
    }));
  }

  private mapIntranetUser(
    iu: { codUsuario: string; email: string | null; fullname: string | null; usuario: string | null; bEstado: boolean },
    shadow: Usuario | undefined,
    rolesMap: Map<string, string>,
    catById: Map<string, { id: string; codigo: string; descripcion: string }>,
    rolesIntranet: { iIdRole: number; vNombre: string }[] = []
  ) {
    const doc = iu.codUsuario.trim();
    const nombre = iu.fullname?.trim() || iu.usuario || doc;
    const email = iu.email?.trim() || `${doc}@intranet.local`;
    const idRol = shadow?.idRol ?? null;
    const rolNasLocal = idRol ? rolesMap.get(idRol) || null : null;
    const rolIntranetLabel =
      rolesIntranet.length > 0 ? rolesIntranet.map((r) => r.vNombre).join(', ') : null;

    return {
      id: shadow?.id ?? doc,
      codUsuario: doc,
      origenIntranet: true,
      tienePerfilNas: Boolean(shadow),
      nombre,
      email,
      idRol,
      rolNombre: rolNasLocal ?? rolIntranetLabel,
      rolesIntranet: rolesIntranet.map((r) => ({ id: r.iIdRole, nombre: r.vNombre })),
      activo: iu.bEstado,
      limiteAlmacenamientoBytes: shadow?.limiteAlmacenamientoBytes ?? MIN_USER_STORAGE_BYTES,
      maxTamanoArchivoBytes: shadow?.maxTamanoArchivoBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
      createdAt: shadow?.createdAt ?? new Date(0),
      lastLoginAt: shadow?.lastLoginAt ?? null,
      esPrivado: shadow?.esPrivado ?? false,
      categorias: (shadow?.categoriaIds ?? []).map((id) => {
        const c = catById.get(id);
        return c
          ? { id: c.id, codigo: c.codigo, descripcion: c.descripcion }
          : { id, codigo: '', descripcion: '' };
      }),
      numeroDocumento: doc,
    };
  }
}
