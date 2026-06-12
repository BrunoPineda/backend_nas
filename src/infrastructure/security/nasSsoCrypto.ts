import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function getNasSsoFlag(): string {
  return process.env.NAS_SSO_FLAG || 'NAS_SSO_2026';
}

export function isValidNasSsoFlag(flag: unknown): boolean {
  return typeof flag === 'string' && flag.trim() === getNasSsoFlag();
}

export function decryptNasSsoCoduser(encrypted: string): string {
  const secret = process.env.NAS_SSO_SECRET;
  if (!secret) {
    throw new Error('NAS_SSO_SECRET no configurado');
  }

  const buf = Buffer.from(encrypted, 'base64');
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error('Payload cifrado inválido');
  }

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const key = deriveKey(secret);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  const dni = decrypted.toString('utf8').trim();

  if (!/^\d{6,12}$/.test(dni)) {
    throw new Error('DNI descifrado inválido');
  }

  return dni;
}
