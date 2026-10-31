// Point d'entrée du serveur : assemble les protections, les routes et le front.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { accountRoutes } from './account/routes.ts';
import { authRoutes } from './auth/routes.ts';
import { purgeExpired } from './auth/sessions.ts';
import { prepareTwoFactorSecrets } from './auth/two-factor.ts';
import { monthRoutes, lineRoutes } from './budget/months.ts';
import { recurringRoutes } from './budget/recurring.ts';
import { wishRoutes } from './budget/wishes.ts';
import { FRONTEND_DIR, PORT } from './config.ts';
import { limitBodySize, sameOriginOnly, securityHeaders } from './http/security.ts';
import { type Env, requireSession } from './http/session.ts';

// Refuse de démarrer si la clé de chiffrement manque ou ne correspond pas aux secrets 2FA existants.
try {
  prepareTwoFactorSecrets();
} catch (err) {
  console.error(`Démarrage impossible : ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const app = new Hono<Env>();

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Erreur interne' }, 500);
});

app.use('*', securityHeaders);
app.use('/api/*', limitBodySize, sameOriginOnly);

// Routes publiques, déclarées avant le contrôle de session.
app.route('/api', authRoutes);

// Tout le reste de l'API demande d'être connecté.
app.use('/api/*', requireSession);
app.route('/api', accountRoutes);
app.route('/api/recurring', recurringRoutes);
app.route('/api/months', monthRoutes);
app.route('/api/lines', lineRoutes);
app.route('/api/wishes', wishRoutes);
app.all('/api/*', (c) => c.json({ error: 'Introuvable' }, 404));

// Front (application monopage) : fichiers construits, et index.html pour toute autre adresse.
app.use('/*', serveStatic({ root: FRONTEND_DIR }));
app.get('*', serveStatic({ path: `${FRONTEND_DIR}/index.html` }));

purgeExpired();
setInterval(purgeExpired, 3_600_000).unref();

serve({ fetch: app.fetch, port: PORT }, () => console.log(`BudgetFlow sur http://localhost:${PORT}`));
