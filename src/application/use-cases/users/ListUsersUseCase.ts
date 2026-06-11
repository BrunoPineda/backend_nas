import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';

export class ListUsersUseCase {
  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository
  ) {}

  async execute() {
    const usuarios = await this.usuarioRepository.findAll();
    const roles = await this.rolRepository.findAll();
    const rolesMap = new Map(roles.map((r) => [r.id, r.nombre]));
    const cats = await this.categoriaRepository.findAll();
    const catById = new Map(cats.map((c) => [c.id, c]));

    return usuarios.map((u) => ({
      id: u.id,
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
    }));
  }
}
