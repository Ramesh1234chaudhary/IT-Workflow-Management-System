import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/** Accepts a Date, ISO string, epoch number, or nullish. Returns '—' for empty/invalid. */
export const formatDate = (value: Date | string | number | null | undefined): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(date) ? format(date, 'dd MMM yyyy') : '—';
};

export const formatDateTime = (value: Date | string | number | null | undefined): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(date) ? format(date, 'dd MMM yyyy HH:mm') : '—';
};

export const fromNow = (value: Date | string | number | null | undefined): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(date) ? `${formatDistanceToNow(date)} ago` : '—';
};

export const isOverdue = (dueDate: Date | string | number | null | undefined, status: string): boolean =>
  Boolean(dueDate) && status !== 'Completed' && new Date(dueDate as Date | string | number) < new Date();

/** Two-letter avatar initials from a display name. */
export const initials = (name = ''): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || '?';

export const formatBytes = (bytes = 0): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/** ISO-ish string for an <input type="datetime-local"> value, or '' for empty. */
export const toLocalInputValue = (value: Date | string | number | null | undefined): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(date)) return '';
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

export const titleCase = (value = ''): string =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const truncate = (value = '', length = 80): string =>
  value.length > length ? `${value.slice(0, length)}…` : value;