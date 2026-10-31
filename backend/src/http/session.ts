// Cookie de session et contrôle d'accès des routes protégées.
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createSession, deleteSession, findSession, REAUTH_MS, type Session, SESSION_DAYS } from '../auth/sessions.ts';
import { SECURE_COOKIE } from '../config.ts';
import type { User } from '../../../shared/types.ts';
import { fail } from './validation.ts';

export type Env = { Variables: { user: User; session: Session } };

const COOKIE = 'session';

export function openSession(c: Context, userId: number) {
  setCookie(c, COOKIE, createSession(userId), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: SECURE_COOKIE,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function closeSession(c: Context) {
  const token = getCookie(c, COOKIE);
  if (token) deleteSession(token);
  deleteCookie(c, COOKIE, { path: '/' });
}

// Rend c.var.user et c.var.session disponibles, ou répond 401.
export const requireSession: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  const session = token ? findSession(token) : undefined;
  if (!session) throw fail(401, 'Non connecté');
  c.set('user', session.user);
  c.set('session', session);
  await next();
};

// Actions sensibles (passkeys, 2FA, codes de secours) : identité prouvée il y a moins de 10 minutes.
export function requireRecentAuth(c: Context<Env>) {
  if (Date.now() - c.var.session.verifiedAt > REAUTH_MS) throw fail(403, 'Confirme ton mot de passe pour continuer');
}
