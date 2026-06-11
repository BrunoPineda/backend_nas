import { IEnlaceRepository } from '../../../domain/repositories/IEnlaceRepository';
import { Enlace } from '../../../domain/entities/Enlace';

export class ListLinksUseCase {
  constructor(
    private enlaceRepository: IEnlaceRepository
  ) {}

  async execute(idUsuario: string): Promise<Enlace[]> {
    return await this.enlaceRepository.findByUsuario(idUsuario);
  }
}

