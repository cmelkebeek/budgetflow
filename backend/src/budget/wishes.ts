// Liste de souhaits : ce qu'on aimerait s'offrir, à placer dans un mois quand le budget le permet.
import { Hono } from 'hono';
import { all, get, run, transaction } from '../database/connection.ts';
import type { Env } from '../http/session.ts';
import { amount, fail, idParam, link, priority, readBody, text } from '../http/validation.ts';
import type { Priority, Wish } from '../../../shared/types.ts';

function wishesFor(userId: number): Wish[] {
  return all<{ id: number; name: string; price: number; priority: Priority; url: string | null; done: number; planned_month: string | null }>(
    `SELECT w.*, (SELECT m.month FROM lines l JOIN months m ON m.id = l.month_id WHERE l.wish_id = w.id LIMIT 1) AS planned_month
     FROM wishes w WHERE w.user_id = ? ORDER BY w.done, w.priority, w.id`,
    userId,
  ).map((w) => ({
    id: w.id,
    name: w.name,
    price: w.price,
    priority: w.priority,
    url: w.url,
    done: w.done === 1,
    plannedMonth: w.planned_month,
  }));
}

function ownWish(wishId: number, userId: number) {
  if (!get('SELECT 1 FROM wishes WHERE id = ? AND user_id = ?', wishId, userId)) throw fail(404, 'Souhait introuvable');
  return wishId;
}

export const wishRoutes = new Hono<Env>();

wishRoutes.get('/', (c) => c.json(wishesFor(c.var.user.id)));

wishRoutes.post('/', async (c) => {
  const body = await readBody(c);
  run(
    'INSERT INTO wishes (user_id, name, price, priority, url) VALUES (?, ?, ?, ?, ?)',
    c.var.user.id,
    text(body.name, 'nom'),
    amount(body.price, 'prix'),
    priority(body.priority ?? 2),
    link(body.url),
  );
  return c.json(wishesFor(c.var.user.id));
});

wishRoutes.patch('/:id', async (c) => {
  const id = ownWish(idParam(c.req.param('id')), c.var.user.id);
  const body = await readBody(c);
  transaction(() => {
    if (body.name !== undefined) run('UPDATE wishes SET name = ? WHERE id = ?', text(body.name, 'nom'), id);
    if (body.price !== undefined) run('UPDATE wishes SET price = ? WHERE id = ?', amount(body.price, 'prix'), id);
    if (body.priority !== undefined) run('UPDATE wishes SET priority = ? WHERE id = ?', priority(body.priority), id);
    if (body.url !== undefined) run('UPDATE wishes SET url = ? WHERE id = ?', link(body.url), id);
    if (body.done !== undefined) run('UPDATE wishes SET done = ? WHERE id = ?', body.done === true ? 1 : 0, id);
  });
  return c.json(wishesFor(c.var.user.id));
});

wishRoutes.delete('/:id', (c) => {
  run('DELETE FROM wishes WHERE id = ?', ownWish(idParam(c.req.param('id')), c.var.user.id));
  return c.json(wishesFor(c.var.user.id));
});
