import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ValidationError } from '../../../shared/errors/AppError';

export class CreateRoleUseCase {
  constructor(private rolRepository: IRolRepository) {}

  async execute(data: {
    nombre: string;
    descripcion?: string;
    permisos?: string[]; // IDs de permisos
  }) {
    // Verificar que el nombre no esté en uso
    const existingRole = await this.rolRepository.findByName(data.nombre);
    if (existingRole) {
      throw new ValidationError('El nombre del rol ya está en uso');
    }

    // Crear rol
    const rol = await this.rolRepository.create({
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      esSistema: false
    });

    // Asignar permisos si se proporcionan
    if (data.permisos && data.permisos.length > 0) {
      for (const permisoId of data.permisos) {
        await this.rolRepository.assignPermiso(rol.id, permisoId);
      }
    }

    return rol;
  }
}

