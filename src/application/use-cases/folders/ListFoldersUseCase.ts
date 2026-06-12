import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import { ForbiddenError } from '../../../shared/errors/AppError';

export class ListFoldersUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idUsuario: string, idPadre?: string | null, isAdmin = false): Promise<Carpeta[]> {
    const tree = await this.carpetaRepository.findTreeVisibleParaUsuario(idUsuario, isAdmin);
    if (idPadre === undefined) return tree;
    return tree.filter((c) => (idPadre === null ? c.idPadre === null : c.idPadre === idPadre));
  }

  async executeTree(idUsuario: string, isAdmin = false): Promise<Carpeta[]> {
    return await this.carpetaRepository.findTreeVisibleParaUsuario(idUsuario, isAdmin);
  }

  async executeSharedTree(idUsuario: string, idRaizCompartida: string): Promise<Carpeta[]> {
    const puede = await this.carpetaRepository.usuarioPuedeAccederACarpeta(idUsuario, idRaizCompartida);
    if (!puede) {
      throw new ForbiddenError('No tienes acceso a esta carpeta compartida');
    }
    return await this.carpetaRepository.findSubarbolDesdeRaiz(idRaizCompartida);
  }
}

