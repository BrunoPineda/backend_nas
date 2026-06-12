import { Archivo } from '../entities/Archivo';
import type { UploadVigenciaParsed } from '../../application/services/UploadVigenciaParser';
/** Filtro de listado por baja lógica (FE_BAJA) y tipo de permanencia. */
export type ArchivosListadoVigencia =
  | 'activos'
  | 'inactivos'
  | 'todos'
  | 'permanentes'
  | 'temporales';
export interface IArchivoRepository {
  save(archivo: Archivo): Promise<Archivo>;
  findById(id: string): Promise<Archivo | null>;
  /** Incluye archivos con FE_BAJA (inactivados). */
  findByIdIncluyendoBaja(id: string): Promise<Archivo | null>;
  findByUsuario(
    idUsuario: string,
    folderId?: string | null,
    vigencia?: ArchivosListadoVigencia
  ): Promise<Archivo[]>;
  /** Archivos de usuarios visibles por categoría (admin ve también privados). */
  findVisiblesParaUsuario(
    idUsuario: string,
    isAdmin: boolean,
    folderId?: string | null,
    vigencia?: ArchivosListadoVigencia
  ): Promise<Archivo[]>;
  /** Un archivo concretamente visible (reglas de categoría / admin). */
  esVisibleParaUsuario(idArchivo: string, idUsuario: string, isAdmin: boolean): Promise<boolean>;
  findByCarpetaYUsuarioPropietario(
    idCarpeta: string,
    idUsuarioPropietario: string,
    vigencia?: ArchivosListadoVigencia
  ): Promise<Archivo[]>;
  findTemporaryFiles(): Promise<Archivo[]>;
  update(archivo: Archivo): Promise<Archivo>;
  delete(id: string): Promise<void>;
  /** Actualiza IN_ES_PERMANENTE y ventana FE_INICIO/FE_FIN. */
  updateVigencia(id: string, vigencia: UploadVigenciaParsed): Promise<void>;
  /** Quita FE_BAJA y deja el archivo disponible (permanente, sin ventana vencida). */
  reactivar(id: string): Promise<void>;
  /** IDs activos con vigencia vencida (FE_FIN anterior a ahora UTC). */  findIdsVigenciaVencida(): Promise<string[]>;
  countByUsuario(idUsuario: string): Promise<number>;
  getTotalSizeByUsuario(idUsuario: string): Promise<number>;
  /** Uso por categoría MIME (documentos, imágenes, etc.) del usuario. */
  getStorageBreakdownByUsuario(idUsuario: string): Promise<
    Array<{ tipo: string; cantidad: number; bytes: number }>
  >;
}

