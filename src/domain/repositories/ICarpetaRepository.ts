import { Carpeta } from '../entities/Carpeta';

export interface ICarpetaRepository {
  save(carpeta: Carpeta): Promise<Carpeta>;
  findById(id: string): Promise<Carpeta | null>;
  findByUsuario(idUsuario: string, idPadre?: string | null): Promise<Carpeta[]>;
  findTreeByUsuario(idUsuario: string): Promise<Carpeta[]>;
  update(carpeta: Carpeta): Promise<Carpeta>;
  delete(id: string): Promise<void>;
  countArchivos(idCarpeta: string): Promise<number>;
  findCompartidasByUsuario(idUsuario: string): Promise<Carpeta[]>;
  usuarioPuedeAccederACarpeta(idUsuario: string, idCarpeta: string): Promise<boolean>;
  findSubarbolDesdeRaiz(idRaiz: string): Promise<Carpeta[]>;
}

