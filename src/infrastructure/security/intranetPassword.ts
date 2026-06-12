import bcrypt from 'bcrypt';
import { sicontigoDecrypt, sicontigoEncrypt } from './sicontigoCrypto';

export type IntranetClaveAlmacenada = {
  /** Clave AES Sicontigo (tbl_mst_usuario.vClave) */
  vClave?: string | null;
  /** Campo password de tbl_mst_usuarios (legacy alternativo) */
  passwordBuffer?: Buffer | null;
};

/**
 * Valida contraseña como el login legacy SIG:
 * Encrypt(texto plano) === vClave (Base64 AES-256-CBC / PBKDF2).
 */
export async function validateIntranetPassword(
  plain: string,
  stored: IntranetClaveAlmacenada
): Promise<boolean> {
  const trimmed = plain.trim();
  if (!trimmed) return false;

  const vClave = stored.vClave?.trim();
  if (vClave) {
    const normalizedStored = vClave.replace(/ /g, '+');
    try {
      const decrypted = sicontigoDecrypt(normalizedStored).replace(/\0/g, '').trim();
      if (decrypted === trimmed) return true;
    } catch {
      /* noop */
    }
    try {
      const encrypted = sicontigoEncrypt(trimmed);
      if (encrypted === normalizedStored) return true;
    } catch {
      /* noop */
    }
  }

  const buf = stored.passwordBuffer;
  if (!buf || buf.length === 0) return false;

  const asUtf8 = buf.toString('utf8').trim();
  const asLatin = buf.toString('latin1').trim();

  if (asUtf8.startsWith('$2a$') || asUtf8.startsWith('$2b$') || asUtf8.startsWith('$2y$')) {
    try {
      if (await bcrypt.compare(trimmed, asUtf8)) return true;
    } catch {
      /* noop */
    }
  }

  if (trimmed === asUtf8 || trimmed === asLatin) return true;

  try {
    const utf16 = buf.toString('utf16le').replace(/\0/g, '').trim();
    if (trimmed === utf16) return true;
  } catch {
    /* noop */
  }

  if (vClave == null && (asUtf8.includes('=') || asUtf8.includes('+'))) {
    try {
      if (sicontigoEncrypt(trimmed) === asUtf8.replace(/ /g, '+')) return true;
    } catch {
      /* noop */
    }
  }

  return false;
}
