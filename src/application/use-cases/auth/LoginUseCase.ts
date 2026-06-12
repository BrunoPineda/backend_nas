import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { JwtService } from '../../../infrastructure/security/JwtService';
import { UnauthorizedError, ForbiddenError } from '../../../shared/errors/AppError';
import { Usuario } from '../../../domain/entities/Usuario';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import { validateIntranetPassword } from '../../../infrastructure/security/intranetPassword';
import { IntranetPermissionService } from '../../services/IntranetPermissionService';
import { NasUserShadowService } from '../../services/NasUserShadowService';
import { syncIntranetUserCategories } from '../../services/IntranetUserCategorySync';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { MSG_USUARIO_SIN_ROL_NAS, tieneRolNasModulo } from '../../../shared/constants/nasRoles';

export interface LoginRequest {
  /** DNI / número de documento / usuario Intranet (codUsuario). */
  documento: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    /** Nombre legible del rol NAS en BDJUNTOS (p. ej. "1076 — 00 UTI - NAS"). */
    rolDisplay?: string;
    categorias: { id: string; codigo: string; descripcion: string }[];
  };
}

export class LoginUseCase {
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

  async execute(request: LoginRequest): Promise<LoginResponse> {
    if (useIntranetUserDatabase()) {
      return this.executeIntranet(request);
    }
    return this.executeLocal(request);
  }

  private async executeIntranet(request: LoginRequest): Promise<LoginResponse> {
    const intranet = await this.intranetAuth.findByLogin(request.documento);
    if (!intranet) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (!intranet.bEstado) {
      throw new UnauthorizedError('La cuenta del usuario no está activa');
    }

    const passwordOk = await validateIntranetPassword(request.password, {
      vClave: intranet.vClave,
      passwordBuffer: intranet.password,
    });
    if (!passwordOk) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const rolesNas = await this.intranetAuth.listRolesNasActivos(intranet.codUsuario);
    if (!tieneRolNasModulo(rolesNas)) {
      throw new ForbiddenError(MSG_USUARIO_SIN_ROL_NAS);
    }

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
        categorias,
      },
    };
  }

  private async executeLocal(request: LoginRequest): Promise<LoginResponse> {
    const loginId = request.documento.trim();
    const usuario =
      (await this.usuarioRepository.findByDni(loginId)) ??
      (await this.usuarioRepository.findByEmail(loginId));

    if (!usuario) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const passwordMatch = await this.passwordService.compare(
      request.password,
      usuario.passwordHash
    );

    if (!passwordMatch) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    let rolNombre = null;
    if (usuario.idRol) {
      const rol = await this.rolRepository.findById(usuario.idRol);
      rolNombre = rol?.nombre || null;
    }

    const ahora = new Date();
    const usuarioActualizado = new Usuario(
      usuario.id,
      usuario.nombre,
      usuario.email,
      usuario.passwordHash,
      usuario.idRol,
      usuario.activo,
      usuario.limiteAlmacenamientoBytes,
      usuario.maxTamanoArchivoBytes,
      usuario.createdAt,
      ahora,
      ahora,
      usuario.esPrivado,
      usuario.categoriaIds,
      usuario.dni,
      usuario.apellidoPaterno,
      usuario.apellidoMaterno,
      usuario.username,
      usuario.telefono,
      usuario.numeroDocumento
    );
    await this.usuarioRepository.update(usuarioActualizado);

    const todas = await this.categoriaRepository.findAll();
    const catById = new Map(todas.map((c) => [c.id, c]));
    const categorias = usuario.categoriaIds.map((id) => {
      const c = catById.get(id);
      return c
        ? { id: c.id, codigo: c.codigo, descripcion: c.descripcion }
        : { id, codigo: '', descripcion: '' };
    });

    const token = this.jwtService.generateToken({
      userId: usuario.id,
      email: usuario.email,
      rol: rolNombre || 'USER',
    });

    const refreshToken = this.jwtService.generateRefreshToken(usuario.id);

    return {
      token,
      refreshToken,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: rolNombre || 'USER',
        categorias,
      },
    };
  }
}
