import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  type LucideIcon,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import type { Line, LineKind, Month, MonthResponse, Wish } from '../../../../shared/types';
import { api } from '../../lib/api';
import { BudgetBar } from '../../components/charts';
import { Spinner } from '../../components/feedback';
import { AmountInput, CheckButton, TextInput } from '../../components/inputs';
import { EmptyState, IconChip, PageHeader, Skeleton, type Tone } from '../../components/layout';
import { currentMonth, money, monthLabel, parseAmount, shiftMonth, toInput } from '../../lib/format';
import { toastError } from '../../lib/toast';

type Apply = (request: Promise<Month>) => Promise<boolean>;

// Même ordre et mêmes couleurs dans la barre, la légende et les sections.
const SECTIONS: { kind: LineKind; title: string; color: string; tone: Tone; icon: LucideIcon }[] = [
  { kind: 'recurring', title: 'Charges', color: '--series-1', tone: 'blue', icon: Repeat },
  { kind: 'purchase', title: 'Achats', color: '--series-2', tone: 'orange', icon: ShoppingBag },
  { kind: 'extra', title: 'Autres dépenses', color: '--series-3', tone: 'aqua', icon: Receipt },
];

const section = (kind: LineKind) => SECTIONS.find((s) => s.kind === kind)!;

const sum = (lines: Line[]) => lines.reduce((total, l) => total + l.amount, 0);

export function MonthPage({ month, onMonthChange }: { month: string; onMonthChange: (month: string) => void }) {
  const [data, setData] = useState<MonthResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    api<MonthResponse>(`/months/${month}`).then(
      (d) => !cancelled && setData(d),
      (e) => {
        if (cancelled) return;
        setFailed(true);
        toastError(e);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [month]);

  const apply: Apply = (request) =>
    request.then(
      (m) => {
        setData((d) => d && { ...d, month: m });
        return true;
      },
      (e) => {
        toastError(e);
        return false;
      },
    );

  const isCurrent = month === currentMonth();

  return (
    <>
      <PageHeader
        title={monthLabel(month)}
        subtitle={isCurrent ? 'Mois en cours' : 'Mois passé ou à venir'}
        icon={<CalendarDays size={20} />}
        actions={
          <>
            {!isCurrent && (
              <button className="ghost" onClick={() => onMonthChange(currentMonth())}>
                Aujourd'hui
              </button>
            )}
            <button className="icon-btn bordered" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Mois précédent">
              <ChevronLeft size={18} />
            </button>
            <button className="icon-btn bordered" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Mois suivant">
              <ChevronRight size={18} />
            </button>
          </>
        }
      />
      {failed ? (
        <div className="card">
          <EmptyState icon={<TriangleAlert size={22} />}>Impossible de charger ce mois.</EmptyState>
        </div>
      ) : !data ? (
        <MonthSkeleton />
      ) : data.month ? (
        <MonthDetails data={data.month} apply={apply} />
      ) : (
        <CreateMonth month={month} suggestedIncome={data.suggestedIncome} apply={apply} />
      )}
    </>
  );
}

// Même silhouette que la page chargée, pour que rien ne saute à l'arrivée des données.
const MonthSkeleton = () => (
  <div className="stack-lg" aria-busy="true" aria-label="Chargement du mois">
    <div className="card hero">
      <div className="skeleton-line short" />
      <div className="skeleton-line hero-value-skel" />
      <div className="skeleton-line bar" />
      <div className="stats">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat">
            <div className="skeleton-line short" />
            <div className="skeleton-line medium" />
          </div>
        ))}
      </div>
    </div>
    <Skeleton lines={5} />
  </div>
);

