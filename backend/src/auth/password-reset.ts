// Réinitialisation du mot de passe par lien e-mail (valable 30 minutes, usage unique).
import { randomBytes } from 'node:crypto';
import { get, run, transaction } from '../database/connection.ts';
import { sha256 } from '../lib/hash.ts';
import type { User } from '../../../shared/types.ts';
import { clearFailures } from './attempts.ts';
import { setPassword } from './passwords.ts';
import { deleteAllSessions } from './sessions.ts';
import { userById } from './users.ts';

const RESET_TTL = 30 * 60_000;

// Un seul lien valide à la fois par compte : en redemander un annule le précédent.
export function createResetToken(userId: number): string {
  const token = randomBytes(32).toString('base64url');
  transaction(() => {
    run('DELETE FROM password_resets WHERE user_id = ?', userId);
    run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, Date.now() + RESET_TTL);
  });
  return token;
}

// Change le mot de passe si le lien est valide et ferme toutes les sessions. Renvoie le compte concerné.
export function resetPassword(token: string, password: string): User | undefined {
  const reset = get<{ user_id: number }>(
    'SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?',
    sha256(token),
    Date.now(),
  );
  if (!reset) return undefined;
  transaction(() => {
    setPassword(reset.user_id, password);
    run('DELETE FROM password_resets WHERE user_id = ?', reset.user_id);
    deleteAllSessions(reset.user_id);
  });
  const user = userById(reset.user_id)!;
  clearFailures(user.username);
  return user;
}
