// Briques de mise en page communes aux pages.
import { type ReactNode, useEffect, useRef, useState } from 'react';

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
  leading?: ReactNode; // sur mobile : à gauche de la barre du haut
  actions?: ReactNode; // sur mobile : à droite de la barre du haut
  icon?: ReactNode;
  tone?: Tone;
}

// Grand titre de page. Sur mobile, une barre du haut façon iOS porte les boutons, et affiche
// le titre en petit (fond flouté) une fois le grand titre passé sous elle au défilement.
export function PageHeader({ title, subtitle, leading, actions, icon, tone }: PageHeaderProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const heading = titleRef.current;
    if (!heading) return;
    // La zone observée commence sous la barre (52 px) : le titre est passé dessous quand il est au-dessus de cette zone.
    const observer = new IntersectionObserver(
      ([entry]) => setCondensed(entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0)),
      { rootMargin: '-52px 0px 0px 0px' },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className={condensed ? 'topbar condensed' : 'topbar'}>
        <div className="topbar-side">{leading}</div>
        <span className="topbar-title" aria-hidden="true">
          {title}
        </span>
        <div className="topbar-side end">{actions}</div>
      </div>
      <header className="page-header">
        <div className="page-title">
          {icon && (
            <IconChip tone={tone} size="large">
              {icon}
            </IconChip>
          )}
          <div>
            <h1 ref={titleRef}>{title}</h1>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
        </div>
        {(leading || actions) && (
          <div className="actions">
            {leading}
            {actions}
          </div>
        )}
      </header>
    </>
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
