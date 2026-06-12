import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { ICarpetaRepository } from '../../../domain/repositories/ICarpetaRepository';
import { IRolRepository } from '../../../domain/repositories/IRolRepository';
import { Archivo } from '../../../domain/entities/Archivo';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/AppError';
import { PERMISO_FILE_DELETE_ANY } from '../../constants/fileAudit';
import { usuarioPuedeGestionarArchivo } from '../../services/ArchivoEnlaceAccessService';

export class MoveFileUseCase {
  constructor(
    private archivoRepository: IArchivoRepository,
    private carpetaRepository: ICarpetaRepository,
    private rolRepository: IRolRepository
  ) {}

  async execute(
    idArchivo: string,
    nuevoIdCarpeta: string | null,
    idUsuario: string,
    isAdmin = false
  ): Promise<Archivo> {
    const archivo = await this.archivoRepository.findById(idArchivo);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }

    const puedeMover = await usuarioPuedeGestionarArchivo(
      idUsuario,
      archivo,
      isAdmin,
      this.carpetaRepository,
      this.archivoRepository
    );
    if (!puedeMover) {
      throw new ForbiddenError('No tienes permisos para mover este archivo');
    }

    const puedeMoverEntrePropietarios =
      isAdmin ||
      (await this.rolRepository.usuarioTieneCodigoPermiso(idUsuario, PERMISO_FILE_DELETE_ANY));

    let carpetaDestino: Awaited<ReturnType<ICarpetaRepository['findById']>> = null;
    if (nuevoIdCarpeta) {
      carpetaDestino = await this.carpetaRepository.findById(nuevoIdCarpeta);
      if (!carpetaDestino) {
        throw new NotFoundError('La carpeta destino no existe o no tienes permisos');
      }

      if (carpetaDestino.idUsuario !== archivo.idUsuario && !puedeMoverEntrePropietarios) {
        throw new ValidationError(
          'Solo podés mover el archivo a carpetas del mismo propietario'
        );
      }

      const puedeDestino = await this.carpetaRepository.usuarioPuedeAccederACarpeta(
        idUsuario,
        nuevoIdCarpeta
      );
      if (!puedeDestino) {
        throw new ForbiddenError('No tienes permisos para usar esa carpeta destino');
      }
    }

    const idUsuarioFinal =
      puedeMoverEntrePropietarios && carpetaDestino && carpetaDestino.idUsuario !== archivo.idUsuario
        ? carpetaDestino.idUsuario
        : archivo.idUsuario;

    const archivoActualizado = new Archivo(
      archivo.id,
      idUsuarioFinal,
      nuevoIdCarpeta,
      archivo.nombreOriginal,
      archivo.nombreFisico,
      archivo.rutaFisica,
      archivo.mimeType,
      archivo.tamanoBytes,
      archivo.hashSha256,
      archivo.enTemporal,
      archivo.rutaTemporal,
      archivo.createdAt,
      new Date(),
      archivo.lastDownloadAt,
      archivo.rutasEspejo,
      archivo.esPermanente,
      archivo.fechaInicioVigencia,
      archivo.fechaFinVigencia,
      archivo.deletedAt
    );

    return await this.archivoRepository.update(archivoActualizado);
  }
}
