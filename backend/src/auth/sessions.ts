// Sessions : la base ne stocke que le hachage du jeton, une fuite du fichier ne permet donc pas de reprendre une session.
import { randomBytes } from 'node:crypto';
import { get, run } from '../database/connection.ts';
import { sha256 } from '../lib/hash.ts';
import type { User } from '../../../shared/types.ts';
import { isLocked, purgeFailures, recordFailure } from './attempts.ts';
import { checkPassword } from './passwords.ts';
import { toUser, type UserRow } from './users.ts';

export const SESSION_DAYS = 30;

// Durée pendant laquelle les actions sensibles ne redemandent pas le mot de passe.
export const REAUTH_MS = 10 * 60_000;

export interface Session {
  user: User;
  tokenHash: string;
  verifiedAt: number; // dernière preuve d'identité (connexion ou mot de passe redemandé)
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  run(
    'INSERT INTO sessions (token, user_id, expires_at, verified_at) VALUES (?, ?, ?, ?)',
    sha256(token),
    userId,
    now + SESSION_DAYS * 86_400_000,
    now,
  );
  return token;
}

export function findSession(token: string): Session | undefined {
  const tokenHash = sha256(token);
  const row = get<UserRow & { session_verified_at: number }>(
    `SELECT u.*, s.verified_at AS session_verified_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    tokenHash,
    Date.now(),
  );
  return row && { user: toUser(row), tokenHash, verifiedAt: row.session_verified_at };
}

export const deleteSession = (token: string) => run('DELETE FROM sessions WHERE token = ?', sha256(token));

export const deleteAllSessions = (userId: number) => run('DELETE FROM sessions WHERE user_id = ?', userId);

// Après un changement de mot de passe : seuls les autres appareils sont déconnectés.
export const deleteOtherSessions = (userId: number, keepTokenHash: string) =>
  run('DELETE FROM sessions WHERE user_id = ? AND token != ?', userId, keepTokenHash);

// Redemande du mot de passe avant une action sensible. Compte dans la limite d'essais, comme la connexion.
export function reauthenticate(session: Session, password: string): 'ok' | 'invalid' | 'locked' {
  const key = session.user.username;
  if (isLocked(key)) return 'locked';
  if (!checkPassword(session.user.id, password)) {
    recordFailure(key);
    return 'invalid';
  }
  run('UPDATE sessions SET verified_at = ? WHERE token = ?', Date.now(), session.tokenHash);
  return 'ok';
}

export function purgeExpired() {
  run('DELETE FROM sessions WHERE expires_at <= ?', Date.now());
  run('DELETE FROM password_resets WHERE expires_at <= ?', Date.now());
  purgeFailures();
}
