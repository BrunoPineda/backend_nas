import { Archivo } from '../entities/Archivo';

export interface IArchivoRepository {
  save(archivo: Archivo): Promise<Archivo>;
  findById(id: string): Promise<Archivo | null>;
  findByUsuario(idUsuario: string, folderId?: string | null): Promise<Archivo[]>;
  findByCarpetaYUsuarioPropietario(idCarpeta: string, idUsuarioPropietario: string): Promise<Archivo[]>;
  findTemporaryFiles(): Promise<Archivo[]>;
  update(archivo: Archivo): Promise<Archivo>;
  delete(id: string): Promise<void>;
  countByUsuario(idUsuario: string): Promise<number>;
  getTotalSizeByUsuario(idUsuario: string): Promise<number>;
}

