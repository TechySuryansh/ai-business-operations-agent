import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const money = (value: number, compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: compact ? 0 : Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
export const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
export const date = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
export function downloadCSV(name: string, rows: object[]) {
  const keys = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const text = [
    keys.map(escape).join(','),
    ...rows.map((row) => keys.map((k) => escape((row as Record<string, unknown>)[k])).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
