import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

// Ne se ferme que par la croix ou un bouton du contenu : ni clic à l'extérieur, ni Échap,
// pour ne pas perdre une saisie par accident.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    // showModal donne le focus à la croix : on le place plutôt dans le premier champ, ou sur la fenêtre elle-même.
    (dialog.querySelector<HTMLElement>('.modal-body input, .modal-body select') ?? dialog).focus();
  }, []);

  return (
    <dialog ref={ref} className="modal" tabIndex={-1} onClose={onClose} onCancel={(e) => e.preventDefault()}>
      <div className="modal-body">
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
