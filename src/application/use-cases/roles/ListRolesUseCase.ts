import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { IPermisoRepository } from '../../../domain/repositories/IPermisoRepository';

export class ListRolesUseCase {
  constructor(
    private rolRepository: IRolRepository,
    private permisoRepository: IPermisoRepository
  ) {}

  async execute() {
    const roles = await this.rolRepository.findAll();
    const permisos = await this.permisoRepository.findAll();
    const permisosMap = new Map(permisos.map(p => [p.id, p]));

    return Promise.all(roles.map(async (rol) => {
      const permisosIds = await this.rolRepository.getPermisosByRol(rol.id);
      return {
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        esSistema: rol.esSistema,
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

