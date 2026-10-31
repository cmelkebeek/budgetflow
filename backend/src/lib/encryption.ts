// Chiffrement AES-256-GCM des secrets stockés en base (secrets 2FA).
// La clé vient de ENCRYPTION_KEY, hors du volume : une copie de la base ou d'une sauvegarde ne suffit pas à les lire.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ENCRYPTION_KEY } from '../config.ts';

const PREFIX = 'enc:v1:';
let key: Buffer | undefined;

function getKey(): Buffer {
  if (!key) {
    if (ENCRYPTION_KEY.length < 32) {
      throw new Error('ENCRYPTION_KEY manquante ou trop courte (32 caractères minimum). Génère-la avec : openssl rand -base64 32');
    }
    // Dérive une clé de 256 bits de longueur fixe, quelle que soit la forme de la valeur fournie.
    key = createHash('sha256').update(ENCRYPTION_KEY).digest();
  }
  return key;
}

// Appelée au démarrage : mieux vaut refuser de démarrer que d'échouer plus tard, à l'activation de la 2FA.
export const assertEncryptionKey = () => void getKey();

export const isEncrypted = (value: string) => value.startsWith(PREFIX);

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

// Lève une erreur si la valeur a été altérée ou chiffrée avec une autre clé.
export function decrypt(stored: string): string {
  if (!isEncrypted(stored)) throw new Error('Valeur non chiffrée');
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}
