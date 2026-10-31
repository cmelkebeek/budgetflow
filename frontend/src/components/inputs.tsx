// Champs éditables sur place et case « payé », utilisés dans les listes.
import { Circle, CircleCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { money, parseAmount, toInput } from '../lib/format';

interface InlineProps<T> {
  value: T;
  onCommit: (value: T) => void;
  className?: string;
  label: string;
}

// Champ éditable sur place : valide à la perte du focus ou sur Entrée, Échap annule.
// Hors édition, la valeur est affichée avec `display` (ex. « 316,68 € »).
function Inline<T>({ value, onCommit, className, label, format, parse, display = format }: InlineProps<T> & {
  format: (v: T) => string;
  parse: (s: string) => T | null;
  display?: (v: T) => string;
}) {
  const [draft, setDraft] = useState(format(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(format(value)), [value]);

  const commit = () => {
    setEditing(false);
    const parsed = parse(draft);
    if (parsed === null) setDraft(format(value));
    else if (parsed !== value) onCommit(parsed);
  };

  return (
    <input
      className={className}
      aria-label={label}
      value={editing ? draft : display(value)}
      inputMode={className?.includes('amount') ? 'decimal' : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setEditing(true);
        setDraft(format(value));
        const input = e.target;
        requestAnimationFrame(() => input.select());
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(format(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export const AmountInput = ({ className, plain, ...props }: InlineProps<number> & { plain?: boolean }) => (
  <Inline
    className={`inline amount ${className ?? ''}`}
    {...props}
    format={toInput}
    parse={parseAmount}
    display={plain ? toInput : money}
  />
);

export const TextInput = (props: InlineProps<string>) => (
  <Inline className="inline name" {...props} format={(s) => s} parse={(s) => s.trim() || null} />
);

export function CheckButton({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={checked ? 'check checked' : 'check'}
      aria-pressed={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
    >
      {checked ? <CircleCheck size={20} /> : <Circle size={20} />}
    </button>
  );
}
