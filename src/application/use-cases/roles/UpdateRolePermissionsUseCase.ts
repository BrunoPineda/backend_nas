import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export class UpdateRolePermissionsUseCase {
  constructor(private rolRepository: IRolRepository) {}

  async execute(idRol: string, permisosIds: string[]) {
    const rol = await this.rolRepository.findById(idRol);
    if (!rol) {
      throw new NotFoundError('Rol no encontrado');
    }

    if (rol.esSistema) {
      throw new Error('No se pueden modificar los permisos de roles del sistema');
    }

    // Obtener permisos actuales
    const permisosActuales = await this.rolRepository.getPermisosByRol(idRol);
    const permisosActualesSet = new Set(permisosActuales);
    const permisosNuevosSet = new Set(permisosIds);

    // Eliminar permisos que ya no están
    for (const permisoId of permisosActuales) {
      if (!permisosNuevosSet.has(permisoId)) {
        await this.rolRepository.removePermiso(idRol, permisoId);
      }
    }

    // Agregar nuevos permisos
    for (const permisoId of permisosIds) {
      if (!permisosActualesSet.has(permisoId)) {
        await this.rolRepository.assignPermiso(idRol, permisoId);
      }
    }
  }
}

