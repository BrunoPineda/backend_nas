import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import {
  PERMISO_FOLDER_DELETE,
  PERMISO_FOLDER_DELETE_ANY,
} from '../../../application/constants/folderAudit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export type InactivateFolderResult = {
  carpeta: Carpeta;
  carpetasInactivadas: number;
  modoAdmin: boolean;
};

export class InactivateFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository,
    private rolRepository: IRolRepository
  ) {}

  async execute(idCarpeta: string, idUsuario: string): Promise<InactivateFolderResult> {
    const carpeta = await this.carpetaRepository.findById(idCarpeta);
    if (!carpeta) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    const [puedeDelete, puedeDeleteAny] = await Promise.all([
      this.rolRepository.usuarioTieneCodigoPermiso(idUsuario, PERMISO_FOLDER_DELETE),
      this.rolRepository.usuarioTieneCodigoPermiso(idUsuario, PERMISO_FOLDER_DELETE_ANY),
    ]);

    if (!puedeDelete && !puedeDeleteAny) {
      throw new ForbiddenError('No tienes permiso para inactivar carpetas');
    }

    const esPropietario = carpeta.idUsuario === idUsuario;
    const puedeAcceder =
      esPropietario ||
      (await this.carpetaRepository.usuarioPuedeAccederACarpeta(idUsuario, idCarpeta));

    if (!puedeAcceder) {
      throw new ForbiddenError('No tienes acceso a esta carpeta');
    }

    if (puedeDeleteAny) {
      const carpetasInactivadas = await this.carpetaRepository.inactivarSubarbol(idCarpeta);
      const actualizada = (await this.carpetaRepository.findByIdIncluyendoBaja(idCarpeta)) ?? carpeta;
      return { carpeta: actualizada, carpetasInactivadas, modoAdmin: true };
    }

    if (!esPropietario) {
      throw new ForbiddenError('Solo puedes inactivar carpetas de tu propiedad');
    }

    const vacia = await this.carpetaRepository.estaVacia(idCarpeta);
    if (!vacia) {
      throw new ValidationError(
        'La carpeta debe estar vacía (sin archivos ni subcarpetas) para inactivarla'
      );
    }

    await this.carpetaRepository.delete(idCarpeta);
    const actualizada = (await this.carpetaRepository.findByIdIncluyendoBaja(idCarpeta)) ?? carpeta;
    return { carpeta: actualizada, carpetasInactivadas: 1, modoAdmin: false };
  }
}
