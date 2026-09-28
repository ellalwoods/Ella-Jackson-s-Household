import { addDays, DOW, dowIndex, key, MON, mondayOf, ord, parse } from './dates';

export type PersonId = 'ella' | 'jackson';

export const PEOPLE: Record<PersonId, { name: string; color: string; ink: string; tint: string }> = {
  ella: { name: 'Ella', color: '#E886B8', ink: '#A9477B', tint: '#FAE3EE' },
  jackson: { name: 'Jackson', color: '#2A9E80', ink: '#1B6B56', tint: '#DAEFE7' },
};

export const otherPerson = (p: PersonId): PersonId => (p === 'ella' ? 'jackson' : 'ella');

/** Chores can also be shared, shown in dusty blue. */
export type ChoreOwner = PersonId | 'both';
export const OWNERS: Record<ChoreOwner, { name: string; color: string; ink: string; tint: string }> = {
  ...PEOPLE,
  both: { name: 'Both', color: '#8FB0CF', ink: '#3F6A8F', tint: '#E3EDF6' },
};
export const CHORE_OWNERS: ChoreOwner[] = ['ella', 'jackson', 'both'];
export const nextOwner = (o: ChoreOwner) => CHORE_OWNERS[(CHORE_OWNERS.indexOf(o) + 1) % CHORE_OWNERS.length];

/** Pie chart / category colours, assigned by category order. */
export const CAT_COLORS = ['#8FB0CF', '#C4A8D4', '#86C2BF', '#DCD690', '#F0A88C', '#E3CBC6', '#6F93B5', '#A98BBA'];

export const STATES = ['Full', 'Half', 'Low', 'Replace'] as const;
export type StockState = (typeof STATES)[number];
export const STATE_COLORS: Record<StockState, string> = { Full: '#86C2BF', Half: '#C4A8D4', Low: '#DCD690', Replace: '#F0A88C' };

/** When true, Low items still go on the shopping list (only Full/Half are skipped). */
export const INCLUDE_LOW = true;

/** Amounts are kept as typed (string) while editing; read them with `num`. */
export type Amount = number | string;
export const num = (a: Amount | undefined) => +(a ?? 0) || 0;

export const UNITS = ['g', 'kg', 'ml', 'L', 'each'] as const;
export type Unit = (typeof UNITS)[number];
/** 'each' is shown as "unit". */
export const UNIT_LABEL: Record<Unit, string> = { g: 'g', kg: 'kg', ml: 'ml', L: 'L', each: 'unit' };

/** Nominal cost each time a recipe uses a staple (salt, pepper, spices…). */
export const STAPLE_COST = 0.05;

export const MEALS = ['breakfast', 'lunch', 'dinner', 'other'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', other: 'Other' };
/** Recipe planned for each meal of a day. */
export type DayPlan = Partial<Record<Meal, string>>;

/** How much of an ingredient a recipe uses (both optional: some things are "to taste"). */
export interface RecipeIngredient { name: string; qty?: number; unit?: Unit }
/** A named group of interchangeable ingredients, e.g. "Vegetables". */
export interface Bucket { id: string; name: string; items: RecipeIngredient[] }
/** A recipe uses `count` items of its choosing from a bucket, picked when the meal is planned. */
export interface BucketUse { bucket: string; count: number }

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  buckets?: BucketUse[];
  /** Which meals it's for; shown first when planning that meal. */
  meals: Meal[];
  link?: string;
  /** Free-text method. */
  method?: string;
  /** Legacy total cost, used only until the recipe's ingredients have prices. */
  cost?: number;
}
/** What you buy, shared by every recipe using the ingredient: e.g. Rice, 1 kg for $3. */
export interface Price { name: string; qty: number; unit: Unit; price: number }
export interface Category {
  id: string;
  name: string;
  /** Weekly budget per person. */
  ella: Amount;
  jackson: Amount;
  /** Always spent in full (e.g. rent), so its bar is always filled. */
  fixed?: boolean;
}
export interface Income { id: string; name: string; person: PersonId; amount: Amount }
/** Tracked by amount (qty + unit) when known, otherwise by level (state). */
export interface PantryItem {
  name: string;
  state: StockState;
  qty?: number;
  unit?: Unit;
  /** Set when stocked from a week's shopping list: the amount already allows for that week's dinners. */
  forWeek?: string;
  /** Use-by date key, e.g. 2026-10-02, or NO_EXPIRY for things that don't go off. */
  expires?: string;
}
export type Schedule =
  | { type: 'weekly'; days: number[] }
  | { type: 'every'; n: number; start: string }
  | { type: 'monthly'; dom: number }
  | { type: 'once'; date: string };
