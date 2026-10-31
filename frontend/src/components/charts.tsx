import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { MonthSummary } from '../../../shared/types';
import { compact, money, monthLabel, shortMonth } from '../lib/format';

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string; // variable CSS de la série, ex. --series-1
}

const percentOf = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

// Barre empilée : où part le revenu du mois. La partie non remplie de la piste = l'argent libre.
export function BudgetBar({ income, segments }: { income: number; segments: Segment[] }) {
  const [active, setActive] = useState<string | null>(null);
  const spent = segments.reduce((t, s) => t + s.value, 0);
  const scale = Math.max(income, spent, 1);
  const free = income - spent;
  const visible = segments.filter((s) => s.value > 0);

  let offset = 0;
  const placed = visible.map((s) => {
    const width = (s.value / scale) * 100;
    const center = offset + width / 2;
    offset += width;
    return { ...s, width, center };
  });
  const tip = placed.find((s) => s.key === active);

  return (
    <figure className="budget-bar">
      <div className="bar-wrap">
        <div
          className="bar-track"
          role="img"
          aria-label={`${segments.map((s) => `${s.label} ${money(s.value)}`).join(', ')}, revenu ${money(income)}`}
        >
          {placed.map((s) => (
            <div
              key={s.key}
              className="bar-seg"
              style={{ width: `${s.width}%`, background: `var(${s.color})` }}
              tabIndex={0}
              aria-label={`${s.label} : ${money(s.value)}`}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
            />
          ))}
        </div>
        {spent > income && <div className="income-marker" style={{ left: `${(income / scale) * 100}%` }} title="Revenu" />}
        {tip && (
          <div className="chart-tip" style={{ left: `${Math.min(Math.max(tip.center, 12), 88)}%` }}>
            <strong>{tip.label}</strong>
            <span>{money(tip.value)}</span>
            <span className="muted">{percentOf(tip.value, income)} % du revenu</span>
          </div>
        )}
      </div>
      <figcaption className="legend">
        {segments.map((s) => (
          <span key={s.key} className="legend-item">
            <i className="swatch" style={{ background: `var(${s.color})` }} />
            {s.label}
            <strong>{money(s.value)}</strong>
          </span>
        ))}
        {free >= 0 ? (
          <span className="legend-item">
            <i className="swatch track" />
            Libre
            <strong>{money(free)}</strong>
          </span>
        ) : (
          <span className="legend-item critical">
            <TriangleAlert size={14} />
            Dépassement
            <strong>{money(-free)}</strong>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function niceTicks(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

// Dépenses par mois (colonnes) avec le revenu en repère, sur les 12 derniers mois.
export function HistoryChart({ months, onOpen }: { months: MonthSummary[]; onOpen: (month: string) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const data = months.slice(0, 12).reverse();
  const { top, ticks } = niceTicks(Math.max(...data.flatMap((m) => [m.income, m.spent]), 1));
  const y = (v: number) => `${(Math.max(v, 0) / top) * 100}%`;

  return (
    <figure className="history-chart">
      <figcaption className="legend">
        <span className="legend-item">
          <i className="swatch" style={{ background: 'var(--series-1)' }} />
          Dépenses
        </span>
        <span className="legend-item">
          <i className="swatch tick" />
          Revenu
        </span>
      </figcaption>
      <div className="plot">
        <div className="y-axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: y(t) }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="plot-area">
          {ticks.map((t) => (
            <div key={t} className={t === 0 ? 'gridline baseline' : 'gridline'} style={{ bottom: y(t) }} />
          ))}
          {data.map((m, i) => (
            <button
              key={m.month}
              type="button"
              className="col-slot"
              aria-label={`${monthLabel(m.month)} : dépenses ${money(m.spent)}, revenu ${money(m.income)}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => onOpen(m.month)}
            >
              <span className="col" style={{ height: y(m.spent) }} />
              <span className="income-tick" style={{ bottom: y(m.income) }} />
              {active === i && (
                <span className={i >= data.length / 2 && data.length > 1 ? 'chart-tip side left' : 'chart-tip side'}>
                  <strong>{monthLabel(m.month)}</strong>
                  <span>Dépenses {money(m.spent)}</span>
                  <span>Revenu {money(m.income)}</span>
                  <span className="muted">Reste {money(m.income - m.spent)}</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <div />
        <div className="x-axis" aria-hidden="true">
          {data.map((m) => (
            <span key={m.month}>{shortMonth(m.month)}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}
