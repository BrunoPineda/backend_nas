import crypto from 'crypto';

function requireEnv(name: 'SICONTIGO_PASSWORD' | 'SICONTIGO_SALT'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} no está configurado en las variables de entorno`);
  }
  return value;
}

function sicontigoSalt(): Buffer {
  return Buffer.from(requireEnv('SICONTIGO_SALT'), 'utf8');
}

function sicontigoPassword(): string {
  return requireEnv('SICONTIGO_PASSWORD');
}

function deriveKeyAndIv() {
  const keyMaterial = crypto.pbkdf2Sync(sicontigoPassword(), sicontigoSalt(), 1000, 48, 'sha1');
  return {
    key: keyMaterial.subarray(0, 32),
    iv: keyMaterial.subarray(32, 48),
  };
}

/** SicontigoEncryptor: AES-256-CBC + PBKDF2 (1000 iter, SHA-1), texto UTF-16 LE. */
export function sicontigoEncrypt(clearText: string): string {
  const { key, iv } = deriveKeyAndIv();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(clearText, 'utf16le', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

export function sicontigoDecrypt(cipherText: string): string {
  const normalized = cipherText.replace(/ /g, '+');
  const { key, iv } = deriveKeyAndIv();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(normalized, 'base64', 'utf16le');
  decrypted += decipher.final('utf16le');
  return decrypted;
}
