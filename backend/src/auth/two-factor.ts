// Double authentification (TOTP). Les secrets sont chiffrés en base avec ENCRYPTION_KEY.
import { all, run, transaction } from '../database/connection.ts';
import { assertEncryptionKey, decrypt, encrypt, isEncrypted } from '../lib/encryption.ts';
import type { TotpSetup, User } from '../../../shared/types.ts';
import { verifyPassword } from './passwords.ts';
import { consumeRecoveryCode, deleteRecoveryCodes, generateRecoveryCodes } from './recovery-codes.ts';
import { newSecret, otpauthUri, verifyTotp } from './totp.ts';
import { type UserRow, userRow } from './users.ts';

// Valide un code TOTP et mémorise son pas de temps pour qu'il ne puisse pas resservir.
function consumeTotp(row: UserRow, encryptedSecret: string, code: string): boolean {
  const step = verifyTotp(decrypt(encryptedSecret), code, row.totp_last_step);
  if (step === null) return false;
  run('UPDATE users SET totp_last_step = ? WHERE id = ?', step, row.id);
  return true;
}

// Second facteur : code à 6 chiffres de l'application, ou code de secours (usage unique).
export function consumeSecondFactor(row: UserRow, code: string): boolean {
  if (!row.totp_secret) return false;
  return /^\s*\d{3}\s?\d{3}\s*$/.test(code) ? consumeTotp(row, row.totp_secret, code) : consumeRecoveryCode(row.id, code);
}

// Génère un secret en attente : il ne devient actif qu'après validation d'un premier code.
export function startTotp(user: User): TotpSetup {
  const secret = newSecret();
  run('UPDATE users SET totp_pending = ? WHERE id = ?', encrypt(secret), user.id);
  return { secret, uri: otpauthUri(secret, user.username) };
}

// Renvoie les codes de secours générés à l'activation, ou null si le code est faux.
export function enableTotp(userId: number, code: string): string[] | null {
  const row = userRow(userId);
  if (!row?.totp_pending || !consumeTotp(row, row.totp_pending, code)) return null;
  run('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL WHERE id = ?', userId);
  return generateRecoveryCodes(userId);
}

// Accepte un code de secours, pour pouvoir désactiver la 2FA après la perte du téléphone.
export function disableTotp(userId: number, password: string, code: string): boolean {
  const row = userRow(userId);
  if (!row || !verifyPassword(password, row.password_hash) || !consumeSecondFactor(row, code)) return false;
  transaction(() => {
    run('UPDATE users SET totp_secret = NULL, totp_pending = NULL WHERE id = ?', userId);
    deleteRecoveryCodes(userId);
  });
  return true;
}

/**
 * Au démarrage : vérifie que ENCRYPTION_KEY est définie, chiffre les secrets encore en clair
 * (bases antérieures au chiffrement), puis vérifie que la clé déchiffre bien tous les secrets.
 * Lève une erreur explicite sinon.
 */
export function prepareTwoFactorSecrets() {
  assertEncryptionKey();
  const rows = all<{ id: number; totp_secret: string | null; totp_pending: string | null }>(
    'SELECT id, totp_secret, totp_pending FROM users WHERE totp_secret IS NOT NULL OR totp_pending IS NOT NULL',
  );
  let migrated = 0;
  transaction(() => {
    for (const row of rows) {
      for (const column of ['totp_secret', 'totp_pending'] as const) {
        const value = row[column];
        if (value === null) continue;
        if (!isEncrypted(value)) {
          run(`UPDATE users SET ${column} = ? WHERE id = ?`, encrypt(value), row.id);
          migrated++;
          continue;
        }
        try {
          decrypt(value);
        } catch {
          throw new Error(
            'ENCRYPTION_KEY ne correspond pas à celle utilisée pour chiffrer les secrets 2FA. ' +
              'Remets la bonne clé, ou désactive la 2FA des comptes concernés avec : budget-cli disable-2fa <identifiant>',
          );
        }
      }
    }
  });
  if (migrated > 0) console.log(`${migrated} secret(s) 2FA chiffré(s).`);
}
