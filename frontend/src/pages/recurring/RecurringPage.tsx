import { Fuel as FuelIcon, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Recurring, round2 } from '../../../../shared/types';
import { EmptyState, PageHeader, Skeleton } from '../../components/layout';
import { api } from '../../lib/api';
import { money, toInput } from '../../lib/format';
import { toastError } from '../../lib/toast';
import { RecurringForm } from './RecurringForm';

const myPart = (r: Recurring) => round2((r.amount * r.share) / 100);

export function RecurringPage() {
  const [items, setItems] = useState<Recurring[] | null>(null);
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null);

  useEffect(() => {
    api<Recurring[]>('/recurring').then(setItems, toastError);
  }, []);

  const save = async (request: Promise<Recurring[]>) => {
    try {
      setItems(await request);
      setEditing(null);
    } catch (e) {
      toastError(e);
    }
  };

  const remove = (r: Recurring) => {
    if (confirm(`Supprimer « ${r.name} » ? Les mois déjà créés ne sont pas modifiés.`)) {
      save(api(`/recurring/${r.id}`, { method: 'DELETE' }));
    }
  };

  return (
    <>
      <PageHeader
        title="Charges récurrentes"
        icon={<Repeat size={20} />}
        tone="blue"
        subtitle={items && items.length > 0 ? `${money(items.reduce((t, r) => t + myPart(r), 0))} par mois, recopiées dans chaque nouveau mois` : 'Recopiées dans chaque nouveau mois'}
        actions={
          <button className="primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Ajouter
          </button>
        }
      />
      {!items ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Repeat size={22} />}>
            <h2>Aucune charge</h2>
            <p className="subtitle">Loyer, abonnements, assurance, essence… tout ce qui revient chaque mois.</p>
          </EmptyState>
        </div>
      ) : (
        <ul className="card rows">
          {items.map((r) => (
            <li className="row" key={r.id}>
              <span className="icon-chip tone-blue">{r.fuel ? <FuelIcon size={16} /> : <Repeat size={16} />}</span>
              <div className="row-main">
                <span className="row-title">{r.name}</span>
                <span className="row-meta">
                  {r.fuel && (
                    <span>
                      {r.fuel.km} km · {toInput(r.fuel.consumption)} L/100 · {toInput(r.fuel.pricePerLiter)} €/L
                    </span>
                  )}
                  {r.share < 100 && (
                    <span>
                      {r.share} % de {money(r.amount)}
                    </span>
                  )}
                </span>
              </div>
              <span className="amount-value">{money(myPart(r))}</span>
              <button className="icon-btn" onClick={() => setEditing(r)} aria-label="Modifier">
                <Pencil size={16} />
              </button>
              <button className="icon-btn danger" onClick={() => remove(r)} aria-label="Supprimer">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <RecurringForm initial={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