export interface Chore { id: string; name: string; person: ChoreOwner; sched: Schedule }
export const SHOP_SECTIONS = ['food', 'cleaning', 'personal', 'other'] as const;
export type ShopSection = (typeof SHOP_SECTIONS)[number];
export const SHOP_SECTION_LABEL: Record<ShopSection, string> = { food: 'Food', cleaning: 'Cleaning', personal: 'Personal', other: 'Other' };

/** Stored as an item's expiry when it doesn't expire (the "N/A" option). */
export const NO_EXPIRY = 'none';

/** Something added to the shopping list by hand (not from a recipe). */
export interface ManualShopItem { id: string; name: string; qty?: number; unit?: Unit; price?: number }

/** A calendar tag: the name is whatever you type; colour is picked automatically. */
export interface Tag { name: string; color: string }
export interface CalEvent {
  id: string;
  /** Date key, e.g. 2026-10-03. */
  date: string;
  title: string;
  /** 24h "HH:MM" from a time input. */
  time?: string;
  place?: string;
  who: ChoreOwner;
  notes?: string;
  /** Tag names; the first one colours the event. */
  tags: string[];
}
export const TAG_COLORS = ['#8FB0CF', '#C4A8D4', '#86C2BF', '#DCD690', '#F0A88C', '#E3CBC6', '#6F93B5', '#A98BBA', '#E886B8', '#2A9E80'];

/** Soft version of a colour for event boxes: mixed `t` of the way to white. */
export function soft(hex: string, t = 0.72) {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t);
  return 'rgb(' + mix(n >> 16) + ',' + mix((n >> 8) & 255) + ',' + mix(n & 255) + ')';
}

/** Money spent in a budget category during a week; `who: 'both'` splits it 50/50. */
export interface Spend { id: string; cat: string; amount: Amount; who: ChoreOwner; note?: string }
/** A one-off cost for a single week; `who: 'both'` splits it 50/50. */
export interface Extra { id: string; name: string; amount: Amount; who: ChoreOwner }

