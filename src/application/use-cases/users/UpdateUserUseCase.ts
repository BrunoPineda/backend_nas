import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { Usuario } from '../../../domain/entities/Usuario';
import { NotFoundError, ValidationError, ForbiddenError } from '../../../shared/errors/AppError';
import { MAX_USER_STORAGE_BYTES, MIN_USER_STORAGE_BYTES } from '../../../shared/constants/storageLimits';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import { NasUserShadowService } from '../../services/NasUserShadowService';
import { isAdminNasRoleName } from '../../../shared/constants/nasRoles';

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export class UpdateUserUseCase {
  private intranetAuth = new IntranetAuthRepository();
  private nasShadow = new NasUserShadowService();

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
      dni?: string | null;
      numeroDocumento?: string | null;
      apellidoPaterno?: string | null;
      apellidoMaterno?: string | null;
      username?: string | null;
      telefono?: string | null;
    }
  ) {
    const intranetMode = useIntranetUserDatabase();
    if (intranetMode) {
      return this.executeIntranet(id, data);
    }
    return this.executeLocal(id, data);
  }

  private async executeIntranet(
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
      numeroDocumento?: string | null;
    }
  ) {
    if (
      data.nombre !== undefined ||
      data.email !== undefined ||
      data.password !== undefined ||
      data.numeroDocumento !== undefined ||
      data.activo !== undefined
    ) {
      throw new ForbiddenError(
        'Nombre, documento, correo, contraseña y estado se gestionan en ConectaJuntos. Solo podés modificar cuota, rol NAS, categorías y privacidad.'
      );
    }

    const codUsuario = await this.resolveCodUsuario(id);
    const intranet = await this.intranetAuth.findByCodUsuario(codUsuario);
    if (!intranet) {
      throw new NotFoundError('Usuario no encontrado en ConectaJuntos');
    }

    const idRolEfectivo =
      data.idRol !== undefined ? data.idRol : (await this.usuarioRepository.findByDocumentoAdmin(codUsuario))?.idRol ?? null;

    if (idRolEfectivo) {
      const rol = await this.rolRepository.findById(idRolEfectivo);
      if (!rol) {
        throw new ValidationError('El rol especificado no existe');
      }
    }

    let limite =
      data.limiteAlmacenamientoBytes ??
      (await this.usuarioRepository.findByDocumentoAdmin(codUsuario))?.limiteAlmacenamientoBytes ??
      MIN_USER_STORAGE_BYTES;
    if (data.limiteAlmacenamientoBytes !== undefined) {
      if (limite < MIN_USER_STORAGE_BYTES || limite > MAX_USER_STORAGE_BYTES) {
        throw new ValidationError('El límite de almacenamiento debe estar entre 1 GiB y 50 GiB');
      }
    }

    const todasLasCategorias = await this.categoriaRepository.findAll();
    const idsValidos = new Set(todasLasCategorias.map((c) => c.id));
    const rolEfectivo = idRolEfectivo ? await this.rolRepository.findById(idRolEfectivo) : null;
    let categoriaIds: string[];

    if (isAdminNasRoleName(rolEfectivo?.nombre)) {
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
      categoriaIds = (await this.usuarioRepository.findByDocumentoAdmin(codUsuario))?.categoriaIds ?? [];
    }

    const esPrivado =
      data.esPrivado !== undefined
        ? data.esPrivado
        : (await this.usuarioRepository.findByDocumentoAdmin(codUsuario))?.esPrivado ?? false;

    const actualizado = await this.nasShadow.saveAdminConfig(intranet, {
      idRolNas: idRolEfectivo,
      limiteAlmacenamientoBytes: limite,
      esPrivado,
      maxTamanoArchivoBytes: data.maxTamanoArchivoBytes,
      categoriaIds,
    });

    if (isAdminNasRoleName(rolEfectivo?.nombre)) {
      await this.usuarioRepository.syncTodasCategoriasParaAdmin(actualizado.id);
    }

    return actualizado;
  }

  private async resolveCodUsuario(id: string): Promise<string> {
    if (UUID_RE.test(id)) {
      const local = await this.usuarioRepository.findById(id);
      const doc = local?.numeroDocumento || local?.dni;
      if (doc?.trim()) return doc.trim();
    }
    return id.trim();
  }

  private async executeLocal(
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
      dni?: string | null;
      numeroDocumento?: string | null;
      apellidoPaterno?: string | null;
      apellidoMaterno?: string | null;
      username?: string | null;
      telefono?: string | null;
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

    const numDoc =
      data.numeroDocumento !== undefined
        ? data.numeroDocumento
        : data.dni !== undefined
          ? data.dni
          : usuario.numeroDocumento || usuario.dni;
    if (!numDoc || !numDoc.trim()) {
      throw new ValidationError('El número de documento es obligatorio');
    }

    if (numDoc.trim() !== (usuario.numeroDocumento || usuario.dni)) {
      const existingUserByDoc = await this.usuarioRepository.findByDni(numDoc.trim());
      if (existingUserByDoc && existingUserByDoc.id !== id) {
        throw new ValidationError('El número de documento ya está registrado');
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

    if (isAdminNasRoleName(rolEfectivo?.nombre)) {
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
      categoriaIds,
      numDoc.trim(),
      data.apellidoPaterno !== undefined ? data.apellidoPaterno : usuario.apellidoPaterno,
      data.apellidoMaterno !== undefined ? data.apellidoMaterno : usuario.apellidoMaterno,
      data.username !== undefined ? data.username : usuario.username,
      data.telefono !== undefined ? data.telefono : usuario.telefono,
      numDoc.trim()
    );

    return await this.usuarioRepository.update(usuarioActualizado);
  }
}
