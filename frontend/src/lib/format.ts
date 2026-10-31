const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const compactEur = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (n: number) => eur.format(n);

export const compact = (n: number) => compactEur.format(n);

export const toInput = (n: number) => String(n).replace('.', ',');

export function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[\s€%]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const toDate = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

export const monthLabel = (month: string) => toDate(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

export const shortMonth = (month: string) => toDate(month).toLocaleDateString('fr-FR', { month: 'short' });
