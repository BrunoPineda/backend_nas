import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/AppError';

export class MoveFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idCarpeta: string, nuevoIdPadre: string | null, idUsuario: string): Promise<Carpeta> {
    const carpeta = await this.carpetaRepository.findById(idCarpeta);
    if (!carpeta) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    if (carpeta.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para mover esta carpeta');
    }

    // No se puede mover una carpeta dentro de sí misma o sus descendientes
    if (nuevoIdPadre) {
      const nuevoPadre = await this.carpetaRepository.findById(nuevoIdPadre);
      if (!nuevoPadre || nuevoPadre.idUsuario !== idUsuario) {
        throw new NotFoundError('La carpeta destino no existe o no tienes permisos');
      }

      // Verificar que no sea un descendiente
      if (await this.esDescendiente(nuevoIdPadre, idCarpeta)) {
        throw new ValidationError('No puedes mover una carpeta dentro de sus propias subcarpetas');
      }
    }

    // Verificar que no exista otra carpeta con el mismo nombre en el destino
    const carpetasEnDestino = await this.carpetaRepository.findByUsuario(idUsuario, nuevoIdPadre);
    const nombreExiste = carpetasEnDestino.some(
      c => c.id !== idCarpeta && c.nombre.toLowerCase() === carpeta.nombre.toLowerCase()
    );
    
    if (nombreExiste) {
      throw new ValidationError('Ya existe una carpeta con ese nombre en el destino');
    }

    const carpetaActualizada = new Carpeta(
      carpeta.id,
      carpeta.nombre,
      nuevoIdPadre,
      carpeta.idUsuario,
      carpeta.esCompartida,
      carpeta.esPublica,
      carpeta.createdAt,
      new Date(),
      carpeta.deletedAt
    );

    return await this.carpetaRepository.update(carpetaActualizada);
  }

  private async esDescendiente(idCarpeta: string, idAncestro: string): Promise<boolean> {
    let actual = await this.carpetaRepository.findById(idCarpeta);
    while (actual && actual.idPadre) {
      if (actual.idPadre === idAncestro) {
        return true;
      }
      actual = await this.carpetaRepository.findById(actual.idPadre);
    }
    return false;
  }
}

