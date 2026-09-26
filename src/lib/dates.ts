export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-date key, e.g. 2026-09-26. */
export const key = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export const parse = (k: string) => {
  const a = k.split('-').map(Number);
  return new Date(a[0], a[1] - 1, a[2]);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};

export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

/** 0 = Monday … 6 = Sunday. */
export const dowIndex = (d: Date) => (d.getDay() + 6) % 7;

export const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((+t - +y) / 864e5 + 1) / 7);
};

export const weekOffsetOf = (d: Date, today: Date) =>
  Math.round((+mondayOf(d) - +mondayOf(today)) / (7 * 864e5));

export function weekLabel(mon: Date) {
  const end = addDays(mon, 6);
  return mon.getMonth() === end.getMonth()
    ? mon.getDate() + '–' + end.getDate() + ' ' + MON[end.getMonth()]
    : mon.getDate() + ' ' + MON[mon.getMonth()] + ' – ' + end.getDate() + ' ' + MON[end.getMonth()];
}
