// Routes publiques : connexion, déconnexion, passkeys, mot de passe oublié.
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { Hono } from 'hono';
import { mailEnabled, sendInBackground, sendPasswordChangedEmail, sendResetEmail } from '../lib/mail.ts';
import { closeSession, type Env, openSession } from '../http/session.ts';
import { fail, readBody, text } from '../http/validation.ts';
import { login } from './login.ts';
import { beginPasskeyLogin, finishPasskeyLogin } from './passkeys.ts';
import { createResetToken, resetPassword } from './password-reset.ts';
import { findUserForReset } from './users.ts';

export const authRoutes = new Hono<Env>();

authRoutes.post('/login', async (c) => {
  const body = await readBody(c);
  const code = typeof body.code === 'string' ? body.code : undefined;
  const user = login(text(body.username, 'identifiant'), text(body.password, 'mot de passe'), code);
  if (user === 'locked') throw fail(429, 'Trop de tentatives, réessaie dans quelques minutes');
  if (user === 'invalid') throw fail(401, 'Identifiant ou mot de passe incorrect');
  if (user === 'invalid-code') throw fail(401, 'Code invalide');
  // Mot de passe correct mais 2FA active : le front demande le code puis renvoie le tout.
  if (user === 'code-required') return c.json({ twoFactorRequired: true });
  openSession(c, user.id);
  return c.json(user);
});

authRoutes.post('/logout', (c) => {
  closeSession(c);
  return c.json({ ok: true });
});

// ---------- Passkeys ----------

authRoutes.post('/passkey/options', async (c) => c.json(await beginPasskeyLogin(c.req.header('origin'))));

authRoutes.post('/passkey/login', async (c) => {
  const body = await readBody(c);
  const user = await finishPasskeyLogin(text(body.challengeId, 'défi'), body.response as AuthenticationResponseJSON);
  openSession(c, user.id);
  return c.json(user);
});

// ---------- Mot de passe oublié ----------

const RESEND_DELAY = 60_000;
const lastSent = new Map<number, number>();

authRoutes.post('/password/forgot', async (c) => {
  if (!mailEnabled) throw fail(503, "L'envoi d'e-mails n'est pas configuré sur ce serveur");
  const user = findUserForReset(text((await readBody(c)).identifier, 'identifiant ou e-mail'));
  // Toujours la même réponse, que le compte existe ou non ; l'envoi se fait en arrière-plan
  // pour que le temps de réponse ne trahisse rien non plus.
  if (user?.email && Date.now() - (lastSent.get(user.id) ?? 0) > RESEND_DELAY) {
    lastSent.set(user.id, Date.now());
    sendInBackground(sendResetEmail(user.email, user.displayName, createResetToken(user.id)));
  }
  return c.json({ ok: true });
});

authRoutes.post('/password/reset', async (c) => {
  const body = await readBody(c);
  const password = text(body.password, 'mot de passe');
  if (password.length < 8) throw fail(400, 'Le mot de passe doit faire au moins 8 caractères');
  const user = resetPassword(text(body.token, 'lien'), password);
  if (!user) throw fail(400, 'Ce lien est invalide ou a expiré. Refais une demande.');
  if (user.email) sendInBackground(sendPasswordChangedEmail(user.email, user.displayName));
  return c.json({ ok: true, twoFactor: user.twoFactor });
});
