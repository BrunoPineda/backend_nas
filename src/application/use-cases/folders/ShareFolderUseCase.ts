import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { query } from '../../../infrastructure/database/sqlserver/connection';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/AppError';

export class ShareFolderUseCase {
  constructor(
    private carpetaRepository: ICarpetaRepository,
    private usuarioRepository: IUsuarioRepository
  ) {}

  async execute(
    idCarpeta: string,
    idUsuario: string,
    idUsuarioCompartir: string,
    permiso: 'READ' | 'WRITE' | 'ADMIN' = 'READ'
  ): Promise<void> {
    const carpeta = await this.carpetaRepository.findById(idCarpeta);
    if (!carpeta) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    if (carpeta.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para compartir esta carpeta');
    }

    const propietario = await this.usuarioRepository.findById(carpeta.idUsuario);
    if (propietario?.esPrivado) {
      throw new ForbiddenError(
        'Un usuario en modo Privado no puede compartir carpetas con otros. Solo puede usar enlaces públicos a archivos.'
      );
    }

    if (carpeta.idUsuario === idUsuarioCompartir) {
      throw new ValidationError('No puedes compartir una carpeta contigo mismo');
    }

    const usuarioResult = await query(
      'SELECT ID_USUARIO FROM dbo.NASTM_USUARIOS WHERE ID_USUARIO = $1 AND ES_VIGENTE = 1',
      [idUsuarioCompartir]
    );
    if (usuarioResult.rows.length === 0) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const puedenCompartir = await this.usuarioRepository.compartenCategoria(
      carpeta.idUsuario,
      idUsuarioCompartir
    );
    if (!puedenCompartir) {
      throw new ForbiddenError(
        'No puedes compartir con este usuario: no comparten ninguna categoría asignada'
      );
    }

    await query(
      `MERGE dbo.NASTD_CARPETAS_COMPARTIDAS AS T
       USING (SELECT $1 AS ID_CARPETA, $2 AS ID_USUARIO_COMPARTIDO, $3 AS TI_PERMISO) AS S
       ON (T.ID_CARPETA = S.ID_CARPETA AND T.ID_USUARIO_COMPARTIDO = S.ID_USUARIO_COMPARTIDO)
       WHEN MATCHED THEN UPDATE SET T.TI_PERMISO = S.TI_PERMISO
       WHEN NOT MATCHED BY TARGET THEN
         INSERT (ID_CARPETA, ID_USUARIO_COMPARTIDO, TI_PERMISO) VALUES (S.ID_CARPETA, S.ID_USUARIO_COMPARTIDO, S.TI_PERMISO);`,
      [idCarpeta, idUsuarioCompartir, permiso]
    );

    const carpetaActualizada = new (carpeta.constructor as any)(
      carpeta.id,
      carpeta.nombre,
      carpeta.idPadre,
      carpeta.idUsuario,
      true,
      carpeta.esPublica,
      carpeta.createdAt,
      new Date(),
      carpeta.deletedAt
    );
    await this.carpetaRepository.update(carpetaActualizada);
  }

  async unshareFolder(idCarpeta: string, idUsuario: string, idUsuarioCompartir: string): Promise<void> {
    const carpeta = await this.carpetaRepository.findById(idCarpeta);
    if (!carpeta || carpeta.idUsuario !== idUsuario) {
      throw new ForbiddenError('No tienes permisos para dejar de compartir esta carpeta');
    }

    await query(
      'DELETE FROM dbo.NASTD_CARPETAS_COMPARTIDAS WHERE ID_CARPETA = $1 AND ID_USUARIO_COMPARTIDO = $2',
      [idCarpeta, idUsuarioCompartir]
    );
  }
}
