import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
}

// Champ mot de passe avec bouton afficher/masquer et alerte « Majuscules activées ».
export function PasswordInput({ id, value, onChange, autoComplete = 'current-password', autoFocus }: Props) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <>
      <span className="input-suffix">
        <LockKeyhole size={16} className="muted" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
          onBlur={() => setCapsLock(false)}
        />
        <button
          type="button"
          className="input-icon"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          title={visible ? 'Masquer' : 'Afficher'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
      {capsLock && <span className="hint warn">Majuscules activées</span>}
    </>
  );
}
