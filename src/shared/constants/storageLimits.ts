/** Límite de almacenamiento por usuario (cuota total en BD). */
export const MIN_USER_STORAGE_BYTES = 1073741824; // 1 GiB
export const MAX_USER_STORAGE_BYTES = 53687091200; // 50 GiB

/** Tamaño máximo por archivo (env `MAX_FILE_SIZE_BYTES`). */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 1073741824; // 1 GiB

/** Máximo de archivos en una subida masiva (env `MAX_BULK_UPLOAD_FILES`). */
export const DEFAULT_MAX_BULK_UPLOAD_FILES = 10;

export function getMaxFileSizeBytes(): number {
  const raw = parseInt(process.env.MAX_FILE_SIZE_BYTES || String(DEFAULT_MAX_FILE_SIZE_BYTES), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_FILE_SIZE_BYTES;
}

export function getMaxBulkUploadFiles(): number {
  const raw = parseInt(process.env.MAX_BULK_UPLOAD_FILES || String(DEFAULT_MAX_BULK_UPLOAD_FILES), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_BULK_UPLOAD_FILES;
}

export function formatByteLimit(bytes: number): string {
  if (bytes >= 1073741824) {
    const gb = bytes / 1073741824;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / 1048576;
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}
