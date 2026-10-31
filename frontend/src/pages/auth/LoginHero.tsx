import { Check, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { money } from '../../lib/format';

// Panneau de présentation décoratif des pages de connexion (masqué sur mobile).

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(reducedMotion() ? target : 0);

  useEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

const PREVIEW_ROWS = [
  { name: 'Loyer', amount: 650, paid: true },
  { name: 'Courses', amount: 220, paid: true },
  { name: 'Abonnements', amount: 34.9, paid: false },
];

export function LoginHero() {
  const remaining = useCountUp(412.3);

  return (
    <aside className="login-hero" aria-hidden="true">
      <div className="brand">
        <span className="logo">
          <Wallet size={18} />
        </span>
        BudgetFlow
      </div>

      <div className="login-hero-body">
        <h2>Ton mois, en un coup d'œil.</h2>
        <p>Charges, envies et reste à vivre au même endroit, hébergés chez toi.</p>

        <div className="preview-card">
          <span className="eyebrow">Reste ce mois-ci</span>
          <strong className="preview-value">{money(remaining)}</strong>
          <div className="bar-track">
            <div className="bar-seg grow" style={{ width: '46%', background: 'var(--series-1)' }} />
            <div className="bar-seg grow" style={{ width: '20%', background: 'var(--series-2)', animationDelay: '0.15s' }} />
            <div className="bar-seg grow" style={{ width: '9%', background: 'var(--series-3)', animationDelay: '0.3s' }} />
          </div>
          <ul className="preview-rows">
            {PREVIEW_ROWS.map((r, i) => (
              <li key={r.name} style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
                <span className={r.paid ? 'preview-check paid' : 'preview-check'}>{r.paid && <Check size={11} strokeWidth={3} />}</span>
                {r.name}
                <span>{money(r.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="login-hero-foot">
        <ShieldCheck size={14} /> Passkeys, double authentification, et tes données restent chez toi.
      </p>
    </aside>
  );
}
