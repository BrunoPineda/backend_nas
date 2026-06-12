import { IStorageService } from '../IStorageService';
import fs from 'fs/promises';
import path from 'path';

export class TemporaryStorageService implements IStorageService {
  private directoryEnsured = false;

  constructor(private rootPath: string) {}

  private async ensureDirectoryExists(): Promise<void> {
    if (this.directoryEnsured) return;
    
    try {
      await fs.access(this.rootPath);
    } catch {
      await fs.mkdir(this.rootPath, { recursive: true });
    }
    this.directoryEnsured = true;
  }

  async saveFile(
    rutaRelativa: string,
    nombreArchivo: string,
    contenido: Buffer
  ): Promise<string> {
    await this.ensureDirectoryExists();
    const archivoPath = path.join(this.rootPath, nombreArchivo);
    await fs.writeFile(archivoPath, contenido);
    return archivoPath;
  }

  async getFile(rutaRelativa: string, nombreArchivo: string): Promise<Buffer> {
    const archivoPath = path.join(this.rootPath, nombreArchivo);
    return await fs.readFile(archivoPath);
  }

  async deleteFile(rutaRelativa: string, nombreArchivo: string): Promise<void> {
    const archivoPath = path.join(this.rootPath, nombreArchivo);
    try {
      await fs.unlink(archivoPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(rutaRelativa: string, nombreArchivo: string): Promise<boolean> {
    const archivoPath = path.join(this.rootPath, nombreArchivo);
    try {
      await fs.access(archivoPath);
      return true;
    } catch {
      return false;
    }
  }
}

