import type { DatabaseSync } from 'node:sqlite';

const TABLES = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  -- token = hachage SHA-256 du jeton de session (jamais le jeton lui-même).
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- Charges recopiées dans chaque nouveau mois. share = ma part en % du montant.
  CREATE TABLE IF NOT EXISTS recurring (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    share REAL NOT NULL DEFAULT 100,
    fuel TEXT
  );

  CREATE TABLE IF NOT EXISTS months (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    income REAL NOT NULL DEFAULT 0,
    UNIQUE (user_id, month)
  );

  CREATE TABLE IF NOT EXISTS wishes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  );

  -- id = identifiant de la passkey (base64url) ; rp_id = domaine sur lequel elle a été créée.
  CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL,
    transports TEXT,
    rp_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  );

  -- Codes de secours de la 2FA, stockés hachés, utilisables une seule fois.
  CREATE TABLE IF NOT EXISTS recovery_codes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    PRIMARY KEY (user_id, code_hash)
  );

  -- Liens de réinitialisation du mot de passe : seul le hachage du jeton est stocké.
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- Lignes d'un mois : montant = ma part, figé à la création pour garder l'historique.
  CREATE TABLE IF NOT EXISTS lines (
    id INTEGER PRIMARY KEY,
    month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL CHECK (kind IN ('recurring', 'purchase', 'extra')),
    share REAL NOT NULL DEFAULT 100,
    fuel TEXT,
    recurring_id INTEGER REFERENCES recurring(id) ON DELETE SET NULL,
    wish_id INTEGER REFERENCES wishes(id) ON DELETE SET NULL
  );
`;

// Colonnes ajoutées après coup : créées sur les bases existantes sans toucher aux données.
const ADDED_COLUMNS: [table: string, column: string, definition: string][] = [
  ['users', 'totp_secret', 'TEXT'], // chiffré (voir lib/encryption.ts)
  ['users', 'totp_pending', 'TEXT'], // chiffré, en attente du premier code
  ['users', 'totp_last_step', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'email', 'TEXT'],
  ['sessions', 'verified_at', 'INTEGER NOT NULL DEFAULT 0'],
];

export function applySchema(db: DatabaseSync) {
  db.exec(TABLES);

  for (const [table, column, definition] of ADDED_COLUMNS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)');

  // Anciennes sessions stockées en clair (avant le hachage SHA-256, 64 caractères hex) : il suffit de se reconnecter.
  db.exec('DELETE FROM sessions WHERE length(token) != 64');
}
