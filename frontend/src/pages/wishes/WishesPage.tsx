import { CalendarPlus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type { Month, Wish } from '../../../../shared/types';
import { api } from '../../lib/api';
import { AmountInput, CheckButton, TextInput } from '../../components/inputs';
import { EmptyState, PageHeader, Skeleton } from '../../components/layout';
import { money, monthLabel, parseAmount } from '../../lib/format';
import { toastError } from '../../lib/toast';

export function WishesPage({ month }: { month: string }) {
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const load = () => api<Wish[]>('/wishes').then(setWishes, toastError);
  useEffect(() => {
    load();
  }, []);

  const update = async (request: Promise<Wish[]>) => {
    try {
      setWishes(await request);
      return true;
    } catch (e) {
      toastError(e);
      return false;
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseAmount(price);
    if (!name.trim() || value === null) return;
    if (await update(api('/wishes', { method: 'POST', body: { name, price: value } }))) {
      setName('');
      setPrice('');
    }
  };

  const plan = (w: Wish) => api<Month>(`/months/${month}/lines`, { method: 'POST', body: { wishId: w.id } }).then(load, toastError);
  const patch = (w: Wish, body: object) => update(api(`/wishes/${w.id}`, { method: 'PATCH', body }));

  const todo = wishes?.filter((w) => !w.done) ?? [];
  const done = wishes?.filter((w) => w.done) ?? [];

  const row = (w: Wish) => (
    <li key={w.id} className={w.done ? 'row paid' : 'row'}>
      <CheckButton checked={w.done} onChange={(checked) => patch(w, { done: checked })} label={w.done ? 'Marquer non acheté' : 'Marquer acheté'} />
      <div className="row-main">
        <TextInput label="Nom" value={w.name} onCommit={(n) => patch(w, { name: n })} />
        <div className="row-meta">
          {w.plannedMonth ? (
            <span className="badge tone-orange">prévu en {monthLabel(w.plannedMonth)}</span>
          ) : (
            !w.done && (
              <button className="link" onClick={() => plan(w)}>
                <CalendarPlus size={13} /> Prévoir en {monthLabel(month)}
              </button>
            )
          )}
        </div>
      </div>
      <AmountInput label="Prix" value={w.price} onCommit={(p) => patch(w, { price: p })} />
      <button className="icon-btn danger" onClick={() => update(api(`/wishes/${w.id}`, { method: 'DELETE' }))} aria-label="Supprimer">
        <Trash2 size={16} />
      </button>
    </li>
  );

  return (
    <>
      <PageHeader title="Achats prévus" icon={<ShoppingBag size={20} />} tone="orange" subtitle={todo.length > 0 ? `${money(todo.reduce((t, w) => t + w.price, 0))} à acheter` : 'Ta liste d\'envies'} />
      <form className="card add-row standalone" onSubmit={submit}>
        <Plus size={16} className="muted" />
        <input placeholder="Quadlock, selle, jeu…" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="amount" placeholder="Prix" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="submit" className="primary small" disabled={!name.trim() || parseAmount(price) === null}>
          Ajouter
        </button>
      </form>
      {!wishes ? (
        <Skeleton />
      ) : wishes.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ShoppingBag size={22} />}>
            <h2>Rien de prévu</h2>
            <p className="subtitle">Ajoute ce que tu veux acheter, puis place-le dans un mois quand tu peux.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="stack-lg">
          {todo.length > 0 && (
            <section className="card section">
              <header className="section-head">
                <h2>
                  À acheter <span className="count">{todo.length}</span>
                </h2>
              </header>
              <ul className="rows">{todo.map(row)}</ul>
            </section>
          )}
          {done.length > 0 && (
            <section className="card section">
              <header className="section-head">
                <h2>
                  Achetés <span className="count">{done.length}</span>
                </h2>
              </header>
              <ul className="rows">{done.map(row)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
