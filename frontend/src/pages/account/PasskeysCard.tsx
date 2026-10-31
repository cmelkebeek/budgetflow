import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { IconChip } from '../../components/layout';
import type { Passkey } from '../../../../shared/types';
import { Spinner } from '../../components/feedback';
import { TextInput } from '../../components/inputs';
import { api } from '../../lib/api';
import { withReauth } from '../../lib/reauth';
import { toast, toastError } from '../../lib/toast';
import { deviceName, isAlreadyRegistered, isCancelled, passkeysAvailable, registerPasskey } from '../../lib/webauthn';

const shortDate = (ts: number) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function PasskeysCard({ passkeys, onChange }: { passkeys: Passkey[]; onChange: (passkeys: Passkey[]) => void }) {
  const available = passkeysAvailable();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      onChange(await withReauth(() => registerPasskey<Passkey[]>(deviceName())));
      toast('Passkey ajoutée', 'success');
    } catch (err) {
      if (isAlreadyRegistered(err)) toast('Cet appareil a déjà une passkey pour ton compte');
      else if (!isCancelled(err)) toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const update = (request: Promise<Passkey[]>) => request.then(onChange, toastError);
  const url = (p: Passkey) => `/me/passkeys/${encodeURIComponent(p.id)}`;

  const remove = (p: Passkey) => {
    if (confirm(`Supprimer la passkey « ${p.name} » ? Elle ne permettra plus de te connecter.`)) {
      update(withReauth(() => api(url(p), { method: 'DELETE' })));
    }
  };

  return (
    <section className="card section">
      <header className="section-head">
        <h2>
          <IconChip tone="aqua" size="small">
            <Fingerprint size={14} />
          </IconChip>
          Passkeys
          {passkeys.length > 0 && <span className="count">{passkeys.length}</span>}
        </h2>
        {available && (
          <button className="ghost small" onClick={add} disabled={busy}>
            {busy ? <Spinner size={14} /> : <Plus size={14} />} Ajouter
          </button>
        )}
      </header>
      <p className="section-empty subtitle">
        {available
          ? 'Connecte-toi avec ton empreinte, Face ID, Windows Hello ou une clé de sécurité, sans mot de passe ni code.'
          : 'Les passkeys ne sont disponibles qu’en HTTPS (ou sur localhost). Ouvre l’app via ton domaine pour en ajouter.'}
      </p>
      {passkeys.length > 0 && (
        <ul className="rows">
          {passkeys.map((p) => (
            <li className="row" key={p.id}>
              <span className="icon-chip tone-aqua">
                <Fingerprint size={16} />
              </span>
              <div className="row-main">
                <TextInput
                  label="Nom de la passkey"
                  value={p.name}
                  onCommit={(name) => update(api(url(p), { method: 'PATCH', body: { name } }))}
                />
                <span className="row-meta">
                  <span>
                    Ajoutée le {shortDate(p.createdAt)}
                    {p.lastUsedAt && ` · utilisée le ${shortDate(p.lastUsedAt)}`}
                  </span>
                  {p.domain !== location.hostname && <span className="badge">{p.domain}</span>}
                </span>
              </div>
              <button className="icon-btn danger" onClick={() => remove(p)} aria-label="Supprimer la passkey">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
