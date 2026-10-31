import { get } from '../database/connection.ts';
import type { User } from '../../../shared/types.ts';

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  totp_secret: string | null; // chiffré
  totp_pending: string | null; // chiffré
  totp_last_step: number;
  email: string | null;
}

export const toUser = (r: UserRow): User => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  email: r.email,
  twoFactor: r.totp_secret !== null,
});

export const userRow = (id: number) => get<UserRow>('SELECT * FROM users WHERE id = ?', id);

export const userRowByUsername = (username: string) =>
  get<UserRow>('SELECT * FROM users WHERE username = ?', username.toLowerCase());

export function userById(id: number): User | undefined {
  const row = userRow(id);
  return row && toUser(row);
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Compte retrouvé par identifiant ou e-mail, seulement s'il a une adresse (pour la réinitialisation).
export function findUserForReset(identifier: string): User | undefined {
  const key = identifier.trim().toLowerCase();
  const row = get<UserRow>('SELECT * FROM users WHERE (username = ? OR email = ?) AND email IS NOT NULL', key, key);
  return row && toUser(row);
}
