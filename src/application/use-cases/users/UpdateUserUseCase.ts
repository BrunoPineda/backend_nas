import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { Usuario } from '../../../domain/entities/Usuario';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { MAX_USER_STORAGE_BYTES, MIN_USER_STORAGE_BYTES } from '../../../shared/constants/storageLimits';

export class UpdateUserUseCase {
  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository,
    private passwordService: PasswordService
  ) {}

  async execute(
    id: string,
    data: {
      nombre?: string;
      email?: string;
      password?: string;
      idRol?: string | null;
      activo?: boolean;
      limiteAlmacenamientoBytes?: number;
      maxTamanoArchivoBytes?: number;
      idCategorias?: string[];
      esPrivado?: boolean;
    }
  ) {
    const usuario = await this.usuarioRepository.findById(id);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const idRolEfectivo = data.idRol !== undefined ? data.idRol : usuario.idRol;
    if (idRolEfectivo) {
      const rol = await this.rolRepository.findById(idRolEfectivo);
      if (!rol) {
        throw new ValidationError('El rol especificado no existe');
      }
    }

    if (data.email && data.email !== usuario.email) {
      const existingUser = await this.usuarioRepository.findByEmail(data.email);
      if (existingUser) {
        throw new ValidationError('El email ya está en uso');
      }
    }

    let passwordHash = usuario.passwordHash;
    if (data.password) {
      passwordHash = await this.passwordService.hash(data.password);
    }

    let limite = data.limiteAlmacenamientoBytes ?? usuario.limiteAlmacenamientoBytes;
    if (data.limiteAlmacenamientoBytes !== undefined) {
      if (limite < MIN_USER_STORAGE_BYTES || limite > MAX_USER_STORAGE_BYTES) {
        throw new ValidationError('El límite de almacenamiento debe estar entre 1 GiB y 50 GiB');
      }
    }

    const todasLasCategorias = await this.categoriaRepository.findAll();
    const idsValidos = new Set(todasLasCategorias.map((c) => c.id));

    const rolEfectivo = idRolEfectivo ? await this.rolRepository.findById(idRolEfectivo) : null;
    let categoriaIds: string[];

    if (rolEfectivo?.nombre === 'ADMIN') {
      categoriaIds = todasLasCategorias.map((c) => c.id);
    } else if (data.idCategorias !== undefined) {
      if (!data.idCategorias.length) {
        throw new ValidationError('Debes asignar al menos una categoría al usuario');
      }
      for (const cid of data.idCategorias) {
        if (!idsValidos.has(cid)) {
          throw new ValidationError('Una o más categorías no existen');
        }
      }
      categoriaIds = [...new Set(data.idCategorias)];
    } else {
      categoriaIds = usuario.categoriaIds;
    }

    const usuarioActualizado = new Usuario(
      usuario.id,
      data.nombre ?? usuario.nombre,
      data.email ?? usuario.email,
      passwordHash,
      data.idRol !== undefined ? data.idRol : usuario.idRol,
      data.activo !== undefined ? data.activo : usuario.activo,
      limite,
      data.maxTamanoArchivoBytes ?? usuario.maxTamanoArchivoBytes,
      usuario.createdAt,
      new Date(),
      usuario.lastLoginAt,
      data.esPrivado !== undefined ? data.esPrivado : usuario.esPrivado,
      categoriaIds
    );

    return await this.usuarioRepository.update(usuarioActualizado);
  }
}
