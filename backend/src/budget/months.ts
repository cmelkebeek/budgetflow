// Mois et leurs lignes de dépenses. Le montant d'une ligne est figé à la création, pour garder l'historique.
import { Hono } from 'hono';
import { all, get, run, transaction } from '../database/connection.ts';
import type { Env } from '../http/session.ts';
import { amount, fail, fuel, idParam, monthParam, readBody, text } from '../http/validation.ts';
import {
  fuelCost,
  type Line,
  type LineKind,
  type Month,
  type MonthResponse,
  type MonthSummary,
  type Recurring,
  round2,
} from '../../../shared/types.ts';
import { parseFuel, recurringFor } from './recurring.ts';

interface LineRow {
  id: number;
  month_id: number;
  name: string;
  amount: number;
  paid: number;
  kind: LineKind;
  share: number;
  fuel: string | null;
  recurring_id: number | null;
  wish_id: number | null;
}

const toLine = (r: LineRow): Line => ({
  id: r.id,
  name: r.name,
  amount: r.amount,
  paid: r.paid === 1,
  kind: r.kind,
  share: r.share,
  fuel: parseFuel(r.fuel),
  recurringId: r.recurring_id,
  wishId: r.wish_id,
});

const monthId = (userId: number, month: string) =>
  get<{ id: number }>('SELECT id FROM months WHERE user_id = ? AND month = ?', userId, month)?.id;

function requireMonth(userId: number, month: string): number {
  const id = monthId(userId, month);
  if (id === undefined) throw fail(404, "Ce mois n'existe pas encore");
  return id;
}

function loadMonth(id: number): Month {
  const m = get<{ month: string; income: number }>('SELECT month, income FROM months WHERE id = ?', id)!;
  const lines = all<LineRow>('SELECT * FROM lines WHERE month_id = ? ORDER BY id', id).map(toLine);
  return { month: m.month, income: m.income, lines };
}

function insertRecurringLine(monthId: number, r: Recurring) {
  run(
    `INSERT INTO lines (month_id, name, amount, kind, share, fuel, recurring_id) VALUES (?, ?, ?, 'recurring', ?, ?, ?)`,
    monthId,
    r.name,
    round2((r.amount * r.share) / 100),
    r.share,
    r.fuel && JSON.stringify(r.fuel),
    r.id,
  );
}

function ownLine(lineId: number, userId: number): LineRow {
  const line = get<LineRow>('SELECT l.* FROM lines l JOIN months m ON m.id = l.month_id WHERE l.id = ? AND m.user_id = ?', lineId, userId);
  if (!line) throw fail(404, 'Ligne introuvable');
  return line;
}

// ---------- Mois ----------

export const monthRoutes = new Hono<Env>();

monthRoutes.get('/', (c) =>
  c.json(
    all<MonthSummary>(
      `SELECT m.month, m.income,
              COALESCE(SUM(l.amount), 0) AS spent,
              COALESCE(SUM(CASE WHEN l.paid = 1 THEN 0 ELSE l.amount END), 0) AS unpaid
       FROM months m LEFT JOIN lines l ON l.month_id = m.id
       WHERE m.user_id = ? GROUP BY m.id ORDER BY m.month DESC`,
      c.var.user.id,
    ),
  ),
);

monthRoutes.get('/:month', (c) => {
  const month = monthParam(c.req.param('month'));
  const id = monthId(c.var.user.id, month);
  const last = get<{ income: number }>('SELECT income FROM months WHERE user_id = ? ORDER BY month DESC LIMIT 1', c.var.user.id);
  const response: MonthResponse = { month: id === undefined ? null : loadMonth(id), suggestedIncome: last?.income ?? 0 };
  return c.json(response);
});

monthRoutes.post('/:month', async (c) => {
  const month = monthParam(c.req.param('month'));
  const userId = c.var.user.id;
  const income = amount((await readBody(c)).income, 'revenu');
  if (monthId(userId, month) !== undefined) throw fail(409, 'Ce mois existe déjà');
  const id = transaction(() => {
    const id = Number(run('INSERT INTO months (user_id, month, income) VALUES (?, ?, ?)', userId, month, income).lastInsertRowid);
    for (const r of recurringFor(userId)) insertRecurringLine(id, r);
    return id;
  });
  return c.json(loadMonth(id));
});

