import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import { ForbiddenError } from '../../../shared/errors/AppError';

export class ListFoldersUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idUsuario: string, idPadre?: string | null): Promise<Carpeta[]> {
    return await this.carpetaRepository.findByUsuario(idUsuario, idPadre);
  }

  async executeTree(idUsuario: string): Promise<Carpeta[]> {
    return await this.carpetaRepository.findTreeByUsuario(idUsuario);
  }

  async executeSharedTree(idUsuario: string, idRaizCompartida: string): Promise<Carpeta[]> {
    const puede = await this.carpetaRepository.usuarioPuedeAccederACarpeta(idUsuario, idRaizCompartida);
    if (!puede) {
      throw new ForbiddenError('No tienes acceso a esta carpeta compartida');
    }
    return await this.carpetaRepository.findSubarbolDesdeRaiz(idRaizCompartida);
  }
}

