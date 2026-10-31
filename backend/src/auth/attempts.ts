// Limite d'essais par compte : 5 échecs (mot de passe ou code) bloquent 5 minutes. Gardée en mémoire.

const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60_000;

const failures = new Map<string, { count: number; lockedUntil: number; at: number }>();

export const isLocked = (username: string) => (failures.get(username)?.lockedUntil ?? 0) > Date.now();

export function recordFailure(username: string) {
  const count = (failures.get(username)?.count ?? 0) + 1;
  const locked = count >= MAX_FAILURES;
  failures.set(username, { count: locked ? 0 : count, lockedUntil: locked ? Date.now() + LOCK_MS : 0, at: Date.now() });
}

export const clearFailures = (username: string) => failures.delete(username);

// Oublie les échecs anciens, pour que des essais sur des milliers d'identifiants bidon ne remplissent pas la mémoire.
export function purgeFailures() {
  const now = Date.now();
  for (const [key, entry] of failures) if (entry.at < now - LOCK_MS && entry.lockedUntil < now) failures.delete(key);
}
