import { Mail, Send } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { IconChip } from '../../components/layout';
import type { User } from '../../../../shared/types';
import { Spinner } from '../../components/feedback';
import { api } from '../../lib/api';
import { toast, toastError } from '../../lib/toast';

interface Props {
  user: User;
  mailEnabled: boolean;
  onUserChange: (user: User) => void;
}

export function EmailCard({ user, mailEnabled, onUserChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setBusy('save');
    api<User>('/me/email', { method: 'POST', body: { email, password } })
      .then((updated) => {
        onUserChange(updated);
        setEditing(false);
        setPassword('');
        toast(updated.email ? 'Adresse enregistrée' : 'Adresse supprimée', 'success');
      }, toastError)
      .finally(() => setBusy(null));
  };

  const test = () => {
    setBusy('test');
    api('/me/email/test', { method: 'POST' })
      .then(() => toast(`E-mail de test envoyé à ${user.email}`, 'success'), toastError)
      .finally(() => setBusy(null));
  };

  const cancel = () => {
    setEditing(false);
    setEmail(user.email ?? '');
    setPassword('');
  };

  return (
    <section className="card form">
      <div className="section-head bare">
        <h2 className="card-title">
          <IconChip tone="blue" size="small">
            <Mail size={14} />
          </IconChip>
          Adresse e-mail
        </h2>
        {!editing && (
          <button className="ghost small" onClick={() => setEditing(true)}>
            {user.email ? 'Modifier' : 'Ajouter'}
          </button>
        )}
      </div>
      {editing ? (
        <form className="form" onSubmit={save}>
          <label className="field">
            Adresse e-mail
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" autoFocus />
            <span className="hint">Laisse vide pour supprimer l'adresse.</span>
          </label>
          <label className="field">
            Mot de passe actuel
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="hint">C'est cette adresse qui permet de réinitialiser ton mot de passe.</span>
          </label>
          <footer className="form-actions">
            <button type="button" className="ghost" onClick={cancel}>
              Annuler
            </button>
            <button type="submit" className="primary" disabled={!password || busy !== null}>
              {busy === 'save' && <Spinner />} Enregistrer
            </button>
          </footer>
        </form>
      ) : (
        <>
          <div className="recovery-row">
            {user.email ? (
              <>
                <span>{user.email}</span>
                {mailEnabled && (
                  <button className="link" onClick={test} disabled={busy !== null}>
                    {busy === 'test' ? <Spinner size={12} /> : <Send size={13} />} Envoyer un e-mail de test
                  </button>
                )}
              </>
            ) : (
              <span className="muted">Aucune adresse : tu ne pourras pas réinitialiser ton mot de passe par e-mail.</span>
            )}
          </div>
          {!mailEnabled && (
            <p className="hint">L'envoi d'e-mails n'est pas encore configuré sur le serveur (variables SMTP_* du docker-compose).</p>
          )}
        </>
      )}
    </section>
  );
}
