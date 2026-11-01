import { type FormEvent, useState } from 'react';
import type { Priority, Wish } from '../../../../shared/types';
import { Spinner } from '../../components/feedback';
import type { Tone } from '../../components/layout';
import { Modal } from '../../components/Modal';
import { parseAmount, toInput } from '../../lib/format';

export const PRIORITIES: { value: Priority; label: string; tone?: Tone }[] = [
  { value: 1, label: 'Haute', tone: 'orange' },
  { value: 2, label: 'Normale', tone: 'blue' },
  { value: 3, label: 'Basse' },
];

// Modification complète d'un souhait : nom, prix, lien et priorité.
export function WishForm({ wish, onSave, onClose }: {
  wish: Wish;
  onSave: (body: { name: string; price: number; url: string; priority: Priority }) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(wish.name);
  const [price, setPrice] = useState(toInput(wish.price));
  const [url, setUrl] = useState(wish.url ?? '');
  const [priority, setPriority] = useState(wish.priority);
  const value = parseAmount(price);
  const valid = name.trim() !== '' && value !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || value === null) return;
    setBusy(true);
    onSave({ name, price: value, url: url.trim(), priority }).finally(() => setBusy(false));
  };

  return (
    <Modal title="Modifier le souhait" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Prix
          <span className="input-suffix">
            <input className="amount" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <span>€</span>
          </span>
        </label>
        <label className="field">
          Lien vers le produit
          <input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <div className="field">
          Priorité
          <div className="segmented three" role="radiogroup" aria-label="Priorité">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.value}
                role="radio"
                aria-checked={priority === p.value}
                className={priority === p.value ? 'active' : ''}
                onClick={() => setPriority(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
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
