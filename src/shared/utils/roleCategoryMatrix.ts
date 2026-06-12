/** Utilidades para sincronizar rol ↔ categorías según la matriz configurada. */

export function categorySetKey(ids: string[]): string {
  return [...new Set(ids.filter(Boolean))].sort().join('|');
}

/** Rol cuyo conjunto de categorías coincide exactamente con la selección. */
export function resolveRoleIdByCategories(
  categoriaIds: string[],
  assignments: Record<string, string[]>,
  roleNames: Map<string, string>
): string | null {
  if (categoriaIds.length === 0) return null;
  const target = categorySetKey(categoriaIds);
  let match: string | null = null;
  for (const [rolId, cats] of Object.entries(assignments)) {
    const nombre = (roleNames.get(rolId) ?? '').toUpperCase();
    if (nombre === 'NAS_ADMIN' || nombre === 'ADMIN') continue;
    if (categorySetKey(cats) === target) {
      if (match) return null;
      match = rolId;
    }
  }
  return match;
}

export function categoriesForRoleId(
  rolId: string | null,
  rolNombre: string | null | undefined,
  assignments: Record<string, string[]>,
  allCategoryIds: string[]
): string[] {
  if (!rolId) return [];
  const u = (rolNombre ?? '').toUpperCase();
  if (u === 'NAS_ADMIN' || u === 'ADMIN') return [...allCategoryIds];
  return assignments[rolId] ? [...assignments[rolId]] : [];
}