function CreateMonth({ month, suggestedIncome, apply }: { month: string; suggestedIncome: number; apply: Apply }) {
  const [income, setIncome] = useState(suggestedIncome ? toInput(suggestedIncome) : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseAmount(income);
    if (value === null) return toastError(new Error('Indique ton revenu du mois'));
    setBusy(true);
    // En cas de succès le composant disparaît (le mois existe) : on ne remet busy à false qu'en cas d'échec.
    if (!(await apply(api(`/months/${month}`, { method: 'POST', body: { income: value } })))) setBusy(false);
  };

  return (
    <form className="card" onSubmit={submit}>
      <EmptyState icon={<CalendarPlus size={22} />}>
        <h2>Nouveau mois</h2>
        <p className="subtitle">Il sera créé avec tes charges récurrentes, que tu pourras ajuster ensuite.</p>
        <div className="inline-form">
          <label className="field">
            Revenu du mois
            <input className="amount" inputMode="decimal" placeholder="0,00" value={income} onChange={(e) => setIncome(e.target.value)} autoFocus />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            {busy && <Spinner />} Créer {monthLabel(month)}
          </button>
        </div>
      </EmptyState>
    </form>
  );
}

function MonthDetails({ data, apply }: { data: Month; apply: Apply }) {
  const [syncing, setSyncing] = useState(false);
  const spent = sum(data.lines);
  const remaining = data.income - spent;
  const unpaidLines = data.lines.filter((l) => !l.paid);
  const paidCount = data.lines.length - unpaidLines.length;
  const byKind = (kind: LineKind) => data.lines.filter((l) => l.kind === kind);

  return (
    <div className="stack-lg">
      <section className="card hero">
        <div className="hero-head">
          <div>
            <span className="eyebrow">Reste ce mois-ci</span>
            <div className={remaining < 0 ? 'hero-value critical' : 'hero-value'}>
              {remaining < 0 && <TriangleAlert size={32} aria-label="Dépassement" />}
              {money(remaining)}
            </div>
          </div>
          {remaining < 0 ? (
            <span className="status-pill tone-critical">
              <TriangleAlert size={14} /> Dépassement
            </span>
          ) : (
            <span className="status-pill tone-good">
              <CircleCheck size={14} /> Dans le vert
            </span>
          )}
        </div>
        <BudgetBar
          income={data.income}
          segments={SECTIONS.map((s) => ({ key: s.kind, label: s.title, value: sum(byKind(s.kind)), color: s.color }))}
        />
        <div className="stats">
          <div className="stat">
            <IconChip tone="good">
              <ArrowDownLeft size={16} />
            </IconChip>
            <div className="stat-body">
              <span className="stat-label">Revenu</span>
              <AmountInput
                className="stat-input"
                label="Revenu"
                value={data.income}
                onCommit={(income) => apply(api(`/months/${data.month}`, { method: 'PATCH', body: { income } }))}
              />
            </div>
          </div>
          <div className="stat">
            <IconChip tone="orange">
              <ArrowUpRight size={16} />
            </IconChip>
            <div className="stat-body">
              <span className="stat-label">Dépenses</span>
              <span className="stat-value">{money(spent)}</span>
            </div>
          </div>
          <div className="stat">
            <IconChip tone="blue">
              <Clock size={16} />
            </IconChip>
            <div className="stat-body">
              <span className="stat-label">Encore à payer</span>
              <span className="stat-value">{money(sum(unpaidLines))}</span>
              <span className="progress" aria-label={`${paidCount} lignes payées sur ${data.lines.length}`}>
                <span style={{ width: `${data.lines.length ? (paidCount / data.lines.length) * 100 : 0}%` }} />
              </span>
              <span className="stat-hint">
                {paidCount}/{data.lines.length} payées
              </span>
            </div>
          </div>
        </div>
      </section>

      <Section
        kind="recurring"
        lines={byKind('recurring')}
        apply={apply}
        action={
          <button
            className="ghost small"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              await apply(api(`/months/${data.month}/sync`, { method: 'POST' }));
              setSyncing(false);
            }}
            title="Met à jour les charges non payées et ajoute les nouvelles"
          >
            <RefreshCw size={14} className={syncing ? 'spin' : undefined} /> Mettre à jour
          </button>
        }
        empty="Aucune charge. Ajoute-les dans l'onglet Charges."
      />
      <Section kind="purchase" lines={byKind('purchase')} apply={apply} empty="Aucun achat prévu ce mois-ci.">
        <AddWish data={data} apply={apply} />
      </Section>
      <Section kind="extra" lines={byKind('extra')} apply={apply} empty="Rien d'autre pour l'instant.">
        <AddExpense month={data.month} apply={apply} />
      </Section>
    </div>
  );
}

