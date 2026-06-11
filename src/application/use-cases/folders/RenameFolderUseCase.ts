import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import { NotFoundError, ValidationError, ForbiddenError } from '../../../shared/errors/AppError';

export class RenameFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository
  ) {}

  async execute(idCarpeta: string, nuevoNombre: string, idUsuario: string): Promise<Carpeta> {
    if (!nuevoNombre || nuevoNombre.trim().length === 0) {
      throw new ValidationError('El nombre de la carpeta es requerido');
    }

    const carpeta = await this.carpetaRepository.findById(idCarpeta);
    if (!carpeta) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    if (carpeta.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para renombrar esta carpeta');
    }

    // Verificar que no exista otra carpeta con el mismo nombre en el mismo nivel
    const carpetasExistentes = await this.carpetaRepository.findByUsuario(idUsuario, carpeta.idPadre);
    const nombreExiste = carpetasExistentes.some(
      c => c.id !== idCarpeta && c.nombre.toLowerCase() === nuevoNombre.trim().toLowerCase()
    );
    
    if (nombreExiste) {
      throw new ValidationError('Ya existe una carpeta con ese nombre en esta ubicación');
    }

    const carpetaActualizada = new Carpeta(
      carpeta.id,
      nuevoNombre.trim(),
      carpeta.idPadre,
      carpeta.idUsuario,
      carpeta.esCompartida,
      carpeta.esPublica,
      carpeta.createdAt,
      new Date(),
      carpeta.deletedAt
    );

    return await this.carpetaRepository.update(carpetaActualizada);
  }
}

