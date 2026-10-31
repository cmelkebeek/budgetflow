import { ArrowLeft, Fingerprint, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type { User } from '../../../../shared/types';
import { Spinner } from '../../components/feedback';
import { api } from '../../lib/api';
import { isCancelled, loginWithPasskey, passkeysAvailable } from '../../lib/webauthn';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { LoginHero } from './LoginHero';
import { PasswordInput } from './PasswordInput';

type LoginResponse = User | { twoFactorRequired: true };

// Connexion en deux étapes : identifiant + mot de passe, puis code 2FA si le compte l'a activée.
export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'password' | 'passkey' | null>(null);
  const [forgot, setForgot] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy('password');
    try {
      const body = needsCode ? { username, password, code } : { username, password };
      const res = await api<LoginResponse>('/login', { method: 'POST', body });
      if ('twoFactorRequired' in res) setNeedsCode(true);
      else onLogin(res);
    } catch (err) {
      setError((err as Error).message);
      setCode('');
    } finally {
      setBusy(null);
    }
  };

  const passkey = async () => {
    setError('');
    setBusy('passkey');
    try {
      onLogin(await loginWithPasskey());
    } catch (err) {
      if (!isCancelled(err)) setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const back = () => {
    setNeedsCode(false);
    setUseRecovery(false);
    setCode('');
    setPassword('');
    setError('');
  };

  const toggleRecovery = () => {
    setUseRecovery(!useRecovery);
    setCode('');
    setError('');
  };

  const codeComplete = useRecovery ? code.replace(/[^a-z0-9]/gi, '').length === 8 : code.length === 6;

  return (
    <div className="login-page">
      <LoginHero />
      <main className="login-main">
        {/* La clé rejoue l'animation d'entrée quand on passe à l'étape du code. */}
        <form className="login-panel" onSubmit={submit} key={needsCode ? 'code' : 'credentials'}>
          {needsCode ? (
            <>
              <span className="logo large">
                <ShieldCheck size={24} />
              </span>
              <div>
                <h1>Vérification</h1>
                <p className="subtitle">
                  {useRecovery
                    ? 'Saisis un de tes codes de secours. Il ne pourra plus resservir.'
                    : "Saisis le code à 6 chiffres de ton application d'authentification."}
                </p>
              </div>
              <label className="field">
                {useRecovery ? 'Code de secours' : 'Code'}
                {useRecovery ? (
                  <input
                    className="otp-input"
                    autoComplete="off"
                    placeholder="xxxx-xxxx"
                    maxLength={9}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <input
                    className="otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                )}
              </label>
              {error && <p className="form-error shake">{error}</p>}
              <button type="submit" className="primary large" disabled={busy !== null || !codeComplete}>
                {busy === 'password' && <Spinner />} Valider
              </button>
              <div className="login-links">
                <button type="button" className="link" onClick={back}>
                  <ArrowLeft size={13} /> Changer de compte
                </button>
                <button type="button" className="link" onClick={toggleRecovery}>
                  {useRecovery ? "Utiliser l'application" : 'Utiliser un code de secours'}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="logo large mobile-only">
                <Wallet size={24} />
              </span>
              <div>
                <h1>Connexion</h1>
                <p className="subtitle">Content de te revoir. Connecte-toi pour voir ton mois.</p>
              </div>
              <label className="field">
                Identifiant
                <span className="input-suffix">
                  <UserRound size={16} className="muted" />
                  <input autoComplete="username webauthn" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                </span>
              </label>
              <div className="field">
                <span className="field-row">
                  <label htmlFor="password">Mot de passe</label>
                  <button type="button" className="link" onClick={() => setForgot(true)}>
                    Mot de passe oublié ?
                  </button>
                </span>
                <PasswordInput id="password" value={password} onChange={setPassword} />
              </div>
              {error && <p className="form-error shake">{error}</p>}
              <button type="submit" className="primary large" disabled={busy !== null || !username.trim() || !password}>
                {busy === 'password' && <Spinner />} Se connecter
              </button>
              {passkeysAvailable() && (
                <>
                  <div className="divider">
                    <span>ou</span>
                  </div>
                  <button type="button" className="ghost large" onClick={passkey} disabled={busy !== null}>
                    {busy === 'passkey' ? <Spinner /> : <Fingerprint size={16} />} Se connecter avec une passkey
                  </button>
                </>
              )}
            </>
          )}
        </form>
      </main>
      {forgot && <ForgotPasswordDialog onClose={() => setForgot(false)} />}
    </div>
  );
}
