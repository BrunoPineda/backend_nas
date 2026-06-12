import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { Usuario } from '../../../domain/entities/Usuario';
import { ValidationError, ForbiddenError } from '../../../shared/errors/AppError';
import { randomUUID } from 'crypto';
import { MAX_USER_STORAGE_BYTES, MIN_USER_STORAGE_BYTES, DEFAULT_MAX_FILE_SIZE_BYTES } from '../../../shared/constants/storageLimits';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { isAdminNasRoleName } from '../../../shared/constants/nasRoles';

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
    dni?: string;
    numeroDocumento?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    username?: string;
    telefono?: string;
  }) {
    if (useIntranetUserDatabase()) {
      throw new ForbiddenError(
        'Los usuarios se gestionan en ConectaJuntos. Configurá cuota, rol NAS y categorías desde Editar.'
      );
    }

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

    const numDoc = data.numeroDocumento || data.dni;
    if (!numDoc || !numDoc.trim()) {
      throw new ValidationError('El número de documento es obligatorio');
    }

    const existingUserByDoc = await this.usuarioRepository.findByDni(numDoc.trim());
    if (existingUserByDoc) {
      throw new ValidationError('El número de documento ya está registrado');
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
    if (isAdminNasRoleName(rol?.nombre)) {
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
      data.maxTamanoArchivoBytes || DEFAULT_MAX_FILE_SIZE_BYTES,
      new Date(),
      new Date(),
      null,
      data.esPrivado === true,
      categoriaIds,
      numDoc.trim(),
      data.apellidoPaterno || null,
      data.apellidoMaterno || null,
      data.username || null,
      data.telefono || null,
      numDoc.trim()
    );

    return await this.usuarioRepository.save(usuario);
  }
}
