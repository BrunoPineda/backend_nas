import { ValidationError } from '../../shared/errors/AppError';

export type UploadVigenciaParsed = {
  esPermanente: boolean;
  fechaInicioVigencia: Date | null;
  fechaFinVigencia: Date | null;
};

/** YYYY-MM-DD → medianoche UTC (compatibilidad). */
function parseDateOnlyUtc(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new ValidationError('Formato de fecha inválido (use YYYY-MM-DD o YYYY-MM-DDTHH:mm)');
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) {
    throw new ValidationError('Fecha inválida');
  }
  return dt;
}

function floorToMinute(d: Date): Date {
  const x = new Date(d.getTime());
  x.setSeconds(0, 0);
  x.setMilliseconds(0);
  return x;
}

function cmpMinute(a: Date, b: Date): number {
  return floorToMinute(a).getTime() - floorToMinute(b).getTime();
}

/** ISO, datetime-local (sin Z) o solo fecha. */
function parseDateTime(raw: string): Date {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseDateOnlyUtc(s);
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) {
    throw new ValidationError('Formato de fecha y hora inválido');
  }
  return dt;
}

function cmpTime(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function resolveInicioVigencia(inicioRaw: string | null, ahora: Date): Date {
  let fechaInicio = inicioRaw?.trim() ? parseDateTime(inicioRaw.trim()) : ahora;

  if (isSameLocalDay(fechaInicio, ahora) && fechaInicio.getTime() < ahora.getTime()) {
    return ahora;
  }

  if (!isSameLocalDay(fechaInicio, ahora) && cmpMinute(fechaInicio, ahora) < 0) {
    throw new ValidationError('La fecha de inicio no puede ser anterior a hoy');
  }

  if (fechaInicio.getTime() < ahora.getTime()) {
    fechaInicio = ahora;
  }

  return fechaInicio;
}

/** Body multipart: vigenciaPermanente, vigenciaInicio?, vigenciaFin? (ISO UTC o datetime-local). */
export function parseUploadVigenciaFromBody(body: Record<string, unknown>): UploadVigenciaParsed {
  const permRaw = body.vigenciaPermanente;
  const esPermanente =
    permRaw === undefined ||
    permRaw === null ||
    permRaw === '' ||
    permRaw === true ||
    String(permRaw).toLowerCase() === 'true' ||
    String(permRaw) === '1';

  if (esPermanente) {
    return { esPermanente: true, fechaInicioVigencia: null, fechaFinVigencia: null };
  }

  const finRaw = body.vigenciaFin != null ? String(body.vigenciaFin).trim() : '';
  if (!finRaw) {
    throw new ValidationError('Indica la fecha y hora fin o marca el archivo como permanente');
  }

  const ahora = new Date();
  const inicioRaw = body.vigenciaInicio != null ? String(body.vigenciaInicio).trim() : '';
  const fechaInicio = resolveInicioVigencia(inicioRaw || null, ahora);

  const fechaFin = parseDateTime(finRaw);
  if (cmpTime(fechaFin, fechaInicio) < 0) {
    throw new ValidationError('La fecha y hora fin debe ser igual o posterior al inicio');
  }

  return { esPermanente: false, fechaInicioVigencia: fechaInicio, fechaFinVigencia: fechaFin };
}
