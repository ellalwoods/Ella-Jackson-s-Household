import { addDays, DOW, dowIndex, key, MON, mondayOf, ord, parse } from './dates';

export type PersonId = 'ella' | 'jackson';

export const PEOPLE: Record<PersonId, { name: string; color: string; ink: string; tint: string }> = {
  ella: { name: 'Ella', color: '#E886B8', ink: '#A9477B', tint: '#FAE3EE' },
  jackson: { name: 'Jackson', color: '#2A9E80', ink: '#1B6B56', tint: '#DAEFE7' },
};

export const otherPerson = (p: PersonId): PersonId => (p === 'ella' ? 'jackson' : 'ella');

/** Pie chart / category colours, assigned by category order. */
export const CAT_COLORS = ['#8FB0CF', '#C4A8D4', '#86C2BF', '#DCD690', '#F0A88C', '#E3CBC6', '#6F93B5', '#A98BBA'];

export const STATES = ['Full', 'Half', 'Low', 'Replace'] as const;
export type StockState = (typeof STATES)[number];
export const STATE_COLORS: Record<StockState, string> = { Full: '#86C2BF', Half: '#C3E0DD', Low: '#DCD690', Replace: '#F0A88C' };

/** When true, Low items still go on the shopping list (only Full/Half are skipped). */
export const INCLUDE_LOW = true;

/** Amounts are kept as typed (string) while editing; read them with `num`. */
export type Amount = number | string;
export const num = (a: Amount | undefined) => +(a ?? 0) || 0;

export interface Recipe { id: string; name: string; cost: number; ingredients: string[] }
export interface Category { id: string; name: string; ella: Amount; jackson: Amount }
export interface Income { id: string; name: string; person: PersonId; amount: Amount }
export interface CupboardItem { name: string; state: StockState }
export type Schedule =
  | { type: 'weekly'; days: number[] }
  | { type: 'every'; n: number; start: string }
  | { type: 'monthly'; dom: number }
  | { type: 'once'; date: string };
export interface Chore { id: string; name: string; person: PersonId; sched: Schedule }

