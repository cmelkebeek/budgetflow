import { type FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Spinner } from './feedback';
import { Modal } from './Modal';

// Demande de mot de passe affichée quand une action sensible l'exige (voir lib/reauth.ts).
export function ReauthPrompt() {
  const [pending, setPending] = useState<((confirmed: boolean) => void)[]>([]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onRequired = (e: Event) => setPending((list) => [...list, (e as CustomEvent<(ok: boolean) => void>).detail]);
    window.addEventListener('reauth-required', onRequired);
    return () => window.removeEventListener('reauth-required', onRequired);
  }, []);

  if (pending.length === 0) return null;

  const finish = (confirmed: boolean) => {
    pending.forEach((resolve) => resolve(confirmed));
    setPending([]);
    setPassword('');
    setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/me/reauth', { method: 'POST', body: { password } });
      finish(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Confirme ton mot de passe" onClose={() => finish(false)}>
      <form className="form" onSubmit={submit}>
        <p className="subtitle">Par sécurité, cette action demande ton mot de passe. Il ne sera plus redemandé pendant 10 minutes.</p>
        <label className="field">
          Mot de passe
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="form-error shake">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="ghost" onClick={() => finish(false)}>
            Annuler
          </button>
          <button type="submit" className="primary" disabled={!password || busy}>
            {busy && <Spinner />} Confirmer
          </button>
        </footer>
      </form>
    </Modal>
  );
}
