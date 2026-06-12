import { Archivo } from '../../domain/entities/Archivo';
import { IArchivoRepository } from '../../domain/repositories/IArchivoRepository';
import { ICarpetaRepository } from '../../domain/repositories/ICarpetaRepository';

/** Propietario, acceso por carpeta compartida/categoría, o admin con visibilidad de categoría. */
export async function usuarioPuedeGestionarEnlacesDeArchivo(
  idUsuario: string,
  archivo: Archivo,
  isAdmin: boolean,
  carpetaRepository: ICarpetaRepository,
  archivoRepository: IArchivoRepository
): Promise<boolean> {
  return usuarioPuedeGestionarArchivo(idUsuario, archivo, isAdmin, carpetaRepository, archivoRepository);
}

/** Mover, renombrar, inactivar, etc.: propietario o admin con visibilidad; otros usuarios por acceso a carpeta. */
export async function usuarioPuedeGestionarArchivo(
  idUsuario: string,
  archivo: Archivo,
  isAdmin: boolean,
  carpetaRepository: ICarpetaRepository,
  archivoRepository: IArchivoRepository
): Promise<boolean> {
  if (archivo.idUsuario === idUsuario) {
    return true;
  }

  if (isAdmin) {
    return archivoRepository.esVisibleParaUsuario(archivo.id, idUsuario, true);
  }

  if (archivo.idCarpeta) {
    return carpetaRepository.usuarioPuedeAccederACarpeta(idUsuario, archivo.idCarpeta);
  }

  return false;
}
