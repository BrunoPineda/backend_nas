import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { Carpeta } from '../../../domain/entities/Carpeta';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError';

export class CreateFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository,
    private usuarioRepository: IUsuarioRepository
  ) {}

  async execute(nombre: string, idUsuario: string, idPadre?: string | null): Promise<Carpeta> {
    if (!nombre || nombre.trim().length === 0) {
      throw new ValidationError('El nombre de la carpeta es requerido');
    }

    // Validar que el usuario existe y está activo
    const usuario = await this.usuarioRepository.findById(idUsuario);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado. Por favor, inicia sesión nuevamente');
    }
    
    if (!usuario.activo) {
      throw new ValidationError('Tu cuenta ha sido desactivada. No puedes crear carpetas');
    }

    // Verificar que no exista otra carpeta con el mismo nombre en el mismo nivel
    const carpetasExistentes = await this.carpetaRepository.findByUsuario(idUsuario, idPadre || null);
    const nombreExiste = carpetasExistentes.some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
    
    if (nombreExiste) {
      throw new ValidationError('Ya existe una carpeta con ese nombre en esta ubicación');
    }

    // Si tiene padre, verificar que existe
    if (idPadre) {
      const padre = await this.carpetaRepository.findById(idPadre);
      if (!padre || padre.idUsuario !== idUsuario) {
        throw new ValidationError('La carpeta padre no existe o no tienes permisos');
      }
    }

    const carpeta = new Carpeta(
      uuidv4(),
      nombre.trim(),
      idPadre || null,
      idUsuario,
      false, // esCompartida
      false, // esPublica
      new Date(),
      new Date(),
      null
    );

    return await this.carpetaRepository.save(carpeta);
  }
}

