/** Roles Intranet del módulo NAS (ConectaJuntos). */
export const NAS_INTRANET_ROLE_ID_MIN = 1072;
export const NAS_INTRANET_ROLE_ID_MAX = 1080;

/** Mensaje cuando el usuario no tiene ningún rol NAS (1072–1080) en BDJUNTOS. */
export const MSG_USUARIO_SIN_ROL_NAS =
  'Usuario sin rol asignado. Contacte con el administrador.';

export function tieneRolNasModulo(roles: { iIdRole: number }[]): boolean {
  return roles.some(
    (r) => r.iIdRole >= NAS_INTRANET_ROLE_ID_MIN && r.iIdRole <= NAS_INTRANET_ROLE_ID_MAX
  );
}

/** Condición SQL: solo roles NAS del módulo (COD 1072–1080 en BDJUNTOS). */
export function sqlFiltroRolNasIntranet(urAlias: string, _rAlias: string): string {
  return `${urAlias}.iIdRole BETWEEN ${NAS_INTRANET_ROLE_ID_MIN} AND ${NAS_INTRANET_ROLE_ID_MAX}`;
}

/** Rol NAS con acceso total (todas las categorías): solo NAS_ADMIN / COD 1072. */
export function isAdminNasRoleName(nombre: string | null | undefined): boolean {
  if (!nombre) return false;
  const u = nombre.trim().toUpperCase();
  return u === 'ADMIN' || u === 'NAS_ADMIN';
}

/** Rol con COD Intranet 1072–1080 (ConectaJuntos). */
export function isNasIntranetLinkedRole(cod: number | null | undefined): boolean {
  return cod != null && cod >= NAS_INTRANET_ROLE_ID_MIN && cod <= NAS_INTRANET_ROLE_ID_MAX;
}

/** Etiqueta visible: COD + nombre ConectaJuntos (vNombre). */
export function rolNasDisplayLabel(
  codIntranet: number | null | undefined,
  nombreIntranet: string | null | undefined,
  nombreInterno: string
): string {
  const name = nombreIntranet?.trim();
  if (codIntranet != null && name) return `${codIntranet} — ${name}`;
  if (codIntranet != null) return `${codIntranet} — ${nombreInterno}`;
  return nombreInterno;
}
