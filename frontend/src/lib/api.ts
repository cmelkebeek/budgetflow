export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Nombre de requêtes en cours, diffusé pour la barre de chargement en haut de page.
let pending = 0;
const notifyPending = () => window.dispatchEvent(new CustomEvent('api-pending', { detail: pending }));

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  pending++;
  notifyPending();
  try {
    const res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401 && path !== '/login' && !path.startsWith('/passkey/')) window.dispatchEvent(new Event('unauthorized'));
    if (!res.ok) throw new ApiError(data?.error ?? `Erreur ${res.status}`, res.status);
    return data as T;
  } finally {
    pending--;
    notifyPending();
  }
}
