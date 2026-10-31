// Toute la configuration vient des variables d'environnement (voir docker-compose.yml).

export const PORT = Number(process.env.PORT ?? 3000);
export const DB_PATH = process.env.DB_PATH ?? 'data/budget.db';
export const FRONTEND_DIR = process.env.FRONTEND_DIR ?? 'dist/frontend';

// Adresse(s) publique(s) de l'app (PUBLIC_URL, séparées par des virgules).
// La première sert aux liens envoyés par e-mail ; toutes sont acceptées pour les passkeys.
export const PUBLIC_ORIGINS = (process.env.PUBLIC_URL ?? 'http://localhost:3000')
  .split(',')
  .map((url) => new URL(url.trim()).origin);

export const APP_URL = PUBLIC_ORIGINS[0];

// Cookie réservé au HTTPS dès que l'adresse publique est en https (COOKIE_SECURE permet de forcer l'un ou l'autre).
export const SECURE_COOKIE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : APP_URL.startsWith('https://');

// Clé de chiffrement des secrets 2FA. Volontairement hors de la base : une copie du volume seule ne suffit pas.
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() ?? '';

export const SMTP = {
  host: process.env.SMTP_HOST?.trim() ?? '',
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'Budget <budget@localhost>',
};
