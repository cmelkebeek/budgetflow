// Routes de la page Compte (utilisateur connecté) : mot de passe, e-mail, 2FA, passkeys.
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { Hono } from 'hono';
import { checkPassword, setPassword } from '../auth/passwords.ts';
import { beginPasskeyRegistration, deletePasskey, finishPasskeyRegistration, passkeysFor, renamePasskey } from '../auth/passkeys.ts';
import { generateRecoveryCodes, recoveryCodesLeft } from '../auth/recovery-codes.ts';
import { deleteOtherSessions, reauthenticate } from '../auth/sessions.ts';
import { disableTotp, enableTotp, startTotp } from '../auth/two-factor.ts';
import { normalizeEmail } from '../auth/users.ts';
import { get, run } from '../database/connection.ts';
import { type Env, requireRecentAuth } from '../http/session.ts';
import { fail, readBody, text } from '../http/validation.ts';
import { mailEnabled, sendInBackground, sendPasswordChangedEmail, sendTestEmail } from '../lib/mail.ts';
import type { Security } from '../../../shared/types.ts';

export const accountRoutes = new Hono<Env>();

accountRoutes.get('/me', (c) => c.json(c.var.user));

accountRoutes.get('/me/security', (c) => {
  const security: Security = { passkeys: passkeysFor(c.var.user.id), recoveryCodesLeft: recoveryCodesLeft(c.var.user.id), mailEnabled };
  return c.json(security);
});

// Confirme le mot de passe : débloque les actions sensibles pour 10 minutes sur cette session.
accountRoutes.post('/me/reauth', async (c) => {
  const result = reauthenticate(c.var.session, text((await readBody(c)).password, 'mot de passe'));
  if (result === 'locked') throw fail(429, 'Trop de tentatives, réessaie dans quelques minutes');
  if (result === 'invalid') throw fail(400, 'Mot de passe incorrect');
  return c.json({ ok: true });
});

// ---------- Mot de passe & e-mail ----------

accountRoutes.post('/me/password', async (c) => {
  const body = await readBody(c);
  const next = text(body.next, 'nouveau mot de passe');
  if (next.length < 8) throw fail(400, 'Le mot de passe doit faire au moins 8 caractères');
  if (!checkPassword(c.var.user.id, text(body.current, 'mot de passe actuel'))) throw fail(400, 'Mot de passe actuel incorrect');
  setPassword(c.var.user.id, next);
  // Les autres appareils (dont un éventuel intrus) sont déconnectés ; celui-ci reste connecté.
  deleteOtherSessions(c.var.user.id, c.var.session.tokenHash);
  const { email, displayName } = c.var.user;
  if (email && mailEnabled) sendInBackground(sendPasswordChangedEmail(email, displayName));
  return c.json({ ok: true });
});

// Changer d'adresse demande le mot de passe : c'est elle qui permet de le réinitialiser.
accountRoutes.post('/me/email', async (c) => {
  const body = await readBody(c);
  if (!checkPassword(c.var.user.id, text(body.password, 'mot de passe'))) throw fail(400, 'Mot de passe incorrect');
  const raw = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw fail(400, 'Adresse e-mail invalide');
  const email = raw.slice(0, 200) || null;
  if (email && get('SELECT 1 FROM users WHERE email = ? AND id != ?', email, c.var.user.id)) {
    throw fail(409, 'Cette adresse est déjà utilisée par un autre compte');
  }
  run('UPDATE users SET email = ? WHERE id = ?', email, c.var.user.id);
  return c.json({ ...c.var.user, email });
});

accountRoutes.post('/me/email/test', async (c) => {
  const { email, displayName } = c.var.user;
  if (!email) throw fail(400, "Ajoute d'abord une adresse e-mail");
  if (!mailEnabled) throw fail(409, "L'envoi d'e-mails n'est pas configuré sur le serveur");
  try {
    await sendTestEmail(email, displayName);
  } catch (err) {
    throw fail(400, `Échec de l'envoi : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
  }
  return c.json({ ok: true });
});

// ---------- Double authentification ----------

accountRoutes.post('/me/2fa/setup', (c) => {
  requireRecentAuth(c);
  if (c.var.user.twoFactor) throw fail(409, 'La double authentification est déjà active');
  return c.json(startTotp(c.var.user));
});

accountRoutes.post('/me/2fa/enable', async (c) => {
  requireRecentAuth(c);
  const recoveryCodes = enableTotp(c.var.user.id, text((await readBody(c)).code, 'code'));
  if (!recoveryCodes) throw fail(400, 'Code invalide');
  return c.json({ user: { ...c.var.user, twoFactor: true }, recoveryCodes });
});

accountRoutes.post('/me/2fa/disable', async (c) => {
  const body = await readBody(c);
  if (!disableTotp(c.var.user.id, text(body.password, 'mot de passe'), text(body.code, 'code'))) {
    throw fail(400, 'Mot de passe ou code invalide');
  }
  return c.json({ ...c.var.user, twoFactor: false });
});

// Remplace tous les codes de secours (les anciens deviennent invalides).
accountRoutes.post('/me/2fa/recovery-codes', (c) => {
  requireRecentAuth(c);
  if (!c.var.user.twoFactor) throw fail(409, "La double authentification n'est pas active");
  return c.json({ recoveryCodes: generateRecoveryCodes(c.var.user.id) });
});

// ---------- Passkeys ----------

accountRoutes.post('/me/passkeys/options', async (c) => {
  requireRecentAuth(c);
  return c.json(await beginPasskeyRegistration(c.var.user, c.req.header('origin')));
});

accountRoutes.post('/me/passkeys', async (c) => {
  const body = await readBody(c);
  const name = body.name === undefined ? 'Passkey' : text(body.name, 'nom');
  await finishPasskeyRegistration(c.var.user, body.response as RegistrationResponseJSON, name);
  return c.json(passkeysFor(c.var.user.id));
});

accountRoutes.patch('/me/passkeys/:id', async (c) => {
  renamePasskey(c.var.user.id, c.req.param('id'), text((await readBody(c)).name, 'nom'));
  return c.json(passkeysFor(c.var.user.id));
});

accountRoutes.delete('/me/passkeys/:id', (c) => {
  requireRecentAuth(c);
  deletePasskey(c.var.user.id, c.req.param('id'));
  return c.json(passkeysFor(c.var.user.id));
});
