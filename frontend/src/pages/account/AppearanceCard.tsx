import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { IconChip } from '../../components/layout';
import { type Theme, useTheme } from '../../lib/theme';

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Système', icon: Monitor },
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
];

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="card form">
      <h2 className="card-title">
        <IconChip tone="accent" size="small">
          <Palette size={14} />
        </IconChip>
        Apparence
      </h2>
      <div className="segmented three" role="radiogroup" aria-label="Thème">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            className={theme === value ? 'active' : ''}
            onClick={() => setTheme(value)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}
