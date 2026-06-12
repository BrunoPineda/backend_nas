import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import { PERMISO_FOLDER_DELETE_ANY } from '../../../application/constants/folderAudit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class RecoverFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository,
    private rolRepository: IRolRepository
  ) {}

  async execute(idCarpeta: string, idUsuario: string): Promise<Carpeta> {
    const carpeta = await this.carpetaRepository.findByIdIncluyendoBaja(idCarpeta);
    if (!carpeta || !carpeta.estaEliminada()) {
      throw new NotFoundError('Carpeta no encontrada o ya está activa');
    }

    const puedeDeleteAny = await this.rolRepository.usuarioTieneCodigoPermiso(
      idUsuario,
      PERMISO_FOLDER_DELETE_ANY
    );
    if (!puedeDeleteAny) {
      throw new ForbiddenError('No tienes permiso para recuperar carpetas inactivas');
    }

    const puedeAcceder = await this.carpetaRepository.usuarioPuedeAccederACarpetaInactiva(
      idUsuario,
      idCarpeta
    );
    if (!puedeAcceder) {
      throw new ForbiddenError('No tienes acceso a esta carpeta');
    }

    if (carpeta.idPadre) {
      const padreActivo = await this.carpetaRepository.findById(carpeta.idPadre);
      if (!padreActivo) {
        const padre = await this.carpetaRepository.findByIdIncluyendoBaja(carpeta.idPadre);
        if (padre?.estaEliminada()) {
          throw new ValidationError('Recuperá primero la carpeta contenedora (padre inactiva)');
        }
      }
    }

    await this.carpetaRepository.reactivar(idCarpeta);
    const recuperada = await this.carpetaRepository.findById(idCarpeta);
    if (!recuperada) {
      throw new NotFoundError('No se pudo recuperar la carpeta');
    }
    return recuperada;
  }
}
