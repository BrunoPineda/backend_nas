import { IntranetPermissionService } from './IntranetPermissionService';
import { UsuarioRepository } from '../../infrastructure/database/sqlserver/repositories/UsuarioRepository';
import { CategoriaRepository } from '../../infrastructure/database/sqlserver/repositories/CategoriaRepository';
import type { Categoria } from '../../domain/entities/Categoria';

const intranetPerm = new IntranetPermissionService();
const usuarioRepository = new UsuarioRepository();
const categoriaRepository = new CategoriaRepository();

export type SessionCategoria = { id: string; codigo: string; descripcion: string };

/** Aplica unidades efectivas desde BDJUNTOS al perfil NAS y devuelve categorías para sesión/UI. */
export async function syncIntranetUserCategories(
  codUsuario: string,
  idUsuarioNas: string
): Promise<SessionCategoria[]> {
  const effectiveIds = await intranetPerm.resolveEffectiveCategoryIds(codUsuario);
  const usuario = await usuarioRepository.findById(idUsuarioNas);
  const current = new Set(usuario?.categoriaIds ?? []);
  const changed =
    effectiveIds.length !== current.size || effectiveIds.some((id) => !current.has(id));

  if (changed) {
    await usuarioRepository.syncCategoriaIds(idUsuarioNas, effectiveIds);
  }

  const todas = await categoriaRepository.findAllActivas();
  const byId = new Map<string, Categoria>(todas.map((c) => [c.id, c]));

  return effectiveIds.map((id) => {
    const c = byId.get(id);
    return c
      ? { id: c.id, codigo: c.codigo, descripcion: c.descripcion }
      : { id, codigo: '', descripcion: '' };
  });
}
