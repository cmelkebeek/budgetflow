// Protections HTTP appliquées à toutes les requêtes.
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { PUBLIC_ORIGINS } from '../config.ts';
import { fail } from './validation.ts';

export const securityHeaders = secureHeaders({
  // Seuls les fichiers de l'app peuvent s'exécuter ; l'app ne peut pas être intégrée dans une autre page.
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
  // Sans includeSubDomains : ne pas imposer le HTTPS aux autres services du domaine.
  strictTransportSecurity: 'max-age=15552000',
  crossOriginEmbedderPolicy: false,
  referrerPolicy: 'no-referrer',
  xFrameOptions: 'DENY',
});

export const limitBodySize = bodyLimit({
  maxSize: 64 * 1024,
  onError: () => {
    throw fail(413, 'Requête trop volumineuse');
  },
});

function isSameOrigin(c: Context, origin: string) {
  if (PUBLIC_ORIGINS.includes(origin)) return true;
  try {
    return new URL(origin).host === (c.req.header('x-forwarded-host') ?? c.req.header('host'));
  } catch {
    return false; // Origin « null » (iframe isolée, fichier local…)
  }
}

// Anti-CSRF : une requête qui modifie des données doit venir de l'app elle-même. Le cookie SameSite=Lax ne suffit pas,
// car il est aussi envoyé depuis les autres sous-domaines du même domaine (les autres services derrière Pangolin).
export const sameOriginOnly: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin');
  // Les navigateurs envoient toujours Origin sur ces méthodes ; son absence = client hors navigateur (curl…).
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && origin && !isSameOrigin(c, origin)) {
    throw fail(400, 'Requête refusée : origine non autorisée');
  }
  await next();
};
