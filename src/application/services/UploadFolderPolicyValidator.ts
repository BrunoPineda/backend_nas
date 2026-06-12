import path from 'path';
import { ValidationError } from '../../shared/errors/AppError';
import type { PoliticaSubidaRow } from '../../infrastructure/database/sqlserver/repositories/PoliticaSubidaRepository';

export type GrupoTipoArchivo = 'fotos' | 'videos' | 'documentos' | 'otros';

export function clasificarArchivoPorTipo(mimetype: string, originalName: string): GrupoTipoArchivo {
  const mime = (mimetype || '').toLowerCase();
  const ext = path.extname(originalName || '').toLowerCase();

  if (mime.startsWith('image/')) return 'fotos';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'otros';

  const docHints =
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('officedocument') ||
    mime.includes('/msword') ||
    mime.includes('ms-powerpoint') ||
    mime.includes('ms-excel') ||
    mime.startsWith('text/');
  const docExt = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.odt'].includes(ext);
  if (docHints || docExt) return 'documentos';

  return 'otros';
}

function grupoPermitido(policy: PoliticaSubidaRow, grupo: GrupoTipoArchivo): boolean {
  switch (grupo) {
    case 'fotos':
      return policy.permiteFotos;
    case 'videos':
      return policy.permiteVideos;
    case 'documentos':
      return policy.permiteDocumentos;
    default:
      return policy.permiteOtros;
  }
}

function extensionListaPermite(originalName: string, csv: string | null): boolean {
  const raw = (csv || '').trim();
  if (!raw) return true;
  const ext = path
    .extname(originalName || '')
    .toLowerCase()
    .replace(/^\./, '');
  const partes = raw
    .split(',')
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^\./, '')
    )
    .filter(Boolean);
  return ext.length > 0 && partes.includes(ext);
}

/**
 * Lanza ValidationError si el archivo no cumple la política.
 * ADMIN y usuarios listados como exentos omiten clasificación/extensiones pero siguen peso máximo de política (si existe).
 */
export function assertMatchesUploadPolicy(
  file: Express.Multer.File,
  policy: PoliticaSubidaRow | null,
  opts: {
    uploaderId: string;
    /** Nombre técnico del rol (ADMIN, etc.). */
    uploaderRole: string;
    exemptUserIds: string[];
    /** Tamaño máximo aplicado por servidor (usuario / env). */
    serverHardMaxBytes: number;
  }
): void {
  if (!policy) return;

  const isAdmin = (opts.uploaderRole || '').toUpperCase() === 'ADMIN';
  if (isAdmin) {
    if (policy.maxPesoMb != null && file.size > policy.maxPesoMb * 1048576) {
      throw new ValidationError(
        `El archivo supera el límite de ${policy.maxPesoMb} MB definido para esta ubicación (${file.originalname})`
      );
    }
    return;
  }

  if (opts.exemptUserIds.includes(opts.uploaderId)) {
    if (policy.maxPesoMb != null && file.size > policy.maxPesoMb * 1048576) {
      throw new ValidationError(`El archivo supera el máximo de ${policy.maxPesoMb} MB permitido (${file.originalname})`);
    }
    return;
  }

  const grupo = clasificarArchivoPorTipo(file.mimetype || '', file.originalname || '');
  if (!extensionListaPermite(file.originalname || '', policy.extensionesPermitidas)) {
    throw new ValidationError(`Extensión no permitida por la política de esta carpeta: ${file.originalname}`);
  }
  if (!grupoPermitido(policy, grupo)) {
    throw new ValidationError(`Tipo de contenido no permitido en esta carpeta (${file.originalname}). Solo se permite lo configurado por el administrador.`);
  }

  const políticaLimite = policy.maxPesoMb != null ? policy.maxPesoMb * 1048576 : opts.serverHardMaxBytes;
  const limiteFinal = Math.min(opts.serverHardMaxBytes, políticaLimite);

  if (file.size > limiteFinal) {
    throw new ValidationError(`El archivo excede el tamaño máximo permitido (${file.originalname})`);
  }
}
