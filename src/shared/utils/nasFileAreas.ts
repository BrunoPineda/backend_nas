/** Primer segmento de ruta relativa NAS (código de unidad: UTI, UAS, …). */
export function segmentoAreaNasDesdeRuta(rutaRelativa: string | null | undefined): string {
  if (!rutaRelativa?.trim()) return '';
  const norm = rutaRelativa.replace(/\\/g, '/').trim();
  const seg = norm.split('/').filter(Boolean)[0] ?? '';
  if (!seg || seg.toUpperCase() === 'SIN_CATEGORIA') return '';
  return seg;
}

/** Unidades físicas NAS donde existe el archivo (primaria + réplicas). */
export function listarAreasNasArchivo(
  rutaFisica: string | null | undefined,
  rutasEspejo: string[] | null | undefined
): string[] {
  const out = new Set<string>();
  const primary = segmentoAreaNasDesdeRuta(rutaFisica);
  if (primary) out.add(primary);
  for (const r of rutasEspejo ?? []) {
    const area = segmentoAreaNasDesdeRuta(r);
    if (area) out.add(area);
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Rutas relativas completas bajo STORAGE_ROOT_PATH (incluye réplicas). */
export function rutasRelativasCompletasArchivo(
  rutaFisica: string,
  nombreFisico: string,
  rutasEspejo: string[] | null | undefined
): string[] {
  const join = (dir: string) => {
    const base = dir.replace(/\\/g, '/').replace(/\/+$/, '');
    return `${base}/${nombreFisico}`;
  };
  const out = new Set<string>();
  if (rutaFisica?.trim()) out.add(join(rutaFisica));
  for (const r of rutasEspejo ?? []) {
    if (r?.trim()) out.add(join(r));
  }
  return [...out];
}
