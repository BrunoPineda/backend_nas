/**
 * ¿Usar disco temporal como staging antes del NAS permanente?
 * USE_TEMP_STORAGE=true (default si la variable falta): subida escribe ./temp LUEGO promueve a STORAGE_ROOT.
 * USE_TEMP_STORAGE=false: solo STORAGE_ROOT en subida (TEMP_STORAGE_PATH solo para registros legacy / job).
 */
export function useTempStorageStaging(): boolean {
  const v = process.env.USE_TEMP_STORAGE?.trim().toLowerCase();
  if (v === undefined || v === '') return true;
  return ['1', 'true', 'yes', 'on'].includes(v);
}
