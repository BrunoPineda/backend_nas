import { IPermisoRepository } from '../../../domain/repositories/IPermisoRepository';

export class ListPermissionsUseCase {
  constructor(private permisoRepository: IPermisoRepository) {}

  async execute() {
    return await this.permisoRepository.findAll();
  }
}

