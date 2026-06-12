import { Carpeta } from '../entities/Carpeta';

export interface ICarpetaRepository {
  save(carpeta: Carpeta): Promise<Carpeta>;
  findById(id: string): Promise<Carpeta | null>;
  findByUsuario(idUsuario: string, idPadre?: string | null): Promise<Carpeta[]>;
  findTreeByUsuario(idUsuario: string): Promise<Carpeta[]>;
  /** Árbol propio + usuarios visibles por categoría (admin ve también privados). */
  findTreeVisibleParaUsuario(idUsuario: string, isAdmin: boolean): Promise<Carpeta[]>;
  update(carpeta: Carpeta): Promise<Carpeta>;
  delete(id: string): Promise<void>;
  /** Sin archivos activos ni subcarpetas activas directas. */
  estaVacia(idCarpeta: string): Promise<boolean>;
  /** Baja lógica de la carpeta y todo su subárbol activo. */
  inactivarSubarbol(idRaiz: string): Promise<number>;
  findByIdIncluyendoBaja(id: string): Promise<Carpeta | null>;
  reactivar(id: string): Promise<void>;
  countSubcarpetasActivas(idCarpeta: string): Promise<number>;
  countArchivos(idCarpeta: string): Promise<number>;
  findCompartidasByUsuario(idUsuario: string): Promise<Carpeta[]>;
  usuarioPuedeAccederACarpeta(idUsuario: string, idCarpeta: string): Promise<boolean>;
  /** Igual que usuarioPuedeAccederACarpeta pero permite carpeta con FE_BAJA (recuperación admin). */
  usuarioPuedeAccederACarpetaInactiva(idUsuario: string, idCarpeta: string): Promise<boolean>;
  findSubarbolDesdeRaiz(idRaiz: string): Promise<Carpeta[]>;
}

