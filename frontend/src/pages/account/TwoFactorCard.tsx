import { LifeBuoy, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';
import { IconChip } from '../../components/layout';
import type { TotpSetup, User } from '../../../../shared/types';
import { Spinner } from '../../components/feedback';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { withReauth } from '../../lib/reauth';
import { toast, toastError } from '../../lib/toast';
import { RecoveryCodesDialog } from './RecoveryCodesDialog';

interface Props {
  user: User;
  recoveryCodesLeft: number;
  onChange: (user: User) => void;
  onCodesChange: () => void;
}

export function TwoFactorCard({ user, recoveryCodesLeft, onChange, onCodesChange }: Props) {
  const [dialog, setDialog] = useState<'enable' | 'disable' | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const regenerate = () => {
    if (!confirm('Générer de nouveaux codes de secours ? Les anciens ne fonctionneront plus.')) return;
    withReauth(() => api<{ recoveryCodes: string[] }>('/me/2fa/recovery-codes', { method: 'POST' })).then((r) => {
      setCodes(r.recoveryCodes);
      onCodesChange();
    }, toastError);
  };

  return (
    <section className="card form">
      <div className="section-head bare">
        <h2 className="card-title">
          <IconChip tone="good" size="small">
            <ShieldCheck size={14} />
          </IconChip>
          Double authentification
        </h2>
        {user.twoFactor ? <span className="badge tone-good">Activée</span> : <span className="badge">Désactivée</span>}
      </div>
      <p className="subtitle">
        {user.twoFactor
          ? 'Un code de ton application d’authentification est demandé à chaque connexion par mot de passe.'
          : 'Ajoute un code temporaire (Google Authenticator, Aegis, Bitwarden…) en plus du mot de passe.'}
      </p>
      {user.twoFactor && (
        <div className="recovery-row">
          <LifeBuoy size={16} className="muted" />
          <span>
            Codes de secours : <strong>{recoveryCodesLeft}</strong> restant{recoveryCodesLeft > 1 ? 's' : ''}
            {recoveryCodesLeft <= 3 && <span className="critical"> — pense à en générer de nouveaux</span>}
          </span>
          <button className="link" onClick={regenerate}>
            Générer de nouveaux codes
          </button>
        </div>
      )}
      <footer className="form-actions">
        {user.twoFactor ? (
          <button className="ghost" onClick={() => setDialog('disable')}>
            Désactiver
          </button>
        ) : (
          <button className="primary" onClick={() => setDialog('enable')}>
            Activer
          </button>
        )}
      </footer>
      {dialog === 'enable' && (
        <EnableDialog
          onClose={() => setDialog(null)}
          onDone={({ user: updated, recoveryCodes }) => {
            setDialog(null);
            setCodes(recoveryCodes);
            onChange(updated);
          }}
        />
      )}
      {dialog === 'disable' && (
        <DisableDialog
          onClose={() => setDialog(null)}
          onDone={(updated) => {
            setDialog(null);
            onChange(updated);
            toast('Double authentification désactivée', 'success');
          }}
        />
      )}
      {codes && <RecoveryCodesDialog codes={codes} onClose={() => setCodes(null)} />}
    </section>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <input
      className="otp-input"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="000000"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  );
}

function EnableDialog({ onClose, onDone }: { onClose: () => void; onDone: (result: { user: User; recoveryCodes: string[] }) => void }) {
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    withReauth(() => api<TotpSetup>('/me/2fa/setup', { method: 'POST' }))
      .then(async (s) => {
        setSetup(s);
        setQr(await QRCode.toDataURL(s.uri, { width: 200, margin: 1 }));
      })
      .catch((err) => {
        toastError(err);
        onClose(); // mot de passe non confirmé ou erreur : rien à afficher dans la fenêtre
      });
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    withReauth(() => api<{ user: User; recoveryCodes: string[] }>('/me/2fa/enable', { method: 'POST', body: { code } }))
      .then(onDone, (err) => {
        setCode('');
        toastError(err);
      })
      .finally(() => setBusy(false));
  };

  return (
    <Modal title="Activer la double authentification" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="subtitle">1. Scanne ce QR code avec ton application d'authentification.</p>
        <div className="qr">
          {qr ? <img src={qr} alt="QR code de configuration" width={200} height={200} /> : <div className="skeleton qr-placeholder" />}
        </div>
        {setup && (
          <p className="hint center">
            Ou saisis la clé à la main : <code className="secret">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
          </p>
        )}
        <label className="field">
          2. Saisis le code affiché pour confirmer
          <CodeInput value={code} onChange={setCode} />
        </label>
        <footer className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary" disabled={!setup || code.length !== 6 || busy}>
            {busy && <Spinner />} Activer
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function DisableDialog({ onClose, onDone }: { onClose: () => void; onDone: (user: User) => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    api<User>('/me/2fa/disable', { method: 'POST', body: { password, code } })
      .then(onDone, (err) => {
        setCode('');
        toastError(err);
      })
      .finally(() => setBusy(false));
  };

  return (
    <Modal title="Désactiver la double authentification" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="subtitle">Confirme avec ton mot de passe et un code de ton application (ou un code de secours).</p>
        <label className="field">
          Mot de passe
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Code
          <input className="otp-input" autoComplete="one-time-code" placeholder="000000" maxLength={9} value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <footer className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary" disabled={!password || code.trim().length < 6 || busy}>
            {busy && <Spinner />} Désactiver
          </button>
        </footer>
      </form>
    </Modal>
  );
}