monthRoutes.patch('/:month', async (c) => {
  const id = requireMonth(c.var.user.id, monthParam(c.req.param('month')));
  run('UPDATE months SET income = ? WHERE id = ?', amount((await readBody(c)).income, 'revenu'), id);
  return c.json(loadMonth(id));
});

// Met à jour les lignes non payées d'après les charges récurrentes actuelles, et ajoute celles qui manquent.
monthRoutes.post('/:month/sync', (c) => {
  const userId = c.var.user.id;
  const id = requireMonth(userId, monthParam(c.req.param('month')));
  transaction(() => {
    for (const r of recurringFor(userId)) {
      const line = get<LineRow>('SELECT * FROM lines WHERE month_id = ? AND recurring_id = ?', id, r.id);
      if (!line) {
        insertRecurringLine(id, r);
      } else if (!line.paid) {
        // On garde les km saisis pour ce mois, seuls les autres paramètres viennent de la charge.
        const lineFuel = parseFuel(line.fuel);
        const f = r.fuel && { ...r.fuel, km: lineFuel?.km ?? r.fuel.km };
        const total = f ? fuelCost(f) : r.amount;
        run(
          'UPDATE lines SET name = ?, amount = ?, share = ?, fuel = ? WHERE id = ?',
          r.name,
          round2((total * r.share) / 100),
          r.share,
          f && JSON.stringify(f),
          line.id,
        );
      }
    }
  });
  return c.json(loadMonth(id));
});

// Ajoute une dépense ponctuelle (déjà payée : on la saisit une fois faite), ou un achat de la liste (wishId).
monthRoutes.post('/:month/lines', async (c) => {
  const userId = c.var.user.id;
  const id = requireMonth(userId, monthParam(c.req.param('month')));
  const body = await readBody(c);
  if (body.wishId !== undefined) {
    const wish = get<{ id: number; name: string; price: number }>(
      'SELECT * FROM wishes WHERE id = ? AND user_id = ?',
      amount(body.wishId, 'achat'),
      userId,
    );
    if (!wish) throw fail(404, 'Achat introuvable');
    if (get('SELECT 1 FROM lines WHERE wish_id = ?', wish.id)) throw fail(409, 'Cet achat est déjà prévu dans un mois');
    run(`INSERT INTO lines (month_id, name, amount, kind, wish_id) VALUES (?, ?, ?, 'purchase', ?)`, id, wish.name, wish.price, wish.id);
  } else {
    run(`INSERT INTO lines (month_id, name, amount, kind, paid) VALUES (?, ?, ?, 'extra', 1)`, id, text(body.name, 'nom'), amount(body.amount, 'montant'));
  }
  return c.json(loadMonth(id));
});

// ---------- Lignes ----------

export const lineRoutes = new Hono<Env>();

lineRoutes.patch('/:id', async (c) => {
  const line = ownLine(idParam(c.req.param('id')), c.var.user.id);
  const body = await readBody(c);
  transaction(() => {
    if (body.name !== undefined) run('UPDATE lines SET name = ? WHERE id = ?', text(body.name, 'nom'), line.id);
    if (body.amount !== undefined) run('UPDATE lines SET amount = ? WHERE id = ?', amount(body.amount, 'montant'), line.id);
    if (body.km !== undefined) {
      const f = parseFuel(line.fuel);
      if (!f) throw fail(400, "Cette ligne n'a pas de calcul essence");
      f.km = fuel({ ...f, km: body.km })!.km;
      run('UPDATE lines SET fuel = ?, amount = ? WHERE id = ?', JSON.stringify(f), round2((fuelCost(f) * line.share) / 100), line.id);
    }
    if (body.paid !== undefined) {
      const paid = body.paid === true ? 1 : 0;
      run('UPDATE lines SET paid = ? WHERE id = ?', paid, line.id);
      // Payer la ligne d'un achat prévu marque l'achat comme fait.
      if (line.wish_id !== null) run('UPDATE wishes SET done = ? WHERE id = ?', paid, line.wish_id);
    }
  });
  return c.json(loadMonth(line.month_id));
});

lineRoutes.delete('/:id', (c) => {
  const line = ownLine(idParam(c.req.param('id')), c.var.user.id);
  run('DELETE FROM lines WHERE id = ?', line.id);
  return c.json(loadMonth(line.month_id));
});
