import { IAuditoriaRepository } from '../../../domain/repositories/IAuditoriaRepository';

export class ListFileAuditLogsUseCase {
  constructor(private auditoriaRepository: IAuditoriaRepository) {}

  async execute(params: { page?: number; limit?: number; accion?: string; buscar?: string }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const { items, total } = await this.auditoriaRepository.listarEventosArchivo({
      page,
      limit,
      tipoAccion: params.accion?.trim() || null,
      buscar: params.buscar?.trim() || null,
    });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { data: items, total, page, limit, totalPages };
  }
}
