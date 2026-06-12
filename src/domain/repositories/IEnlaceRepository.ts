import { Enlace } from '../entities/Enlace';

export interface IEnlaceRepository {
  save(enlace: Enlace): Promise<Enlace>;
  findById(id: string): Promise<Enlace | null>;
  findByToken(token: string): Promise<Enlace | null>;
  findByArchivo(idArchivo: string): Promise<Enlace[]>;
  findByUsuario(idUsuario: string): Promise<Enlace[]>;
  update(enlace: Enlace): Promise<Enlace>;
  delete(id: string): Promise<void>;
  incrementarVisita(id: string): Promise<void>;
}

