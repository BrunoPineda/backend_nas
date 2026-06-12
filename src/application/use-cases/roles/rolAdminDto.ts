import { Rol } from '../../../domain/entities/Rol';
import { rolNasDisplayLabel } from '../../../shared/constants/nasRoles';
import type { IntranetRolAsignado } from '../../../infrastructure/database/sqlserver/repositories/IntranetAuthRepository';

export function mapRolToAdminDto(rol: Rol, intranet?: IntranetRolAsignado | null) {
  const nombreConecta = intranet?.vNombre?.trim() || null;
  const descripcionConecta = intranet?.vDescripcion?.trim() || null;

  return {
    id: rol.id,
    nombre: rol.nombre,
    codIntranet: rol.idRolIntranet,
    nombreConecta,
    nombreIntranet: rolNasDisplayLabel(rol.idRolIntranet, nombreConecta, rol.nombre),
    descripcion: descripcionConecta,
    esSistema: rol.esSistema,
  };
}
