const time = new Intl.DateTimeFormat('ca', { hour: '2-digit', minute: '2-digit' });

export const formatTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : time.format(date);
};

export const pluralize = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const initialOf = (name: string): string => name.trim().slice(0, 1).toUpperCase() || '?';
