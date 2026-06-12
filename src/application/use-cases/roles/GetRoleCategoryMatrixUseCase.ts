import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { isAdminNasRoleName } from '../../../shared/constants/nasRoles';
import { mapRolToAdminDto } from './rolAdminDto';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';

export class GetRoleCategoryMatrixUseCase {
  private intranetAuth = new IntranetAuthRepository();

  constructor(
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository
  ) {}

  async execute() {
    const roles = useIntranetUserDatabase()
      ? await this.rolRepository.findNasIntranetRoles()
      : await this.rolRepository.findAll();

    const categorias = await this.categoriaRepository.findAllActivas();
    const matrix = await this.rolRepository.getRoleCategoryMatrix();
    const todasIds = categorias.map((c) => c.id);

    const assignments: Record<string, string[]> = {};
    for (const rol of roles) {
      if (isAdminNasRoleName(rol.nombre)) {
        assignments[rol.id] = [...todasIds];
      } else {
        assignments[rol.id] = matrix.get(rol.id) ?? [];
      }
    }

    const catalog = useIntranetUserDatabase() ? await this.intranetAuth.listRolesNasCatalogMap() : new Map();

    return {
      roles: roles.map((r) =>
        mapRolToAdminDto(r, r.idRolIntranet != null ? catalog.get(r.idRolIntranet) : null)
      ),
      categorias: categorias.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        descripcion: c.descripcion,
      })),
      assignments,
    };
  }
}
