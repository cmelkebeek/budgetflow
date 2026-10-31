// Charges récurrentes : recopiées dans chaque nouveau mois, avec « ma part » en %.
import { Hono } from 'hono';
import { all, get, run } from '../database/connection.ts';
import type { Env } from '../http/session.ts';
import { amount, fail, fuel, idParam, readBody, text } from '../http/validation.ts';
import { type Fuel, fuelCost, type Recurring } from '../../../shared/types.ts';

export const parseFuel = (json: string | null): Fuel | null => (json ? (JSON.parse(json) as Fuel) : null);

export function recurringFor(userId: number): Recurring[] {
  return all<{ id: number; name: string; amount: number; share: number; fuel: string | null }>(
    'SELECT * FROM recurring WHERE user_id = ? ORDER BY name COLLATE NOCASE',
    userId,
  ).map((r) => ({ id: r.id, name: r.name, amount: r.amount, share: r.share, fuel: parseFuel(r.fuel) }));
}

function readRecurring(body: Record<string, unknown>) {
  const f = fuel(body.fuel);
  const share = amount(body.share ?? 100, 'part');
  if (share <= 0 || share > 100) throw fail(400, 'La part doit être comprise entre 0 et 100 %');
  return {
    name: text(body.name, 'nom'),
    amount: f ? fuelCost(f) : amount(body.amount, 'montant'),
    share,
    fuel: f ? JSON.stringify(f) : null,
  };
}

function ownRecurring(recurringId: number, userId: number) {
  if (!get('SELECT 1 FROM recurring WHERE id = ? AND user_id = ?', recurringId, userId)) throw fail(404, 'Charge introuvable');
  return recurringId;
}

export const recurringRoutes = new Hono<Env>();

recurringRoutes.get('/', (c) => c.json(recurringFor(c.var.user.id)));

recurringRoutes.post('/', async (c) => {
  const r = readRecurring(await readBody(c));
  run('INSERT INTO recurring (user_id, name, amount, share, fuel) VALUES (?, ?, ?, ?, ?)', c.var.user.id, r.name, r.amount, r.share, r.fuel);
  return c.json(recurringFor(c.var.user.id));
});

recurringRoutes.put('/:id', async (c) => {
  const id = ownRecurring(idParam(c.req.param('id')), c.var.user.id);
  const r = readRecurring(await readBody(c));
  run('UPDATE recurring SET name = ?, amount = ?, share = ?, fuel = ? WHERE id = ?', r.name, r.amount, r.share, r.fuel, id);
  return c.json(recurringFor(c.var.user.id));
});

recurringRoutes.delete('/:id', (c) => {
  run('DELETE FROM recurring WHERE id = ?', ownRecurring(idParam(c.req.param('id')), c.var.user.id));
  return c.json(recurringFor(c.var.user.id));
});
