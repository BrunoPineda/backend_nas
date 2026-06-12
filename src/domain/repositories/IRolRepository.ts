import { Rol } from '../entities/Rol';

export interface IRolRepository {
  findAll(): Promise<Rol[]>;
  /** Solo roles con COD Intranet 1072–1080 (ConectaJuntos). */
  findNasIntranetRoles(): Promise<Rol[]>;
  findById(id: string): Promise<Rol | null>;
  findByName(nombre: string): Promise<Rol | null>;
  create(rol: Omit<Rol, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rol>;
  update(id: string, rol: Partial<Omit<Rol, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Rol>;
  delete(id: string): Promise<void>;
  getPermisosByRol(idRol: string): Promise<string[]>; // Retorna IDs de permisos
  assignPermiso(idRol: string, idPermiso: string): Promise<void>;
  removePermiso(idRol: string, idPermiso: string): Promise<void>;

  /** True si el rol del usuario incluye CO_PERMISO igual a codigoPermiso */
  usuarioTieneCodigoPermiso(idUsuario: string, codigoPermiso: string): Promise<boolean>;

  /** Códigos CO_PERMISO asignados al rol del usuario. */
  listCodigosPermisoByUsuario(idUsuario: string): Promise<string[]>;

  /** IDs de categorías vinculadas a un rol (matriz roles × categorías). */
  getCategoriaIdsByRol(idRol: string): Promise<string[]>;

  /** Mapa rol → categorías para todos los roles. */
  getRoleCategoryMatrix(): Promise<Map<string, string[]>>;

  /** Reemplaza categorías asignadas a un rol. */
  replaceCategoriasForRol(idRol: string, categoriaIds: string[]): Promise<void>;
}

