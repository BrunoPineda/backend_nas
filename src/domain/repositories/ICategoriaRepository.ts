import { Categoria } from '../entities/Categoria';

export interface ICategoriaRepository {
  findAll(): Promise<Categoria[]>;
  findById(id: string): Promise<Categoria | null>;
  findByCodigo(codigo: string): Promise<Categoria | null>;
  create(codigo: string, descripcion: string): Promise<Categoria>;
  /** Asigna la categoría a todos los usuarios con rol ADMIN. */
  assignToAllAdminUsers(idCategoria: string): Promise<void>;
}
