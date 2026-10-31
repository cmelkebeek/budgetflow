import type { User } from '../../../shared/types.ts';
import { clearFailures, isLocked, recordFailure } from './attempts.ts';
import { DUMMY_HASH, verifyPassword } from './passwords.ts';
import { consumeSecondFactor } from './two-factor.ts';
import { toUser, userRowByUsername } from './users.ts';

export type LoginResult = User | 'invalid' | 'locked' | 'code-required' | 'invalid-code';

// Connexion par mot de passe, puis code 2FA (ou code de secours) si la 2FA est active.
export function login(username: string, password: string, code?: string): LoginResult {
  const key = username.toLowerCase();
  if (isLocked(key)) return 'locked';

  const row = userRowByUsername(key);
  const valid = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !valid) {
    recordFailure(key);
    return 'invalid';
  }
  if (row.totp_secret) {
    if (code === undefined) return 'code-required';
    if (!consumeSecondFactor(row, code)) {
      recordFailure(key);
      return 'invalid-code';
    }
  }
  clearFailures(key);
  return toUser(row);
}
