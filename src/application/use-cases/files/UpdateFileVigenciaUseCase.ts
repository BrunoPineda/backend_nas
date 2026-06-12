import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';
import { UploadVigenciaParsed } from '../../services/UploadVigenciaParser';

export class UpdateFileVigenciaUseCase {
  constructor(private archivoRepository: IArchivoRepository) {}

  async execute(
    fileId: string,
    userId: string,
    isAdmin: boolean,
    vigencia: UploadVigenciaParsed
  ): Promise<void> {
    const archivo = await this.archivoRepository.findByIdIncluyendoBaja(fileId);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }
    if (archivo.idUsuario !== userId && !isAdmin) {
      throw new ForbiddenError('No tienes permiso para editar este archivo');
    }
    if (archivo.estaEliminado()) {
      throw new ForbiddenError('Recuperá el archivo antes de editar su permanencia');
    }

    await this.archivoRepository.updateVigencia(fileId, vigencia);
  }
}
