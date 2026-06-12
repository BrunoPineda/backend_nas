import { randomUUID } from 'crypto';
import { Usuario } from '../../domain/entities/Usuario';
import { UsuarioRepository } from '../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import type { IntranetUsuario } from '../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';
import { MIN_USER_STORAGE_BYTES, DEFAULT_MAX_FILE_SIZE_BYTES } from '../../shared/constants/storageLimits';
import { PasswordService } from '../../infrastructure/security/PasswordService';

export type NasAdminConfig = {
  idRolNas: string | null;
  limiteAlmacenamientoBytes: number;
  maxTamanoArchivoBytes?: number;
  esPrivado: boolean;
  categoriaIds: string[];
};

/**
 * Perfil sombra en DB_NAS (FK archivos/carpetas).
 * BDJUNTOS/Intranet: solo lectura. DB_NAS: única BD que el módulo escribe.
 */
export class NasUserShadowService {
  constructor(
    private usuarioRepository = new UsuarioRepository(),
    private passwordService = new PasswordService()
  ) {}

  /**
   * Admin: lee identidad en BDJUNTOS; crea o actualiza solo configuración NAS en DB_NAS.
   */
  async saveAdminConfig(intranet: IntranetUsuario, config: NasAdminConfig): Promise<Usuario> {
    const cod = intranet.codUsuario.trim();
    const existente =
      (await this.usuarioRepository.findByDocumentoAdmin(cod)) ??
      (intranet.email ? await this.usuarioRepository.findByEmail(intranet.email) : null);

    const limite = config.limiteAlmacenamientoBytes;
    const maxArchivo = config.maxTamanoArchivoBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;

    if (existente) {
      return this.usuarioRepository.updateNasAdminConfig(existente.id, {
        idRol: config.idRolNas,
        limiteAlmacenamientoBytes: limite,
        maxTamanoArchivoBytes: maxArchivo,
        esPrivado: config.esPrivado,
        categoriaIds: config.categoriaIds,
      });
    }

    return this.createShadowFromIntranet(intranet, config);
  }

  /** Login: copia identidad leída de BDJUNTOS + rol/categorías iniciales en DB_NAS. */
  async ensureLocalUser(
    intranet: IntranetUsuario,
    idRolNas: string | null,
    categoriaIds: string[] = [],
    overrides?: {
      limiteAlmacenamientoBytes?: number;
      esPrivado?: boolean;
      maxTamanoArchivoBytes?: number;
    }
  ): Promise<Usuario> {
    const cod = intranet.codUsuario.trim();
    const existente =
      (await this.usuarioRepository.findByDocumentoAdmin(cod)) ??
      (intranet.email ? await this.usuarioRepository.findByEmail(intranet.email) : null);

    if (existente) {
      await this.usuarioRepository.recordIntranetLogin(existente.id, intranet.bEstado);
      const actualizado = await this.usuarioRepository.findById(existente.id);
      if (!actualizado) {
        throw new Error('Perfil NAS no encontrado tras login');
      }
      return actualizado;
    }

    const limite = overrides?.limiteAlmacenamientoBytes ?? MIN_USER_STORAGE_BYTES;
    const maxArchivo = overrides?.maxTamanoArchivoBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
    const esPrivado = overrides?.esPrivado ?? false;
    const cats = categoriaIds;

    return this.createShadowFromIntranet(intranet, {
      idRolNas,
      limiteAlmacenamientoBytes: limite,
      maxTamanoArchivoBytes: maxArchivo,
      esPrivado,
      categoriaIds: cats,
    });
  }

  private async createShadowFromIntranet(
    intranet: IntranetUsuario,
    config: NasAdminConfig
  ): Promise<Usuario> {
    const cod = intranet.codUsuario.trim();
    const ahora = new Date();
    const nombre = intranet.fullname?.trim() || intranet.usuario || cod;
    const email = intranet.email?.trim() || `${cod}@intranet.local`;
    const placeholderHash = await this.passwordService.hash(randomUUID());

    const nuevo = new Usuario(
      randomUUID(),
      nombre,
      email,
      placeholderHash,
      config.idRolNas,
      intranet.bEstado,
      config.limiteAlmacenamientoBytes,
      config.maxTamanoArchivoBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
      ahora,
      ahora,
      null,
      config.esPrivado,
      config.categoriaIds,
      cod,
      null,
      null,
      intranet.usuario,
      null,
      cod
    );
    return this.usuarioRepository.save(nuevo);
  }
}
