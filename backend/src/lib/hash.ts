import { createHash } from 'node:crypto';

// Pour les valeurs aléatoires à haute entropie (jetons, codes de secours) : un SHA-256 suffit.
// Les mots de passe, eux, utilisent scrypt (voir auth/passwords.ts).
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
