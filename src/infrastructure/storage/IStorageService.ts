export interface IStorageService {
  saveFile(rutaRelativa: string, nombreArchivo: string, contenido: Buffer): Promise<string>;
  getFile(rutaRelativa: string, nombreArchivo: string): Promise<Buffer>;
  deleteFile(rutaRelativa: string, nombreArchivo: string): Promise<void>;
  fileExists(rutaRelativa: string, nombreArchivo: string): Promise<boolean>;
}