export interface HouseholdData {
  incomes: Income[];
  cats: Category[];
  recipes: Recipe[];
  /** Dinner per date key. */
  plan: Record<string, { r: string }>;
  cupboard: CupboardItem[];
  chores: Chore[];
  /** `${dateKey}|${choreId}` → 1 when done. */
  done: Record<string, 1>;
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export const money = (v: number) => {
  const n = Math.round((+v || 0) * 100) / 100;
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export function seed(today = new Date()): HouseholdData {
  const m = mondayOf(today), k = (i: number) => key(addDays(m, i));
  const plan: HouseholdData['plan'] = { [k(0)]: { r: 'bol' }, [k(1)]: { r: 'stir' }, [k(3)]: { r: 'tray' } };
  return {
    incomes: [
      { id: uid(), name: 'Salary', person: 'ella', amount: 1150 },
      { id: uid(), name: 'Salary', person: 'jackson', amount: 1250 },
    ],
    cats: [
      { id: uid(), name: 'Rent', ella: 380, jackson: 380 },
      { id: uid(), name: 'Groceries', ella: 90, jackson: 90 },
      { id: uid(), name: 'Utilities', ella: 35, jackson: 35 },
      { id: uid(), name: 'Transport', ella: 45, jackson: 45 },
      { id: uid(), name: 'Leisure', ella: 60, jackson: 60 },
    ],
    recipes: [
      { id: 'bol', name: 'Spaghetti bolognese', cost: 16, ingredients: ['Spaghetti', 'Beef mince', 'Passata', 'Onion', 'Garlic', 'Carrot', 'Parmesan'] },
      { id: 'stir', name: 'Veggie stir-fry', cost: 12, ingredients: ['Rice', 'Broccoli', 'Capsicum', 'Soy sauce', 'Ginger', 'Garlic', 'Tofu'] },
      { id: 'tray', name: 'Lemon chicken tray bake', cost: 18, ingredients: ['Chicken thighs', 'Potatoes', 'Lemon', 'Garlic', 'Rosemary', 'Olive oil'] },
      { id: 'salmon', name: 'Salmon, rice & greens', cost: 24, ingredients: ['Salmon', 'Rice', 'Green beans', 'Lemon', 'Soy sauce'] },
    ],
    plan,
    cupboard: [
      { name: 'Olive oil', state: 'Full' }, { name: 'Soy sauce', state: 'Full' }, { name: 'Rice', state: 'Half' },
      { name: 'Garlic', state: 'Low' }, { name: 'Passata', state: 'Full' }, { name: 'Spaghetti', state: 'Replace' },
    ],
    chores: [
      { id: uid(), name: 'Bins out', person: 'jackson', sched: { type: 'weekly', days: [1] } },
      { id: uid(), name: 'Vacuum', person: 'ella', sched: { type: 'weekly', days: [5] } },
      { id: uid(), name: 'Dishes', person: 'ella', sched: { type: 'weekly', days: [0, 2, 4] } },
      { id: uid(), name: 'Dishes', person: 'jackson', sched: { type: 'weekly', days: [1, 3, 5, 6] } },
      { id: uid(), name: 'Clean bathroom', person: 'jackson', sched: { type: 'every', n: 14, start: k(6) } },
      { id: uid(), name: 'Change sheets', person: 'ella', sched: { type: 'every', n: 14, start: k(6) } },
    ],
    done: {},
  };
}

/** Accepts data saved by the prototype (single income per person) or partial docs. */
export function migrate(d: any): HouseholdData | null {
  if (!d || typeof d !== 'object' || !Array.isArray(d.cats)) return null;
  if (!Array.isArray(d.incomes)) {
    const i = d.income || {};
    d.incomes = [
      { id: uid(), name: 'Salary', person: 'ella', amount: i.ella || 0 },
      { id: uid(), name: 'Salary', person: 'jackson', amount: i.jackson || 0 },
    ];
  }
  delete d.income;
  d.recipes ??= []; d.plan ??= {}; d.cupboard ??= []; d.chores ??= []; d.done ??= {};
  return d as HouseholdData;
}

export function occurs(c: Chore, d: Date) {
  const s = c.sched;
  if (s.type === 'weekly') return s.days.indexOf(dowIndex(d)) >= 0;
  if (s.type === 'every') {
    const diff = Math.round((+d - +parse(s.start)) / 864e5);
    return diff >= 0 && diff % Math.max(1, s.n) === 0;
  }
  if (s.type === 'once') return key(d) === s.date;
  if (s.type === 'monthly') return d.getDate() === s.dom;
  return false;
}

export function describe(s: Schedule) {
  const f = (k: string) => { const d = parse(k); return d.getDate() + ' ' + MON[d.getMonth()]; };
  if (s.type === 'weekly') return s.days.length === 7 ? 'Every day' : 'Every ' + s.days.slice().sort().map(i => DOW[i]).join(', ');
  if (s.type === 'every') return s.n === 7 ? 'Weekly from ' + f(s.start) : s.n === 14 ? 'Fortnightly from ' + f(s.start) : 'Every ' + s.n + ' days from ' + f(s.start);
  if (s.type === 'monthly') return 'Monthly on the ' + ord(s.dom);
  return 'Once · ' + f(s.date);
}

export const inStock = (c: CupboardItem | undefined) =>
  !!c && (c.state === 'Full' || c.state === 'Half' || (!INCLUDE_LOW && c.state === 'Low'));

export function searchRecipes(recipes: Recipe[], q: string) {
  const pq = norm(q);
  return recipes.filter(r => !pq || norm(r.name).includes(pq) || r.ingredients.some(g => norm(g).includes(pq)));
}

export interface ShopItem { lk: string; name: string; days: string[]; status: string }

/** Ingredients needed for the week's dinners, minus what's in stock. */
export function shoppingList(D: HouseholdData, mon: Date) {
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const cup = new Map(D.cupboard.map(c => [norm(c.name), c]));
  const need = new Map<string, { name: string; days: string[] }>();
  for (let i = 0; i < 7; i++) {
    const r = rBy.get(D.plan[key(addDays(mon, i))]?.r ?? '');
    if (!r) continue;
    for (let n of r.ingredients) {
      n = n.trim();
      if (!n) continue;
      const lk = norm(n);
      if (!need.has(lk)) need.set(lk, { name: n, days: [] });
      const e = need.get(lk)!;
      if (e.days.indexOf(DOW[i]) < 0) e.days.push(DOW[i]);
    }
  }
  const items: ShopItem[] = [], skipped: { name: string; state: StockState }[] = [];
  need.forEach((n, lk) => {
    const c = cup.get(lk);
    if (inStock(c)) skipped.push({ name: n.name, state: c!.state });
    else items.push({ lk, name: n.name, days: n.days, status: c ? c.state : 'Not stocked' });
  });
  return { items, skipped };
}

export function shoppingText(label: string, items: ShopItem[], skipped: { name: string }[]) {
  return 'Shopping list — ' + label + '\n\n' +
    (items.length ? items.map(i => '☐ ' + i.name + '  (' + i.days.join(', ') + (i.status !== 'Not stocked' ? ' · ' + i.status.toLowerCase() : '') + ')').join('\n') : 'Nothing needed.') +
    (skipped.length ? '\n\nAlready in cupboard: ' + skipped.map(x => x.name).join(', ') : '');
}

export function budget(D: HouseholdData) {
  const cats = D.cats.map((c, i) => {
    const e = num(c.ella), j = num(c.jackson);
    return { ...c, e, j, total: e + j, color: CAT_COLORS[i % CAT_COLORS.length] };
  });
  const spend = cats.reduce((a, c) => a + c.total, 0);
  const income = D.incomes.reduce((a, i) => a + num(i.amount), 0);
  let acc = 0;
  const stops = cats.filter(c => c.total > 0).map(c => {
    const a = acc / spend * 360;
    acc += c.total;
    return c.color + ' ' + a + 'deg ' + (acc / spend * 360) + 'deg';
  });
  return {
    cats, spend, income,
    ella: cats.reduce((a, c) => a + c.e, 0),
    jackson: cats.reduce((a, c) => a + c.j, 0),
    donut: spend ? 'conic-gradient(' + stops.join(',') + ')' : '#EAE6DD',
  };
}
