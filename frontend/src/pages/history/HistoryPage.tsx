import { ChartColumn } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MonthSummary } from '../../../../shared/types';
import { api } from '../../lib/api';
import { HistoryChart } from '../../components/charts';
import { EmptyState, PageHeader, Skeleton } from '../../components/layout';
import { money, monthLabel } from '../../lib/format';
import { toastError } from '../../lib/toast';

export function HistoryPage({ onOpen }: { onOpen: (month: string) => void }) {
  const [months, setMonths] = useState<MonthSummary[] | null>(null);

  useEffect(() => {
    api<MonthSummary[]>('/months').then(setMonths, toastError);
  }, []);

  const average = months && months.length > 0 ? months.reduce((t, m) => t + m.income - m.spent, 0) / months.length : 0;

  return (
    <>
      <PageHeader title="Historique" icon={<ChartColumn size={20} />} tone="aqua" subtitle={months && months.length > 0 ? `Reste moyen : ${money(average)} par mois` : undefined} />
      {!months ? (
        <Skeleton />
      ) : months.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ChartColumn size={22} />}>
            <h2>Pas encore d'historique</h2>
            <p className="subtitle">Tes mois apparaîtront ici dès que tu en auras créé un.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="stack-lg">
          <section className="card">
            <HistoryChart months={months} onOpen={onOpen} />
          </section>
          <section className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Mois</th>
                  <th>Revenu</th>
                  <th>Dépenses</th>
                  <th>Reste</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} onClick={() => onOpen(m.month)} className="clickable">
                    <td>{monthLabel(m.month)}</td>
                    <td>{money(m.income)}</td>
                    <td>{money(m.spent)}</td>
                    <td className={m.income - m.spent < 0 ? 'critical' : ''}>{money(m.income - m.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  );
}
