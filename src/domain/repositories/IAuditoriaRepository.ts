export type RegistrarAuditoriaParams = {
  idUsuario: string;
  tipoAccion: string;
  idArchivo?: string | null;
  idCarpeta?: string | null;
  detalle?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type AuditoriaArchivoListItem = {
  idAuditoria: string;
  idUsuario: string | null;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  tipoAccion: string;
  idArchivo: string | null;
  idCarpeta: string | null;
  detalle: string | null;
  ip: string | null;
  fechaRegistro: Date;
};

export interface IAuditoriaRepository {
  registrar(p: RegistrarAuditoriaParams): Promise<void>;

  /** Eventos relacionados con archivos (subida / borrado lógico); paginación por FE_REGISTRO DESC. */
  listarEventosArchivo(params: {
    page: number;
    limit: number;
    tipoAccion?: string | null;
    buscar?: string | null;
  }): Promise<{ items: AuditoriaArchivoListItem[]; total: number }>;

  /** Igual filtros que listarEventosArchivo; hasta maxFilas (techo servidor). */
  listarParaExportacion(params: {
    tipoAccion?: string | null;
    buscar?: string | null;
    maxFilas: number;
  }): Promise<AuditoriaArchivoListItem[]>;
}
