import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { PasswordService } from '../../../infrastructure/security/PasswordService';
import { JwtService } from '../../../infrastructure/security/JwtService';
import { UnauthorizedError } from '../../../shared/errors/AppError';
import { Usuario } from '../../../domain/entities/Usuario';

export interface LoginRequest {
  email: string;
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
  };
}

export class LoginUseCase {
  constructor(
    private usuarioRepository: IUsuarioRepository,
    private rolRepository: IRolRepository,
    private passwordService: PasswordService,
    private jwtService: JwtService
  ) {}

  async execute(request: LoginRequest): Promise<LoginResponse> {
    const usuario = await this.usuarioRepository.findByEmail(request.email);

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
      usuario.categoriaIds
    );
    await this.usuarioRepository.update(usuarioActualizado);

    const token = this.jwtService.generateToken({
      userId: usuario.id,
      email: usuario.email,
      rol: rolNombre || 'USER'
    });

    const refreshToken = this.jwtService.generateRefreshToken(usuario.id);

    return {
      token,
      refreshToken,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: rolNombre || 'USER'
      }
    };
  }
}
