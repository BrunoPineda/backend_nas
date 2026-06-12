/** Registrado en NASTV_AUDITORIA.TI_ACCION */
export const AUDIT_ACCION_ARCHIVO_ELIMINADO = 'ARCHIVO_ELIMINADO';
export const AUDIT_ACCION_ARCHIVO_INACTIVADO = 'ARCHIVO_INACTIVADO';
export const AUDIT_ACCION_ARCHIVO_REACTIVADO = 'ARCHIVO_REACTIVADO';
export const AUDIT_ACCION_ARCHIVO_VIGENCIA = 'ARCHIVO_VIGENCIA_ACTUALIZADA';
/** Subida nueva; si el usuario “reemplaza” borrando y subiendo otro, habrá ARCHIVO_ELIMINADO + ARCHIVO_SUBIDO. */
export const AUDIT_ACCION_ARCHIVO_SUBIDO = 'ARCHIVO_SUBIDO';

/** Código en NASTM_PERMISOS (listado/consulta de auditoría por API admin). */
export const PERMISO_ADMIN_VIEW_FILE_AUDIT = 'admin.view_file_audit';

/** Gestionar archivos de otros usuarios (mover entre propietarios, inactivar ajenos, etc.). */
export const PERMISO_FILE_DELETE_ANY = 'file.delete_any';

/** Acciones de auditoría relacionadas con archivos y carpetas. */
export const AUDIT_ACCIONES_CONTENIDO = [
  'ARCHIVO_ELIMINADO',
  'ARCHIVO_INACTIVADO',
  'ARCHIVO_REACTIVADO',
  'ARCHIVO_SUBIDO',
  'ARCHIVO_VIGENCIA_ACTUALIZADA',
  'CARPETA_INACTIVADA',
  'CARPETA_REACTIVADA',
] as const;
