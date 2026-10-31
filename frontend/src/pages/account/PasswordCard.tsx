import { KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { IconChip } from '../../components/layout';
import { Spinner } from '../../components/feedback';
import { api } from '../../lib/api';
import { toast, toastError } from '../../lib/toast';

export function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = confirm !== '' && confirm !== next;
  const valid = current !== '' && next.length >= 8 && next === confirm;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    api('/me/password', { method: 'POST', body: { current, next } })
      .then(() => {
        setCurrent('');
        setNext('');
        setConfirm('');
        toast('Mot de passe modifié. Tes autres appareils ont été déconnectés.', 'success');
      }, toastError)
      .finally(() => setBusy(false));
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2 className="card-title">
        <IconChip tone="orange" size="small">
          <KeyRound size={14} />
        </IconChip>
        Changer de mot de passe
      </h2>
      <label className="field">
        Mot de passe actuel
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="field">
        Nouveau mot de passe
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <span className="hint">8 caractères minimum</span>
      </label>
      <label className="field">
        Confirmer le nouveau mot de passe
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        {mismatch && <span className="form-error">Les mots de passe ne correspondent pas</span>}
      </label>
      <footer className="form-actions">
        <button type="submit" className="primary" disabled={!valid || busy}>
          {busy && <Spinner />} Modifier
        </button>
      </footer>
    </form>
  );
}
