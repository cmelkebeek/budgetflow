import { Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Écran de bienvenue après une connexion : l'app se charge en dessous pendant l'animation.
// Un clic le passe.
export function Welcome({ name, onDone }: { name: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const short = reducedMotion();
    const leave = setTimeout(() => setLeaving(true), short ? 700 : 1700);
    return () => clearTimeout(leave);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const end = setTimeout(() => done.current(), 450);
    return () => clearTimeout(end);
  }, [leaving]);

  const hour = new Date().getHours();
  const greeting = hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
  const month = new Date().toLocaleDateString('fr-FR', { month: 'long' });

  return (
    <div className={leaving ? 'welcome leaving' : 'welcome'} onClick={() => setLeaving(true)} role="status">
      <div className="welcome-inner">
        <span className="logo xl">
          <Wallet size={32} />
        </span>
        <h1>
          {greeting}, {name}
        </h1>
        <p>On prépare ton mois de {month}…</p>
        <div className="welcome-bar" aria-hidden="true">
          <span style={{ background: 'var(--series-1)' }} />
          <span style={{ background: 'var(--series-2)' }} />
          <span style={{ background: 'var(--series-3)' }} />
        </div>
      </div>
    </div>
  );
}
