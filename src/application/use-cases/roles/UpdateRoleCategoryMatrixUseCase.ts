import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { isAdminNasRoleName } from '../../../shared/constants/nasRoles';

export class UpdateRoleCategoryMatrixUseCase {
  constructor(
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository
  ) {}

  async execute(assignments: Record<string, string[]>) {
    const roles = await this.rolRepository.findAll();
    const rolesById = new Map(roles.map((r) => [r.id, r]));
    const categorias = await this.categoriaRepository.findAllActivas();
    const idsValidos = new Set(categorias.map((c) => c.id));
    const todasIds = categorias.map((c) => c.id);

    for (const [idRol, categoriaIds] of Object.entries(assignments)) {
      const rol = rolesById.get(idRol);
      if (!rol) {
        throw new NotFoundError(`Rol no encontrado: ${idRol}`);
      }

      let ids = [...new Set(categoriaIds.filter(Boolean))];

      if (isAdminNasRoleName(rol.nombre)) {
        ids = todasIds;
      } else {
        if (ids.length === 0) {
          throw new ValidationError(`El rol ${rol.nombre} debe tener al menos una categoría`);
        }
        for (const cid of ids) {
          if (!idsValidos.has(cid)) {
            throw new ValidationError('Una o más categorías no existen o están inactivas');
          }
        }
      }

      await this.rolRepository.replaceCategoriasForRol(idRol, ids);
    }

    return { ok: true };
  }
}
