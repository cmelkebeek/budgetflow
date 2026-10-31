// Briques de mise en page communes aux pages.
import type { ReactNode } from 'react';

// Teintes disponibles (voir styles/cards.css) : les trois premières suivent les couleurs des graphiques.
export type Tone = 'accent' | 'blue' | 'orange' | 'aqua' | 'good' | 'critical';

export function IconChip({ tone = 'accent', size, children }: { tone?: Tone; size?: 'small' | 'large'; children: ReactNode }) {
  return (
    <span className={`icon-chip tone-${tone}${size ? ` ${size}` : ''}`} aria-hidden="true">
      {children}
    </span>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}

export function PageHeader({ title, subtitle, actions, icon, tone }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-title">
        {icon && (
          <IconChip tone={tone} size="large">
            {icon}
          </IconChip>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      {children}
    </div>
  );
}

export const Skeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="card" aria-busy="true">
    {Array.from({ length: lines }, (_, i) => (
      <div key={i} className="skeleton" />
    ))}
  </div>
);
