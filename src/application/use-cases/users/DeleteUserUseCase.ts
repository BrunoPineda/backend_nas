import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export class DeleteUserUseCase {
  constructor(private usuarioRepository: IUsuarioRepository) {}

  async execute(id: string) {
    const usuario = await this.usuarioRepository.findById(id);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    await this.usuarioRepository.delete(id);
  }
}

