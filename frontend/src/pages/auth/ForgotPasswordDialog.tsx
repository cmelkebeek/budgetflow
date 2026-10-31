import { Copy, Mail, MailCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Spinner } from '../../components/feedback';
import { Modal } from '../../components/Modal';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../lib/toast';

// Demande d'un lien de réinitialisation par e-mail, avec repli sur la ligne de commande si le serveur n'a pas de SMTP.
export function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'sent' | 'no-mail'>('form');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      await api('/password/forgot', { method: 'POST', body: { identifier } });
      setState('sent');
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setState('no-mail');
      else {
        setError((err as Error).message);
        setState('form');
      }
    }
  };

  if (state === 'sent') {
    return (
      <Modal title="Vérifie ta boîte mail" onClose={onClose}>
        <div className="form">
          <div className="empty compact">
            <span className="empty-icon">
              <MailCheck size={22} />
            </span>
            <p className="subtitle">
              Si un compte correspond à <strong>{identifier}</strong> et a une adresse e-mail, un lien de réinitialisation vient d'être
              envoyé. Il est valable 30 minutes. Pense à regarder dans les spams.
            </p>
          </div>
          <footer className="form-actions">
            <button type="button" className="primary" onClick={onClose}>
              Compris
            </button>
          </footer>
        </div>
      </Modal>
    );
  }

  if (state === 'no-mail') return <ServerResetDialog onClose={onClose} />;

  return (
    <Modal title="Mot de passe oublié" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="subtitle">Saisis ton identifiant ou ton adresse e-mail : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
        <label className="field">
          Identifiant ou e-mail
          <span className="input-suffix">
            <Mail size={16} className="muted" />
            <input autoComplete="username email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
          </span>
        </label>
        {error && <p className="form-error shake">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary" disabled={!identifier.trim() || state === 'sending'}>
            {state === 'sending' && <Spinner />} Envoyer le lien
          </button>
        </footer>
      </form>
    </Modal>
  );
}

const RESET_COMMAND = 'docker compose exec budget budget-cli reset-password <identifiant>';

function ServerResetDialog({ onClose }: { onClose: () => void }) {
  const copy = () =>
    navigator.clipboard.writeText(RESET_COMMAND).then(
      () => toast('Commande copiée', 'success'),
      () => toast('Copie impossible ici'),
    );

  return (
    <Modal title="Mot de passe oublié" onClose={onClose}>
      <div className="form">
        <p className="subtitle">L'envoi d'e-mails n'est pas configuré sur ce serveur : la réinitialisation se fait depuis le serveur.</p>
        <ol className="steps">
          <li>
            <strong>Tu as une passkey ?</strong> Connecte-toi avec : elle ne demande pas de mot de passe.
          </li>
          <li>
            <strong>Sinon</strong>, dans le dossier de l'app sur le serveur, lance :
            <span className="command">
              <code>{RESET_COMMAND}</code>
              <button type="button" className="icon-btn" onClick={copy} aria-label="Copier la commande">
                <Copy size={14} />
              </button>
            </span>
            Un nouveau mot de passe s'affiche. Connecte-toi avec, puis change-le dans <strong>Compte</strong>.
          </li>
        </ol>
        <footer className="form-actions">
          <button type="button" className="primary" onClick={onClose}>
            Compris
          </button>
        </footer>
      </div>
    </Modal>
  );
}
