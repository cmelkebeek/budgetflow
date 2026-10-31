// Codes de secours de la 2FA : 10 codes à usage unique, stockés hachés.
import { randomInt } from 'node:crypto';
import { get, run, transaction } from '../database/connection.ts';
import { sha256 } from '../lib/hash.ts';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // sans 0/o, 1/l/i
const COUNT = 10;

const normalize = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '');

// Remplace tous les codes du compte ; renvoie les nouveaux en clair (affichés une seule fois).
export function generateRecoveryCodes(userId: number): string[] {
  const codes = Array.from({ length: COUNT }, () => {
    const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
  transaction(() => {
    run('DELETE FROM recovery_codes WHERE user_id = ?', userId);
    for (const code of codes) run('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)', userId, sha256(normalize(code)));
  });
  return codes;
}

export const recoveryCodesLeft = (userId: number) =>
  get<{ n: number }>('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ?', userId)!.n;

// Vrai si le code était valide ; il est alors supprimé.
export const consumeRecoveryCode = (userId: number, code: string) =>
  normalize(code).length === 8 &&
  Number(run('DELETE FROM recovery_codes WHERE user_id = ? AND code_hash = ?', userId, sha256(normalize(code))).changes) > 0;

export const deleteRecoveryCodes = (userId: number) => run('DELETE FROM recovery_codes WHERE user_id = ?', userId);
