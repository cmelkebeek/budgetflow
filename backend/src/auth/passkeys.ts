// Passkeys (WebAuthn) : connexion sans mot de passe par empreinte, Face ID, Windows Hello ou clé de sécurité.
// Une passkey est liée au domaine où elle a été créée : celle de localhost ne marche pas sur le domaine public.
import { randomBytes } from 'node:crypto';
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PUBLIC_ORIGINS } from '../config.ts';
import { all, get, run } from '../database/connection.ts';
import { fail } from '../http/validation.ts';
import type { Passkey, User } from '../../../shared/types.ts';
import { userById } from './users.ts';

function relyingParty(origin: string | undefined) {
  if (!origin || !PUBLIC_ORIGINS.includes(origin)) {
    throw fail(400, `Passkeys non autorisées depuis ${origin ?? 'cette adresse'} : ajoute-la à PUBLIC_URL`);
  }
  return { origin, rpID: new URL(origin).hostname };
}

// ---------- Défis en attente (mémoire, 5 min) ----------

const CHALLENGE_TTL = 5 * 60_000;
const MAX_CHALLENGES = 1000;
const challenges = new Map<string, { challenge: string; origin: string; expires: number }>();

function saveChallenge(key: string, challenge: string, origin: string) {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expires < now) challenges.delete(k);
  // Plafond contre une avalanche de demandes anonymes : on oublie les plus anciennes (Map garde l'ordre d'insertion).
  while (challenges.size >= MAX_CHALLENGES) challenges.delete(challenges.keys().next().value!);
  challenges.set(key, { challenge, origin, expires: now + CHALLENGE_TTL });
}

function takeChallenge(key: string) {
  const pending = challenges.get(key);
  challenges.delete(key);
  if (!pending || pending.expires < Date.now()) throw fail(400, 'Demande expirée, réessaie');
  return { ...pending, rpID: new URL(pending.origin).hostname };
}

// ---------- Stockage ----------

interface PasskeyRow {
  id: string;
  user_id: number;
  name: string;
  public_key: Uint8Array;
  counter: number;
  transports: string | null;
  rp_id: string;
  created_at: number;
  last_used_at: number | null;
}

const toPasskey = (r: PasskeyRow): Passkey => ({
  id: r.id,
  name: r.name,
  domain: r.rp_id,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

const transportsOf = (r: PasskeyRow) => (r.transports ? (JSON.parse(r.transports) as AuthenticatorTransport[]) : undefined);

export const passkeysFor = (userId: number) =>
  all<PasskeyRow>('SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at', userId).map(toPasskey);

function ownPasskey(userId: number, id: string) {
  if (!get('SELECT 1 FROM passkeys WHERE id = ? AND user_id = ?', id, userId)) throw fail(404, 'Passkey introuvable');
  return id;
}

export function renamePasskey(userId: number, id: string, name: string) {
  run('UPDATE passkeys SET name = ? WHERE id = ?', name, ownPasskey(userId, id));
}

export function deletePasskey(userId: number, id: string) {
  run('DELETE FROM passkeys WHERE id = ?', ownPasskey(userId, id));
}

// ---------- Connexion ----------

export async function beginPasskeyLogin(origin: string | undefined) {
  const rp = relyingParty(origin);
  // Passkeys « découvrables » : le navigateur propose lui-même le compte, pas besoin d'identifiant.
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required' });
  const challengeId = randomBytes(16).toString('base64url');
  saveChallenge(`auth:${challengeId}`, options.challenge, rp.origin);
  return { challengeId, options };
}

export async function finishPasskeyLogin(challengeId: string, response: AuthenticationResponseJSON): Promise<User> {
  const pending = takeChallenge(`auth:${challengeId}`);
  const row = typeof response?.id === 'string' ? get<PasskeyRow>('SELECT * FROM passkeys WHERE id = ?', response.id) : undefined;
  if (!row) throw fail(401, 'Passkey inconnue sur ce site');

  let newCounter: number | undefined;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: pending.rpID,
      credential: { id: row.id, publicKey: new Uint8Array(row.public_key), counter: row.counter, transports: transportsOf(row) },
      requireUserVerification: true,
    });
    if (result.verified) newCounter = result.authenticationInfo.newCounter;
  } catch {
    // Signature invalide, mauvais domaine… : même réponse que ci-dessous.
  }
  if (newCounter === undefined) throw fail(401, 'Passkey refusée');

  run('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?', newCounter, Date.now(), row.id);
  return userById(row.user_id)!;
}

// ---------- Enregistrement ----------

export async function beginPasskeyRegistration(user: User, origin: string | undefined) {
  const rp = relyingParty(origin);
  const existing = all<PasskeyRow>('SELECT * FROM passkeys WHERE user_id = ? AND rp_id = ?', user.id, rp.rpID);
  const options = await generateRegistrationOptions({
    rpName: 'BudgetFlow',
    rpID: rp.rpID,
    userName: user.username,
    userDisplayName: user.displayName,
    userID: new TextEncoder().encode(`budget-user-${user.id}`),
    attestationType: 'none',
    excludeCredentials: existing.map((r) => ({ id: r.id, transports: transportsOf(r) })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  saveChallenge(`reg:${user.id}`, options.challenge, rp.origin);
  return options;
}

export async function finishPasskeyRegistration(user: User, response: RegistrationResponseJSON, name: string) {
  const pending = takeChallenge(`reg:${user.id}`);

  let credential;
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: pending.rpID,
      requireUserVerification: true,
    });
    if (result.verified) credential = result.registrationInfo.credential;
  } catch {
    // Réponse invalide : même erreur que ci-dessous.
  }
  if (!credential) throw fail(400, "La passkey n'a pas pu être vérifiée");

  run(
    'INSERT INTO passkeys (id, user_id, name, public_key, counter, transports, rp_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    credential.id,
    user.id,
    name,
    credential.publicKey,
    credential.counter,
    credential.transports ? JSON.stringify(credential.transports) : null,
    pending.rpID,
    Date.now(),
  );
}
