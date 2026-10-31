// Types et calculs partagés entre le serveur et le front.

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  twoFactor: boolean;
}

export interface TotpSetup {
  secret: string;
  uri: string;
}

export interface Passkey {
  id: string;
  name: string;
  domain: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface Security {
  passkeys: Passkey[];
  recoveryCodesLeft: number;
  mailEnabled: boolean;
}

export interface Fuel {
  km: number;
  consumption: number; // L/100 km
  pricePerLiter: number;
  extra: number; // montant fixe ajouté (marge, recharge…)
}

export interface Recurring {
  id: number;
  name: string;
  amount: number; // montant total
  share: number; // ma part en %, ex. 50 pour un loyer divisé par deux
  fuel: Fuel | null;
}

export type LineKind = 'recurring' | 'purchase' | 'extra';

export interface Line {
  id: number;
  name: string;
  amount: number; // ma part
  paid: boolean;
  kind: LineKind;
  share: number;
  fuel: Fuel | null;
  recurringId: number | null;
  wishId: number | null;
}

export interface Month {
  month: string; // AAAA-MM
  income: number;
  lines: Line[];
}

export interface MonthResponse {
  month: Month | null;
  suggestedIncome: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  spent: number;
  unpaid: number;
}

export interface Wish {
  id: number;
  name: string;
  price: number;
  done: boolean;
  plannedMonth: string | null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const fuelCost = (f: Fuel) => round2((f.km * f.consumption) / 100 * f.pricePerLiter + f.extra);