function Section({ kind, lines, apply, action, empty, children }: {
  kind: LineKind;
  lines: Line[];
  apply: Apply;
  action?: ReactNode;
  empty: string;
  children?: ReactNode;
}) {
  const { title, tone, icon: Icon } = section(kind);
  return (
    <section className="card section">
      <header className="section-head">
        <h2>
          <IconChip tone={tone} size="small">
            <Icon size={14} />
          </IconChip>
          {title}
          <span className="count">{lines.length}</span>
        </h2>
        <div className="section-total">
          {action}
          <strong>{money(sum(lines))}</strong>
        </div>
      </header>
      {lines.length > 0 ? (
        <ul className="rows">
          {lines.map((line) => (
            <LineRow key={line.id} line={line} apply={apply} />
          ))}
        </ul>
      ) : (
        <p className="muted section-empty">{empty}</p>
      )}
      {children}
    </section>
  );
}

function LineRow({ line, apply }: { line: Line; apply: Apply }) {
  const patch = (body: object) => apply(api(`/lines/${line.id}`, { method: 'PATCH', body }));

  return (
    <li className={line.paid ? 'row paid' : 'row'}>
      <CheckButton checked={line.paid} onChange={(paid) => patch({ paid })} label={line.paid ? 'Marquer non payé' : 'Marquer payé'} />
      <div className="row-main">
        <TextInput label="Nom" value={line.name} onCommit={(name) => patch({ name })} />
        <div className="row-meta">
          {line.share < 100 && <span className="badge tone-blue">ma part {line.share} %</span>}
          {line.fuel && (
            <label className="badge km">
              <AmountInput plain className="km-input" label="Kilomètres" value={line.fuel.km} onCommit={(km) => patch({ km })} /> km
            </label>
          )}
        </div>
      </div>
      {line.fuel ? (
        <span className="amount-value">{money(line.amount)}</span>
      ) : (
        <AmountInput label="Montant" value={line.amount} onCommit={(amount) => patch({ amount })} />
      )}
      <button className="icon-btn danger" onClick={() => apply(api(`/lines/${line.id}`, { method: 'DELETE' }))} aria-label="Supprimer">
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function AddExpense({ month, apply }: { month: string; apply: Apply }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!name.trim() || value === null) return;
    if (await apply(api(`/months/${month}/lines`, { method: 'POST', body: { name, amount: value } }))) {
      setName('');
      setAmount('');
    }
  };

  return (
    <form className="add-row" onSubmit={submit}>
      <Plus size={16} className="muted" />
      <input placeholder="Ajouter une dépense…" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="amount" placeholder="0,00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button type="submit" className="primary small" disabled={!name.trim() || parseAmount(amount) === null}>
        Ajouter
      </button>
    </form>
  );
}

function AddWish({ data, apply }: { data: Month; apply: Apply }) {
  const [wishes, setWishes] = useState<Wish[]>([]);

  // Recharge la liste quand les lignes changent, pour masquer les achats déjà prévus.
  useEffect(() => {
    api<Wish[]>('/wishes').then(setWishes, () => setWishes([]));
  }, [data.lines.length]);

  const available = wishes.filter((w) => !w.done && !w.plannedMonth);
  if (available.length === 0) return null;

  return (
    <div className="add-row">
      <Plus size={16} className="muted" />
      <select
        value=""
        onChange={(e) => apply(api(`/months/${data.month}/lines`, { method: 'POST', body: { wishId: Number(e.target.value) } }))}
        aria-label="Ajouter un achat prévu"
      >
        <option value="">Ajouter un achat de ta liste…</option>
        {available.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name} — {money(w.price)}
          </option>
        ))}
      </select>
    </div>
  );
}
