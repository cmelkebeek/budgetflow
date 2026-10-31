// Indicateurs de chargement et notifications.
import { Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribe, type Toast } from '../lib/toast';

export const Spinner = ({ size = 16 }: { size?: number }) => (
  <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
);

// Écran affiché pendant la vérification de la session au démarrage (apparaît en fondu, seulement si c'est lent).
export const Splash = () => (
  <div className="splash" role="status" aria-label="Chargement">
    <span className="logo large">
      <Wallet size={24} />
    </span>
    <Spinner size={20} />
  </div>
);

// Fine barre en haut de page tant qu'une requête dure plus de 150 ms.
export function TopLoader() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onPending = (e: Event) => {
      if ((e as CustomEvent<number>).detail > 0) {
        timer ??= window.setTimeout(() => setActive(true), 150);
      } else {
        clearTimeout(timer);
        timer = undefined;
        setActive(false);
      }
    };
    window.addEventListener('api-pending', onPending);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('api-pending', onPending);
    };
  }, []);

  return <div className={active ? 'top-loader active' : 'top-loader'} aria-hidden="true" />;
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      subscribe((t) => {
        setToasts((list) => [...list, t]);
        setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 4000);
      }),
    [],
  );

  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
