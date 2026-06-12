import { Request } from 'express';

export function getClientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).split(',')[0].trim();
  }
  const raw = req.socket?.remoteAddress;
  return raw != null ? raw : null;
}

export function safeJsonDetalle(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return '{}';
  }
}
