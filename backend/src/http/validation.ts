// Erreurs HTTP et validation des entrées : tout ce qui vient du client est vérifié ici avant d'être utilisé.
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Fuel } from '../../../shared/types.ts';

// 403 est réservé à « confirme ton mot de passe » : le front affiche alors la demande et rejoue l'action.
export const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503, message: string) =>
  new HTTPException(status, { message });

export async function readBody(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Corps JSON invalide');
  return body as Record<string, unknown>;
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw fail(400, `Champ « ${field} » requis`);
  return value.trim().slice(0, 200);
}

export function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e9) {
    throw fail(400, `Champ « ${field} » invalide`);
  }
  return value;
}

function positive(value: unknown, field: string): number {
  const n = amount(value, field);
  if (n < 0) throw fail(400, `Champ « ${field} » invalide`);
  return n;
}

export function fuel(value: unknown): Fuel | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') throw fail(400, 'Paramètres essence invalides');
  const f = value as Record<string, unknown>;
  return {
    km: positive(f.km, 'km'),
    consumption: positive(f.consumption, 'consommation'),
    pricePerLiter: positive(f.pricePerLiter, 'prix du litre'),
    extra: amount(f.extra ?? 0, 'supplément'),
  };
}

export function monthParam(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw fail(404, 'Mois invalide');
  return value;
}

export function idParam(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw fail(404, 'Introuvable');
  return n;
}
