import { ArrowLeft, KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Spinner } from '../../components/feedback';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { LoginHero } from './LoginHero';
import { PasswordInput } from './PasswordInput';

// Page ouverte depuis le lien reçu par e-mail (/#reset=<jeton>).
export function ResetPasswordPage({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = confirm !== '' && confirm !== password;
  const valid = password.length >= 8 && password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError('');
    setBusy(true);
    try {
      const res = await api<{ twoFactor: boolean }>('/password/reset', { method: 'POST', body: { token, password } });
      toast(
        res.twoFactor ? 'Mot de passe modifié. Connecte-toi, ton code de 2FA te sera demandé.' : 'Mot de passe modifié, tu peux te connecter.',
        'success',
      );
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <LoginHero />
      <main className="login-main">
        <form className="login-panel" onSubmit={submit}>
          <span className="logo large">
            <KeyRound size={24} />
          </span>
          <div>
            <h1>Nouveau mot de passe</h1>
            <p className="subtitle">Choisis un mot de passe d'au moins 8 caractères. Tes sessions ouvertes seront fermées.</p>
          </div>
          <div className="field">
            <label htmlFor="new-password">Nouveau mot de passe</label>
            <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirmer</label>
            <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {mismatch && <span className="form-error">Les mots de passe ne correspondent pas</span>}
          </div>
          {error && <p className="form-error shake">{error}</p>}
          <button type="submit" className="primary large" disabled={!valid || busy}>
            {busy && <Spinner />} Enregistrer
          </button>
          <button type="button" className="link center" onClick={onDone}>
            <ArrowLeft size={13} /> Retour à la connexion
          </button>
        </form>
      </main>
    </div>
  );
}
