import { Fuel as FuelIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { type Fuel, fuelCost, type Recurring, round2 } from '../../../../shared/types';
import { Spinner } from '../../components/feedback';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { money, parseAmount, toInput } from '../../lib/format';

const DEFAULT_FUEL: Fuel = { km: 1000, consumption: 5, pricePerLiter: 1.9, extra: 0 };

// Création / modification d'une charge : montant fixe ou calcul essence, et « ma part » en %.
export function RecurringForm({ initial, onSave, onClose }: {
  initial: Recurring | null;
  onSave: (request: Promise<Recurring[]>) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial && !initial.fuel ? toInput(initial.amount) : '');
  const [useFuel, setUseFuel] = useState(initial?.fuel != null);
  const [share, setShare] = useState(toInput(initial?.share ?? 100));
  const [fuel, setFuel] = useState<Record<keyof Fuel, string>>(() => {
    const f = initial?.fuel ?? DEFAULT_FUEL;
    return { km: toInput(f.km), consumption: toInput(f.consumption), pricePerLiter: toInput(f.pricePerLiter), extra: toInput(f.extra) };
  });

  const parsedFuel = Object.fromEntries(Object.entries(fuel).map(([k, v]) => [k, parseAmount(v)])) as Record<keyof Fuel, number | null>;
  const fuelValid = Object.values(parsedFuel).every((v) => v !== null);
  const total = useFuel ? (fuelValid ? fuelCost(parsedFuel as Fuel) : null) : parseAmount(amount);
  const sharePercent = parseAmount(share);
  const valid = name.trim() !== '' && total !== null && sharePercent !== null && sharePercent > 0 && sharePercent <= 100;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    onSave(
      api(initial ? `/recurring/${initial.id}` : '/recurring', {
        method: initial ? 'PUT' : 'POST',
        body: { name, amount: total, share: sharePercent, fuel: useFuel ? parsedFuel : null },
      }),
    ).finally(() => setBusy(false));
  };

  const fuelField = (key: keyof Fuel, label: string, suffix: string) => (
    <label className="field">
      {label}
      <span className="input-suffix">
        <input className="amount" inputMode="decimal" value={fuel[key]} onChange={(e) => setFuel({ ...fuel, [key]: e.target.value })} />
        <span>{suffix}</span>
      </span>
    </label>
  );

  return (
    <Modal title={initial ? 'Modifier la charge' : 'Nouvelle charge'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Loyer, Netflix…" autoFocus />
        </label>

        <div className="segmented" role="radiogroup" aria-label="Type de montant">
          <button type="button" role="radio" aria-checked={!useFuel} className={!useFuel ? 'active' : ''} onClick={() => setUseFuel(false)}>
            Montant fixe
          </button>
          <button type="button" role="radio" aria-checked={useFuel} className={useFuel ? 'active' : ''} onClick={() => setUseFuel(true)}>
            <FuelIcon size={14} /> Essence (km)
          </button>
        </div>

        {useFuel ? (
          <div className="grid-2">
            {fuelField('km', 'Kilomètres par mois', 'km')}
            {fuelField('consumption', 'Consommation', 'L/100')}
            {fuelField('pricePerLiter', 'Prix du litre', '€')}
            {fuelField('extra', 'Supplément fixe', '€')}
          </div>
        ) : (
          <label className="field">
            Montant total
            <span className="input-suffix">
              <input className="amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span>€</span>
            </span>
          </label>
        )}

        <div className="field">
          Ma part
          <div className="share-row">
            <span className="input-suffix">
              <input className="amount" inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} aria-label="Ma part" />
              <span>%</span>
            </span>
            {[100, 50].map((p) => (
              <button type="button" key={p} className={sharePercent === p ? 'chip active' : 'chip'} onClick={() => setShare(String(p))}>
                {p === 100 ? 'Tout' : 'Moitié'}
              </button>
            ))}
          </div>
        </div>

        <div className="preview">
          <span>Ma part chaque mois</span>
          <strong>{valid ? money(round2((total! * sharePercent!) / 100)) : '—'}</strong>
        </div>

        <footer className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary" disabled={!valid || busy}>
            {busy && <Spinner />} Enregistrer
          </button>
        </footer>
      </form>
    </Modal>
  );
}
