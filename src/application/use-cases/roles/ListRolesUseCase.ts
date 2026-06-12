import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { IPermisoRepository } from '../../../domain/repositories/IPermisoRepository';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { mapRolToAdminDto } from './rolAdminDto';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';

export class ListRolesUseCase {
  private intranetAuth = new IntranetAuthRepository();

  constructor(
    private rolRepository: IRolRepository,
    private permisoRepository: IPermisoRepository
  ) {}

  async execute() {
    const roles = useIntranetUserDatabase()
      ? await this.rolRepository.findNasIntranetRoles()
      : await this.rolRepository.findAll();
    const permisos = await this.permisoRepository.findAll();
    const permisosMap = new Map(permisos.map(p => [p.id, p]));
    const catalog = useIntranetUserDatabase() ? await this.intranetAuth.listRolesNasCatalogMap() : new Map();

    return Promise.all(roles.map(async (rol) => {
      const permisosIds = await this.rolRepository.getPermisosByRol(rol.id);
      return {
        ...mapRolToAdminDto(rol, rol.idRolIntranet != null ? catalog.get(rol.idRolIntranet) : null),
        permisos: permisosIds.map(id => {
          const permiso = permisosMap.get(id);
          return permiso ? {
            id: permiso.id,
            nombre: permiso.nombre,
            descripcion: permiso.descripcion
          } : null;
        }).filter(p => p !== null)
      };
    }));
  }
}

