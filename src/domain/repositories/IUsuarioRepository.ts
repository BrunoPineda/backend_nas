import { Usuario } from '../entities/Usuario';

export interface IUsuarioRepository {
  findAll(): Promise<Usuario[]>;
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  save(usuario: Usuario): Promise<Usuario>;
  update(usuario: Usuario): Promise<Usuario>;
  delete(id: string): Promise<void>;
  /** Al menos una categoría en común (p. ej. para compartir carpetas). */
  compartenCategoria(idUsuarioA: string, idUsuarioB: string): Promise<boolean>;
  /** Añade enlaces usuario–categoría faltantes (p. ej. al pasar a rol ADMIN). */
  syncTodasCategoriasParaAdmin(idUsuario: string): Promise<void>;
}

