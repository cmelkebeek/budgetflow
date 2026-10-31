import { ApiError } from './api';

// Levée quand l'utilisateur ferme la demande de mot de passe : rien à afficher.
export class ReauthCancelled extends Error {
  constructor() {
    super('Action annulée');
    this.name = 'ReauthCancelled';
  }
}

/**
 * Exécute une action sensible. Si le serveur demande de confirmer le mot de passe (403),
 * affiche la demande (ReauthPrompt) puis rejoue l'action une fois confirmé.
 */
export async function withReauth<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 403)) throw err;
    const confirmed = await new Promise<boolean>((resolve) => window.dispatchEvent(new CustomEvent('reauth-required', { detail: resolve })));
    if (!confirmed) throw new ReauthCancelled();
    return action();
  }
}
