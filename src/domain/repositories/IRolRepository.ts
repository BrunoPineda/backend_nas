import { Rol } from '../entities/Rol';

export interface IRolRepository {
  findAll(): Promise<Rol[]>;
  findById(id: string): Promise<Rol | null>;
  findByName(nombre: string): Promise<Rol | null>;
  create(rol: Omit<Rol, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rol>;
  update(id: string, rol: Partial<Omit<Rol, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Rol>;
  delete(id: string): Promise<void>;
  getPermisosByRol(idRol: string): Promise<string[]>; // Retorna IDs de permisos
  assignPermiso(idRol: string, idPermiso: string): Promise<void>;
  removePermiso(idRol: string, idPermiso: string): Promise<void>;
}