export interface HouseholdData {
  incomes: Income[];
  cats: Category[];
  recipes: Recipe[];
  /** Meals per date key. */
  plan: Record<string, DayPlan>;
  prices: Price[];
  /** Ingredients used without measuring (e.g. salt), shared across recipes. */
  staples: string[];
  pantry: PantryItem[];
  chores: Chore[];
  /** `${dateKey}|${choreId}` → 1 when done. */
  done: Record<string, 1>;
  /** One-off costs by week (Monday's date key). Not part of the recurring budget. */
  extras: Record<string, Extra[]>;
  /** Logged spending by week (Monday's date key). */
  spends: Record<string, Spend[]>;
  events: CalEvent[];
  tags: Tag[];
  /** Hand-added shopping items by week (Monday's date key). */
  shopExtras: Record<string, ManualShopItem[]>;
  /** Shopping list section chosen for an item, by normalised name. */
  shopSections: Record<string, ShopSection>;
  buckets: Bucket[];
  /** Bucket items picked for a planned meal: `${dateKey}|${meal}` → bucket id → item names. */
  picks: Record<string, Record<string, string[]>>;
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export const money = (v: number) => {
  const n = Math.round((+v || 0) * 100) / 100;
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export function seed(today = new Date()): HouseholdData {
  const m = mondayOf(today), k = (i: number) => key(addDays(m, i));
  const plan: HouseholdData['plan'] = { [k(0)]: { dinner: 'bol' }, [k(1)]: { dinner: 'stir' }, [k(3)]: { dinner: 'tray' } };
  return {
    incomes: [
      { id: uid(), name: 'Salary', person: 'ella', amount: 1150 },
      { id: uid(), name: 'Salary', person: 'jackson', amount: 1250 },
    ],
    cats: [
      { id: uid(), name: 'Rent', ella: 380, jackson: 380, fixed: true },
      { id: uid(), name: 'Groceries', ella: 90, jackson: 90 },
      { id: uid(), name: 'Utilities', ella: 35, jackson: 35 },
      { id: uid(), name: 'Transport', ella: 45, jackson: 45 },
      { id: uid(), name: 'Leisure', ella: 60, jackson: 60 },
    ],
    recipes: [
      { id: 'bol', name: 'Spaghetti bolognese', meals: ['dinner'], ingredients: [
        { name: 'Spaghetti', qty: 400, unit: 'g' }, { name: 'Beef mince', qty: 500, unit: 'g' }, { name: 'Passata', qty: 700, unit: 'ml' },
        { name: 'Onion', qty: 1, unit: 'each' }, { name: 'Garlic', qty: 0.25, unit: 'each' }, { name: 'Carrot', qty: 150, unit: 'g' }, { name: 'Parmesan', qty: 40, unit: 'g' }] },
      { id: 'stir', name: 'Veggie stir-fry', meals: ['dinner', 'lunch'], ingredients: [
        { name: 'Rice', qty: 200, unit: 'g' }, { name: 'Broccoli', qty: 1, unit: 'each' }, { name: 'Capsicum', qty: 1, unit: 'each' }, { name: 'Soy sauce', qty: 30, unit: 'ml' },
        { name: 'Ginger', qty: 20, unit: 'g' }, { name: 'Garlic', qty: 0.25, unit: 'each' }, { name: 'Tofu', qty: 450, unit: 'g' }] },
      { id: 'tray', name: 'Lemon chicken tray bake', meals: ['dinner'], ingredients: [
        { name: 'Chicken thighs', qty: 600, unit: 'g' }, { name: 'Potatoes', qty: 600, unit: 'g' }, { name: 'Lemon', qty: 1, unit: 'each' },
        { name: 'Garlic', qty: 0.25, unit: 'each' }, { name: 'Rosemary', qty: 0.5, unit: 'each' }, { name: 'Olive oil', qty: 30, unit: 'ml' }] },
      { id: 'salmon', name: 'Salmon, rice & greens', meals: ['dinner', 'lunch'], ingredients: [
        { name: 'Salmon', qty: 250, unit: 'g' }, { name: 'Rice', qty: 150, unit: 'g' }, { name: 'Green beans', qty: 250, unit: 'g' },
        { name: 'Lemon', qty: 0.5, unit: 'each' }, { name: 'Soy sauce', qty: 20, unit: 'ml' }] },
    ],
    prices: [
      { name: 'Spaghetti', qty: 500, unit: 'g', price: 2.5 }, { name: 'Beef mince', qty: 500, unit: 'g', price: 8 }, { name: 'Passata', qty: 700, unit: 'ml', price: 2.5 },
      { name: 'Onion', qty: 1, unit: 'each', price: 0.6 }, { name: 'Garlic', qty: 1, unit: 'each', price: 1 }, { name: 'Carrot', qty: 1, unit: 'kg', price: 2.5 },
      { name: 'Parmesan', qty: 250, unit: 'g', price: 7 }, { name: 'Rice', qty: 1, unit: 'kg', price: 3 }, { name: 'Broccoli', qty: 1, unit: 'each', price: 2.5 },
      { name: 'Capsicum', qty: 1, unit: 'each', price: 1.8 }, { name: 'Soy sauce', qty: 250, unit: 'ml', price: 3 }, { name: 'Ginger', qty: 100, unit: 'g', price: 2 },
      { name: 'Tofu', qty: 450, unit: 'g', price: 4 }, { name: 'Chicken thighs', qty: 1, unit: 'kg', price: 13 }, { name: 'Potatoes', qty: 2, unit: 'kg', price: 5 },
      { name: 'Lemon', qty: 1, unit: 'each', price: 0.9 }, { name: 'Rosemary', qty: 1, unit: 'each', price: 3 }, { name: 'Olive oil', qty: 1, unit: 'L', price: 12 },
      { name: 'Salmon', qty: 500, unit: 'g', price: 16 }, { name: 'Green beans', qty: 250, unit: 'g', price: 3 },
    ],
    staples: [],
    plan,
    pantry: [
      { name: 'Olive oil', state: 'Full' }, { name: 'Soy sauce', state: 'Full' }, { name: 'Rice', state: 'Full', qty: 600, unit: 'g' },
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
    extras: {},
    spends: {},
    events: [],
    tags: [],
    shopExtras: {},
    shopSections: {},
    buckets: [],
    picks: {},
  };
}

/** Upgrades older saved data: the prototype's single income, `cupboard` → `pantry`, plain-text ingredients, dinner-only plans. */
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
  d.recipes ??= []; d.plan ??= {}; d.chores ??= []; d.done ??= {}; d.prices ??= []; d.staples ??= []; d.extras ??= {}; d.spends ??= {}; d.events ??= []; d.tags ??= []; d.shopExtras ??= {}; d.shopSections ??= {}; d.buckets ??= []; d.picks ??= {};
  for (const c of d.cats) if (c.fixed === undefined && /\brent\b/i.test(c.name)) c.fixed = true;
  if (!Array.isArray(d.pantry)) d.pantry = Array.isArray(d.cupboard) ? d.cupboard : [];
  delete d.cupboard;
  for (const r of d.recipes) {
    r.ingredients = (r.ingredients ?? []).map((g: unknown) => (typeof g === 'string' ? { name: g } : g));
    if (!Array.isArray(r.meals)) r.meals = ['dinner'];
  }
  // Older plans held one dinner per day as { r }.
  for (const k of Object.keys(d.plan)) {
    const v = d.plan[k];
    if (v && typeof v.r === 'string') d.plan[k] = { dinner: v.r };
  }
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

export const EXTRA_COLOR = '#BFB8AA';

/** Ella's or Jackson's part of an amount paid by `who`. */
export const shareOf = (who: ChoreOwner, amount: Amount, p: PersonId) =>
  who === p ? num(amount) : who === 'both' ? num(amount) / 2 : 0;

export const earnings = (D: HouseholdData, p: PersonId) =>
  D.incomes.filter(i => i.person === p).reduce((a, i) => a + num(i.amount), 0);

export interface Slice { label: string; total: number; color: string }

/** Pie chart background for slices with a total and a colour. */
export function donutOf(slices: { total: number; color: string }[]) {
  const sum = slices.reduce((a, c) => a + Math.max(0, c.total), 0);
  if (!sum) return '#EAE6DD';
  let acc = 0;
  const stops = slices.filter(c => c.total > 0).map(c => {
    const a = acc / sum * 360;
    acc += c.total;
    return c.color + ' ' + a + 'deg ' + (acc / sum * 360) + 'deg';
  });
  return 'conic-gradient(' + stops.join(',') + ')';
}

/** The recurring weekly budget, as set on the Budget page. */
export function budget(D: HouseholdData) {
  const cats = D.cats.map((c, i) => {
    const e = num(c.ella), j = num(c.jackson);
    return { ...c, e, j, total: e + j, color: CAT_COLORS[i % CAT_COLORS.length] };
  });
  const spend = cats.reduce((a, c) => a + c.total, 0);
  const income = D.incomes.reduce((a, i) => a + num(i.amount), 0);
  const ella = cats.reduce((a, c) => a + c.e, 0), jackson = cats.reduce((a, c) => a + c.j, 0);
  return {
    cats, spend, income,
    ella, jackson,
    left: income - spend,
    ellaLeft: earnings(D, 'ella') - ella,
    jacksonLeft: earnings(D, 'jackson') - jackson,
    slices: cats.map(c => ({ label: c.name, total: c.total, color: c.color })),
  };
}
