import fs from 'fs/promises';
import path from 'path';

/** Raíz física donde viven `{AREA}/{YYYY}/{MM}/{DD}/`; misma semántica que STORAGE_ROOT_PATH en .env */
export function resolveStorageRootAbsolute(): string {
  let raw = process.env.STORAGE_ROOT_PATH?.trim() ?? '';
  // Quitar controles (p. ej. \f si en .env quedó N:\ con barra mal escapada)
  raw = raw.replace(/[\u0000-\u001f\u007f]/g, '');
  const fallback = path.join('..', 'storage');
  const rel = raw.length > 0 ? raw : fallback;
  let abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  abs = path.normalize(abs);
  // Unidad Windows: "N:" o "N:/" → "N:\"
  if (/^[A-Za-z]:[/\\]?$/.test(abs)) {
    abs = `${abs.charAt(0).toUpperCase()}:\\`;
  }
  return abs;
}

/** Comprueba que la raíz NAS/unidad existe antes de crear subcarpetas. */
export async function assertStorageRootReachable(storageRootAbs: string): Promise<void> {
  try {
    await fs.access(storageRootAbs);
  } catch {
    throw new Error(
      `No se puede acceder a STORAGE_ROOT_PATH "${storageRootAbs}". ` +
        'Verificá que la unidad esté mapeada (net use N: \\\\servidor\\ruta) antes de iniciar el backend.'
    );
  }
}

/**
 * Nombre de carpeta dentro de STORAGE_ROOT_PATH para una categoría.
 * Ej.: "DATOS PRUEBA" → "DATOS_PRUEBA", "uti" → "uti", caracteres ilegales omitidos,
 * Unicode (ñ, ó, …) preservado donde sea letra válida para Windows tras limpieza.
 */
export function sanitizarCodigoParaCarpetaNas(codigo: string): string {
  if (!codigo?.trim()) return '';
  let s = codigo.trim();
  s = s.replace(/\u00a0/g, ' ');
  s = s.replace(/\s+/g, '_');
  // Caracteres prohibidos por Windows + controles ASCII
  s = s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '');
  try {
    s = s.replace(/[^\p{L}\p{N}_-]/gu, '');
  } catch {
    s = s.replace(/[^a-zA-Z0-9\u00c0-\u024f_-]/g, '');
  }
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');
  const reservados = new Set(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1']);
  if (!s || s === '.' || s === '..' || reservados.has(s.toUpperCase())) return '';
  return s;
}

export async function ensureNasFoldersForCategories(
  storageRootAbs: string,
  categorias: readonly { codigo: string }[]
): Promise<void> {
  const root = path.normalize(storageRootAbs);
  await assertStorageRootReachable(root);

  for (const c of categorias) {
    const name = sanitizarCodigoParaCarpetaNas(c.codigo);
    if (!name) {
      console.warn(`[NAS] Código de categoría inválido para carpeta, omitido (origen: "${c.codigo}")`);
      continue;
    }
    const full = path.join(root, name);
    if (!full.startsWith(root)) {
      console.warn(`[NAS] Ruta de categoría rechazada (fuera de raíz): "${c.codigo}"`);
      continue;
    }
    await fs.mkdir(full, { recursive: true });
  }
}

export async function mkdirNasFolderForCodigo(storageRootAbs: string, codigoDb: string): Promise<void> {
  const name = sanitizarCodigoParaCarpetaNas(codigoDb);
  if (!name) {
    console.warn(`[NAS] No se crea carpeta: código "${codigoDb}" queda vacío tras sanitizar.`);
    return;
  }
  await fs.mkdir(path.join(storageRootAbs, name), { recursive: true });
}
