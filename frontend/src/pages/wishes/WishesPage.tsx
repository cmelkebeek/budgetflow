import { CalendarCheck, CalendarPlus, ExternalLink, Gift, Link2, Pencil, Plus, Trash2, TriangleAlert, Wallet } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { type MonthResponse, type Priority, totalIncome, type Wish } from '../../../../shared/types';
import { api } from '../../lib/api';
import { AmountInput, CheckButton, TextInput } from '../../components/inputs';
import { EmptyState, IconChip, PageHeader, Skeleton } from '../../components/layout';
import { money, monthLabel, parseAmount } from '../../lib/format';
import { toastError } from '../../lib/toast';
import { PRIORITIES, WishForm } from './WishForm';

const total = (wishes: Wish[]) => wishes.reduce((t, w) => t + w.price, 0);

// Reste du mois sélectionné (revenus − dépenses), ou null si le mois n'est pas encore créé.
function useRemaining(month: string) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const reload = () =>
    api<MonthResponse>(`/months/${month}`).then(
      ({ month: m }) => setRemaining(m && totalIncome(m) - m.lines.reduce((t, l) => t + l.amount, 0)),
      () => setRemaining(null),
    );
  useEffect(() => {
    reload();
  }, [month]);
  return [remaining, reload] as const;
}

export function WishesPage({ month }: { month: string }) {
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [remaining, reloadRemaining] = useRemaining(month);
  const [editing, setEditing] = useState<Wish | null>(null);

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

  const plan = (w: Wish) =>
    api(`/months/${month}/lines`, { method: 'POST', body: { wishId: w.id } }).then(() => {
      load();
      reloadRemaining();
    }, toastError);
  const patch = (w: Wish, body: object) => update(api(`/wishes/${w.id}`, { method: 'PATCH', body }));

  const todo = wishes?.filter((w) => !w.done) ?? [];
  const planned = todo.filter((w) => w.plannedMonth);
  const done = wishes?.filter((w) => w.done) ?? [];

  const row = (w: Wish) => {
    const priority = PRIORITIES.find((p) => p.value === w.priority)!;
    const tooExpensive = !w.done && !w.plannedMonth && remaining !== null && w.price > remaining;
    return (
      <li key={w.id} className={w.done ? 'row paid' : 'row'}>
        <CheckButton checked={w.done} onChange={(checked) => patch(w, { done: checked })} label={w.done ? 'Marquer non acheté' : 'Marquer acheté'} />
        <div className="row-main">
          <TextInput label="Nom" value={w.name} onCommit={(n) => patch(w, { name: n })} />
          <div className="row-meta">
            {!w.done && (
              <select
                className={`badge badge-select${priority.tone ? ` tone-${priority.tone}` : ''}`}
                value={w.priority}
                onChange={(e) => patch(w, { priority: Number(e.target.value) })}
                aria-label="Priorité"
                title="Priorité"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            {w.plannedMonth ? (
              <span className="badge tone-aqua">
                <CalendarCheck size={12} /> prévu en {monthLabel(w.plannedMonth)}
              </span>
            ) : (
              !w.done &&
              remaining !== null && (
                <button className="link" onClick={() => plan(w)}>
                  <CalendarPlus size={13} /> Prévoir en {monthLabel(month)}
                </button>
              )
            )}
            {tooExpensive && (
              <span className="badge tone-critical" title={`Il reste ${money(remaining)} en ${monthLabel(month)}`}>
                <TriangleAlert size={12} /> dépasse le reste du mois
              </span>
            )}
            {w.url && (
              <a className="link" href={w.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} /> Voir
              </a>
            )}
          </div>
        </div>
        <AmountInput label="Prix" value={w.price} onCommit={(p) => patch(w, { price: p })} />
        <button className="icon-btn" onClick={() => setEditing(w)} aria-label="Modifier" title="Modifier (lien, priorité…)">
          <Pencil size={15} />
        </button>
        <button className="icon-btn danger" onClick={() => update(api(`/wishes/${w.id}`, { method: 'DELETE' }))} aria-label="Supprimer">
          <Trash2 size={16} />
        </button>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Liste de souhaits"
        icon={<Gift size={20} />}
        tone="orange"
        subtitle="Ce que tu aimerais t'offrir, à placer dans un mois quand ton budget le permet."
      />
      <AddWishForm onAdd={(body) => update(api('/wishes', { method: 'POST', body }))} />
      {!wishes ? (
        <Skeleton />
      ) : wishes.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Gift size={22} />}>
            <h2>Ta liste est vide</h2>
            <p className="subtitle">Ajoute ce qui te fait envie, avec un lien si tu veux. Tu le prévois ensuite dans un mois.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="stack-lg">
          <section className="card wish-summary">
            <div className="stats">
              <div className="stat">
                <IconChip tone="orange">
                  <Gift size={16} />
                </IconChip>
                <div className="stat-body">
                  <span className="stat-label">À s'offrir</span>
                  <span className="stat-value">{money(total(todo))}</span>
                  <span className="stat-hint">
                    {todo.length} souhait{todo.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="stat">
                <IconChip tone="aqua">
                  <CalendarCheck size={16} />
                </IconChip>
                <div className="stat-body">
                  <span className="stat-label">Déjà prévu</span>
                  <span className="stat-value">{money(total(planned))}</span>
                  <span className="stat-hint">dans tes mois à venir</span>
                </div>
              </div>
              <div className="stat">
                <IconChip tone={remaining !== null && remaining < 0 ? 'critical' : 'good'}>
                  <Wallet size={16} />
                </IconChip>
                <div className="stat-body">
                  <span className="stat-label">Reste en {monthLabel(month)}</span>
                  <span className="stat-value">{remaining === null ? '—' : money(remaining)}</span>
                  <span className="stat-hint">{remaining === null ? 'mois pas encore créé' : 'pour te faire plaisir'}</span>
                </div>
              </div>
            </div>
          </section>
          {todo.length > 0 && (
            <section className="card section">
              <header className="section-head">
                <h2>
                  À acheter <span className="count">{todo.length}</span>
                </h2>
                <strong>{money(total(todo))}</strong>
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
                <strong className="muted">{money(total(done))}</strong>
              </header>
              <ul className="rows">{done.map(row)}</ul>
            </section>
          )}
        </div>
      )}
      {editing && (
        <WishForm
          wish={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            if (await patch(editing, body)) setEditing(null);
          }}
        />
      )}
    </>
  );
}

// Ajout rapide : nom et prix, puis lien et priorité facultatifs sur une seconde ligne.
function AddWishForm({ onAdd }: { onAdd: (body: { name: string; price: number; url: string; priority: Priority }) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [priority, setPriority] = useState<Priority>(2);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseAmount(price);
    if (!name.trim() || value === null) return;
    if (await onAdd({ name, price: value, url: url.trim(), priority })) {
      setName('');
      setPrice('');
      setUrl('');
      setPriority(2);
    }
  };

  return (
    <form className="card wish-add" onSubmit={submit}>
      <div className="add-row">
        <Plus size={16} className="muted" />
        <input placeholder="Quadlock, selle, jeu…" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom du souhait" />
        <input className="amount" placeholder="Prix" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Prix" />
        <button type="submit" className="primary small" disabled={!name.trim() || parseAmount(price) === null}>
          Ajouter
        </button>
      </div>
      <div className="add-row wish-add-extra">
        <Link2 size={16} className="muted" />
        <input type="url" placeholder="Lien vers le produit (facultatif)" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Lien" />
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as Priority)} aria-label="Priorité">
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              Priorité {p.label.toLowerCase()}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
