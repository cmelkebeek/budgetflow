import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { User } from '../../../shared/types';
import { api } from './api';

type RequestOptions = Parameters<typeof startAuthentication>[0]['optionsJSON'];
type CreationOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];

// WebAuthn n'existe qu'en HTTPS (ou sur localhost).
export const passkeysAvailable = () => window.isSecureContext && browserSupportsWebAuthn();

// L'utilisateur a fermé la fenêtre du navigateur ou du système : pas une erreur à afficher.
export const isCancelled = (err: unknown) =>
  err instanceof Error && ['NotAllowedError', 'AbortError', 'ReauthCancelled'].includes(err.name);

export const isAlreadyRegistered = (err: unknown) => err instanceof Error && err.name === 'InvalidStateError';

export async function loginWithPasskey(): Promise<User> {
  const { challengeId, options } = await api<{ challengeId: string; options: RequestOptions }>('/passkey/options', { method: 'POST' });
  const response = await startAuthentication({ optionsJSON: options });
  return api<User>('/passkey/login', { method: 'POST', body: { challengeId, response } });
}

export async function registerPasskey<T>(name: string): Promise<T> {
  const options = await api<CreationOptions>('/me/passkeys/options', { method: 'POST' });
  const response = await startRegistration({ optionsJSON: options });
  return api<T>('/me/passkeys', { method: 'POST', body: { response, name } });
}

export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Passkey';
}
