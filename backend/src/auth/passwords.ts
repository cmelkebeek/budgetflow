import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { run } from '../database/connection.ts';
import { userRow } from './users.ts';

// scrypt : volontairement lent, pour rendre coûteuse toute tentative de deviner un mot de passe à partir d'un hachage.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  return timingSafeEqual(expected, scryptSync(password, Buffer.from(salt, 'hex'), expected.length));
}

// Vérifié quand le compte n'existe pas, pour que le temps de réponse ne révèle pas son existence.
export const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

export function checkPassword(userId: number, password: string): boolean {
  const row = userRow(userId);
  return row !== undefined && verifyPassword(password, row.password_hash);
}

export function setPassword(userId: number, password: string) {
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), userId);
}
