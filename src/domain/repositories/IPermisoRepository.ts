import { Permiso } from '../entities/Permiso';

export interface IPermisoRepository {
  findAll(): Promise<Permiso[]>;
  findById(id: string): Promise<Permiso | null>;
  findByNombre(nombre: string): Promise<Permiso | null>;
  create(permiso: Omit<Permiso, 'id' | 'createdAt'>): Promise<Permiso>;
  update(id: string, permiso: Partial<Omit<Permiso, 'id' | 'createdAt'>>): Promise<Permiso>;
  delete(id: string): Promise<void>;
}

