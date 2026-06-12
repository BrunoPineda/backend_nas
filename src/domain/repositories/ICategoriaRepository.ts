import { Categoria } from '../entities/Categoria';

export type CategoriaConUso = Categoria & {
  usuariosAsignados: number;
  archivosAsignados: number;
};

export interface ICategoriaRepository {
  findAllActivas(): Promise<Categoria[]>;
  findAllConUso(incluirInactivas: boolean): Promise<CategoriaConUso[]>;
  findById(id: string): Promise<Categoria | null>;
  findByCodigo(codigo: string): Promise<Categoria | null>;
  create(codigo: string, descripcion: string): Promise<Categoria>;
  updateDescripcion(id: string, descripcion: string): Promise<Categoria>;
  inactivar(id: string): Promise<void>;
  reactivar(id: string): Promise<void>;
  /** Asigna la categoría a todos los usuarios con rol ADMIN. */
  assignToAllAdminUsers(idCategoria: string): Promise<void>;
  /** @deprecated usar findAllActivas */
  findAll(): Promise<Categoria[]>;
}
