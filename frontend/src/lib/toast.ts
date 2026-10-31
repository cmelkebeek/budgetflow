export interface Toast {
  id: number;
  message: string;
  tone: 'error' | 'success';
}

const listeners = new Set<(toast: Toast) => void>();
let nextId = 1;

export function toast(message: string, tone: Toast['tone'] = 'error') {
  const t = { id: nextId++, message, tone };
  listeners.forEach((listener) => listener(t));
}

export function toastError(err: unknown) {
  // L'utilisateur a refermé la demande de mot de passe : ce n'est pas une erreur à signaler.
  if (err instanceof Error && err.name === 'ReauthCancelled') return;
  toast(err instanceof Error ? err.message : 'Erreur inattendue');
}

export function subscribe(listener: (toast: Toast) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
