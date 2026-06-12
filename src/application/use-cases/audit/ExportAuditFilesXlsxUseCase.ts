import * as XLSX from 'xlsx';
import { IAuditoriaRepository } from '../../../domain/repositories/IAuditoriaRepository';

const MAX_EXPORT_ROWS = 15_000;

function etiquetaAccion(accion: string): string {
  if (accion === 'ARCHIVO_ELIMINADO') return 'Eliminar archivo (hist.)';
  if (accion === 'ARCHIVO_INACTIVADO') return 'Inactivar archivo';
  if (accion === 'ARCHIVO_REACTIVADO') return 'Recuperar archivo';
  if (accion === 'ARCHIVO_SUBIDO') return 'Subir archivo';
  if (accion === 'ARCHIVO_VIGENCIA_ACTUALIZADA') return 'Actualizar vigencia de archivo';
  if (accion === 'CARPETA_INACTIVADA') return 'Inactivar carpeta';
  if (accion === 'CARPETA_REACTIVADA') return 'Recuperar carpeta';
  return accion;
}

function formatearFechaEs(d: Date): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

export class ExportAuditFilesXlsxUseCase {
  constructor(private auditoriaRepository: IAuditoriaRepository) {}

  /** Libro Excel (.xlsx) con los mismos filtros que la tabla de auditoría. */
  async execute(params: { accion?: string; buscar?: string }): Promise<{ buffer: Buffer; filename: string }> {
    const items = await this.auditoriaRepository.listarParaExportacion({
      tipoAccion: params.accion?.trim() || null,
      buscar: params.buscar?.trim() || null,
      maxFilas: MAX_EXPORT_ROWS,
    });

    const header = [
      'Fecha y hora',
      'Usuario',
      'Correo',
      'ID auditoría',
      'ID archivo',
      'ID carpeta',
      'Acción',
      'IP',
      'Detalle (JSON / texto)',
    ];

    const rows = items.map((it) => [
      formatearFechaEs(it.fechaRegistro),
      it.usuarioNombre ?? '',
      it.usuarioEmail ?? '',
      it.idAuditoria,
      it.idArchivo ?? '',
      it.idCarpeta ?? '',
      etiquetaAccion(it.tipoAccion),
      it.ip ?? '',
      it.detalle ?? '',
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    sheet['!cols'] = [
      { wch: 20 },
      { wch: 24 },
      { wch: 28 },
      { wch: 38 },
      { wch: 38 },
      { wch: 38 },
      { wch: 22 },
      { wch: 16 },
      { wch: 48 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Auditoría');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const ymd = new Date().toISOString().slice(0, 10);

    return {
      buffer,
      filename: `auditoria-archivos-${ymd}.xlsx`,
    };
  }
}

/** @deprecated Usar ExportAuditFilesXlsxUseCase */
export { ExportAuditFilesXlsxUseCase as ExportAuditFilesCsvUseCase };
