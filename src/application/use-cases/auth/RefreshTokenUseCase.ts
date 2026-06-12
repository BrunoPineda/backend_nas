import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { JwtService } from '../../../infrastructure/security/JwtService';
import { UnauthorizedError, ForbiddenError } from '../../../shared/errors/AppError';
import { IntranetAuthRepository } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import { IntranetPermissionService } from '../../services/IntranetPermissionService';
import { useIntranetUserDatabase } from '../../../infrastructure/database/sqlserver/connection';
import { MSG_USUARIO_SIN_ROL_NAS, tieneRolNasModulo } from '../../../shared/constants/nasRoles';

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  private intranetAuth = new IntranetAuthRepository();
  private intranetPerm = new IntranetPermissionService();

  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private jwtService: JwtService
  ) {}

  async execute(refreshToken: string): Promise<RefreshTokenResponse> {
    if (!refreshToken?.trim()) {
      throw new UnauthorizedError('Refresh token no proporcionado');
    }

    let userId: string;
    try {
      ({ userId } = this.jwtService.verifyRefreshToken(refreshToken));
    } catch {
      throw new UnauthorizedError('Sesión expirada. Iniciá sesión nuevamente.');
    }

    const usuario = await this.usuarioRepository.findById(userId);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo');
    }

    if (useIntranetUserDatabase()) {
      const codUsuario = (usuario.numeroDocumento || usuario.dni || '').trim();
      if (!codUsuario) {
        throw new UnauthorizedError('Perfil NAS incompleto. Iniciá sesión nuevamente.');
      }

      const intranet = await this.intranetAuth.findByCodUsuario(codUsuario);
      if (!intranet || !intranet.bEstado) {
        throw new UnauthorizedError('Usuario no encontrado o inactivo en Intranet');
      }

      const rolesNas = await this.intranetAuth.listRolesNasActivos(intranet.codUsuario);
      if (!tieneRolNasModulo(rolesNas)) {
        throw new ForbiddenError(MSG_USUARIO_SIN_ROL_NAS);
      }

      const rolLabel = await this.intranetPerm.jwtRolLabel(intranet.codUsuario);
      const token = this.jwtService.generateToken({
        userId: usuario.id,
        email: usuario.email,
        rol: rolLabel,
        codUsuario: intranet.codUsuario,
        useIntranet: true,
      });

      return {
        token,
        refreshToken: this.jwtService.generateRefreshToken(usuario.id),
      };
    }

    let rolNombre = 'USER';
    if (usuario.idRol) {
      const rol = await this.rolRepository.findById(usuario.idRol);
      rolNombre = rol?.nombre || 'USER';
    }

    const token = this.jwtService.generateToken({
      userId: usuario.id,
      email: usuario.email,
      rol: rolNombre,
    });

    return {
      token,
      refreshToken: this.jwtService.generateRefreshToken(usuario.id),
    };
  }
}
