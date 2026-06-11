import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { Usuario } from '../../../domain/entities/Usuario';
import { ValidationError } from '../../../shared/errors/AppError';
import { randomUUID } from 'crypto';
import { MAX_USER_STORAGE_BYTES, MIN_USER_STORAGE_BYTES } from '../../../shared/constants/storageLimits';

export class CreateUserUseCase {
  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository,
    private passwordService: PasswordService
  ) {}

  async execute(data: {
    nombre: string;
    email: string;
    password: string;
    idRol: string | null;
    limiteAlmacenamientoBytes?: number;
    maxTamanoArchivoBytes?: number;
    idCategorias?: string[];
    /** Modo privado: sin visibilidad entre usuarios de la misma categoría; solo enlaces públicos. */
    esPrivado?: boolean;
  }) {
    if (data.idRol) {
      const rol = await this.rolRepository.findById(data.idRol);
      if (!rol) {
        throw new ValidationError('El rol especificado no existe');
      }
    }

    const existingUser = await this.usuarioRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ValidationError('El email ya está en uso');
    }

    const limite = data.limiteAlmacenamientoBytes ?? MIN_USER_STORAGE_BYTES;
    if (limite < MIN_USER_STORAGE_BYTES || limite > MAX_USER_STORAGE_BYTES) {
      throw new ValidationError(
        `El límite de almacenamiento debe estar entre 1 GiB y 50 GiB`
      );
    }

    const todasLasCategorias = await this.categoriaRepository.findAll();
    const idsValidos = new Set(todasLasCategorias.map((c) => c.id));

    const rol = data.idRol ? await this.rolRepository.findById(data.idRol) : null;
    let categoriaIds: string[];
    if (rol?.nombre === 'ADMIN') {
      categoriaIds = todasLasCategorias.map((c) => c.id);
    } else {
      if (!data.idCategorias?.length) {
        throw new ValidationError('Debes asignar al menos una categoría al usuario');
      }
      for (const id of data.idCategorias) {
        if (!idsValidos.has(id)) {
          throw new ValidationError('Una o más categorías no existen');
        }
      }
      categoriaIds = [...new Set(data.idCategorias)];
    }

    const passwordHash = await this.passwordService.hash(data.password);

    const usuario = new Usuario(
      randomUUID(),
      data.nombre,
      data.email,
      passwordHash,
      data.idRol,
      true,
      limite,
      data.maxTamanoArchivoBytes || 104857600,
      new Date(),
      new Date(),
      null,
      data.esPrivado === true,
      categoriaIds
    );

    return await this.usuarioRepository.save(usuario);
  }
}
