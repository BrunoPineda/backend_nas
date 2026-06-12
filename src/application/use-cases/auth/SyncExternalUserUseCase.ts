import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { JwtService } from '../../../infrastructure/security/JwtService';
import { Usuario } from '../../../domain/entities/Usuario';
import { randomUUID } from 'crypto';
import { DEFAULT_MAX_FILE_SIZE_BYTES, MIN_USER_STORAGE_BYTES } from '../../../shared/constants/storageLimits';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import { IntranetPermissionService } from '../../services/IntranetPermissionService';
import { NasUserShadowService } from '../../services/NasUserShadowService';
import { syncIntranetUserCategories } from '../../services/IntranetUserCategorySync';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/AppError';
import { MSG_USUARIO_SIN_ROL_NAS, tieneRolNasModulo } from '../../../shared/constants/nasRoles';

export interface SyncExternalUserRequest {
  /** DNI como llave principal de sincronización */
  dni: string;
  /** Nombre completo (e.g. "RONNIER MELENDEZ GARATE") */
  username: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono?: string;
  /** Rol ConectaJuntos (solo modo legacy sin BDJUNTOS). */
  rolNombreExterno?: string;
}

export interface SyncExternalUserResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    rolDisplay?: string;
    dni: string;
    numeroDocumento: string;
    categorias: { id: string; codigo: string; descripcion: string }[];
  };
  created: boolean;
}

export class SyncExternalUserUseCase {
  private intranetAuth = new IntranetAuthRepository();
  private intranetPerm = new IntranetPermissionService();
  private nasShadow = new NasUserShadowService();

  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private categoriaRepository: ICategoriaRepository,
    private passwordService: PasswordService,
    private jwtService: JwtService
  ) {}

  async execute(request: SyncExternalUserRequest): Promise<SyncExternalUserResponse> {
    if (useIntranetUserDatabase()) {
      return this.executeIntranetSso(request);
    }
    return this.executeLegacy(request);
  }

  /** SSO ConectaJuntos con roles reales desde BDJUNTOS (no el rol global de la sesión). */
  private async executeIntranetSso(request: SyncExternalUserRequest): Promise<SyncExternalUserResponse> {
    const cod = request.dni.trim();
    const intranet = await this.intranetAuth.findByCodUsuario(cod);
    if (!intranet || !intranet.bEstado) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo en Intranet');
    }

    const rolesNas = await this.intranetAuth.listRolesNasActivos(intranet.codUsuario);
    if (!tieneRolNasModulo(rolesNas)) {
      throw new ForbiddenError(MSG_USUARIO_SIN_ROL_NAS);
    }

    const existedBefore = !!(await this.usuarioRepository.findByDni(cod));

    const idRolNas = await this.intranetPerm.primaryNasRolId(intranet.codUsuario);
    const rolLabel = await this.intranetPerm.jwtRolLabel(intranet.codUsuario);
    const rolDisplay = await this.intranetPerm.jwtRolDisplayLabel(intranet.codUsuario);

    const local = await this.nasShadow.ensureLocalUser(intranet, idRolNas, []);
    const categorias = await syncIntranetUserCategories(intranet.codUsuario, local.id);

    const token = this.jwtService.generateToken({
      userId: local.id,
      email: local.email,
      rol: rolLabel,
      codUsuario: intranet.codUsuario,
      useIntranet: true,
    });

    const refreshToken = this.jwtService.generateRefreshToken(local.id);

    return {
      token,
      refreshToken,
      user: {
        id: local.id,
        nombre: local.nombre,
        email: local.email,
        rol: rolLabel,
        rolDisplay,
        dni: cod,
        numeroDocumento: cod,
        categorias,
      },
      created: !existedBefore,
    };
  }

  /** Modo sin BDJUNTOS: mapeo simple del rol externo. */
  private async executeLegacy(request: SyncExternalUserRequest): Promise<SyncExternalUserResponse> {
    const ahora = new Date();
    const rolExterno = (request.rolNombreExterno ?? '').trim();
    const rolLower = rolExterno.toLowerCase();

    const rolNombreDestino =
      rolLower.includes('superadmin') ||
      rolLower.includes('admin nas') ||
      rolExterno === '00 UTI - Admin NAS'
        ? 'ADMIN'
        : 'USER';

    const rol = await this.rolRepository.findByName(rolNombreDestino);
    const idRol = rol?.id ?? null;

    const todasLasCategorias = await this.categoriaRepository.findAll();
    const categoriaIds =
      rolNombreDestino === 'ADMIN' ? todasLasCategorias.map((c) => c.id) : [];

    const existente = await this.usuarioRepository.findByDni(request.dni);

    let usuarioFinal: Usuario;
    let created = false;

    if (existente) {
      const actualizado = new Usuario(
        existente.id,
        request.username,
        request.email,
        existente.passwordHash,
        idRol ?? existente.idRol,
        existente.activo,
        existente.limiteAlmacenamientoBytes,
        existente.maxTamanoArchivoBytes,
        existente.createdAt,
        ahora,
        ahora,
        existente.esPrivado,
        rolNombreDestino === 'ADMIN' ? categoriaIds : existente.categoriaIds,
        request.dni,
        request.apellidoPaterno,
        request.apellidoMaterno,
        request.username,
        request.telefono ?? existente.telefono,
        request.dni
      );
      usuarioFinal = await this.usuarioRepository.update(actualizado);
    } else {
      const passwordHash = await this.passwordService.hash(randomUUID());

      const nuevo = new Usuario(
        randomUUID(),
        request.username,
        request.email,
        passwordHash,
        idRol,
        true,
        MIN_USER_STORAGE_BYTES,
        DEFAULT_MAX_FILE_SIZE_BYTES,
        ahora,
        ahora,
        ahora,
        false,
        categoriaIds,
        request.dni,
        request.apellidoPaterno,
        request.apellidoMaterno,
        request.username,
        request.telefono ?? null,
        request.dni
      );
      usuarioFinal = await this.usuarioRepository.save(nuevo);
      created = true;

      if (rolNombreDestino === 'ADMIN') {
        await this.usuarioRepository.syncTodasCategoriasParaAdmin(usuarioFinal.id);
      }
    }

    const token = this.jwtService.generateToken({
      userId: usuarioFinal.id,
      email: usuarioFinal.email,
      rol: rolNombreDestino,
    });

    const refreshToken = this.jwtService.generateRefreshToken(usuarioFinal.id);

    const catById = new Map(todasLasCategorias.map((c) => [c.id, c]));
    const categorias = usuarioFinal.categoriaIds.map((id) => {
      const c = catById.get(id);
      return c
        ? { id: c.id, codigo: c.codigo, descripcion: c.descripcion }
        : { id, codigo: '', descripcion: '' };
    });

    return {
      token,
      refreshToken,
      user: {
        id: usuarioFinal.id,
        nombre: usuarioFinal.nombre,
        email: usuarioFinal.email,
        rol: rolNombreDestino,
        dni: request.dni,
        numeroDocumento: request.dni,
        categorias,
      },
      created,
    };
  }
}
