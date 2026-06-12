import { Usuario } from '../entities/Usuario';

export interface IUsuarioRepository {
  findAll(): Promise<Usuario[]>;
  findPaginated(options: {
    page: number;
    limit: number;
    nombre?: string;
    numeroDocumento?: string;
    email?: string;
  }): Promise<{ rows: Usuario[]; total: number }>;
  findByEmail(email: string): Promise<Usuario | null>;
  findByDni(dni: string): Promise<Usuario | null>;
  /** Perfil NAS por documento, incluye usuarios inactivos (admin). */
  findByDocumentoAdmin(documento: string): Promise<Usuario | null>;
  /** Varios documentos a la vez (merge con Intranet). */
  findByDocumentos(documentos: string[]): Promise<Map<string, Usuario>>;
  findById(id: string): Promise<Usuario | null>;
  /** Solo DB_NAS: cuota, rol módulo, privacidad y categorías (admin ConectaJuntos). */
  updateNasAdminConfig(
    idUsuario: string,
    config: {
      idRol: string | null;
      limiteAlmacenamientoBytes: number;
      maxTamanoArchivoBytes: number;
      esPrivado: boolean;
      categoriaIds: string[];
    }
  ): Promise<Usuario>;
  save(usuario: Usuario): Promise<Usuario>;
  update(usuario: Usuario): Promise<Usuario>;
  delete(id: string): Promise<void>;
  /** Al menos una categoría en común (p. ej. para compartir carpetas). */
  compartenCategoria(idUsuarioA: string, idUsuarioB: string): Promise<boolean>;
  /** Añade enlaces usuario–categoría faltantes (p. ej. al pasar a rol ADMIN). */
  syncTodasCategoriasParaAdmin(idUsuario: string): Promise<void>;
  /** Reemplaza unidades del usuario (p. ej. sincronizadas desde BDJUNTOS). */
  syncCategoriaIds(idUsuario: string, categoriaIds: string[]): Promise<void>;
  /** Login Intranet: actualiza último acceso sin tocar rol/categorías configuradas en admin. */
  recordIntranetLogin(idUsuario: string, activo: boolean): Promise<void>;
}

