import { addDays, DOW, key, MON, parse } from './dates';
import { CAT_COLORS, earnings, EXTRA_COLOR, HouseholdData, INCLUDE_LOW, Meal, MEALS, norm, num, shareOf, Spend, PantryItem, Price, Recipe, RecipeIngredient, STAPLE_COST, Unit } from './model';

// ── Plan ───────────────────────────────────────────────────────────────────

export interface PlannedMeal { day: number; dateKey: string; meal: Meal; recipe: Recipe }

/** Every planned meal in the week starting `mon`, in day then meal order. */
export function weekMeals(D: HouseholdData, mon: Date): PlannedMeal[] {
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const out: PlannedMeal[] = [];
  for (let day = 0; day < 7; day++) {
    const dateKey = key(addDays(mon, day)), p = D.plan[dateKey] ?? {};
    for (const meal of MEALS) {
      const recipe = rBy.get(p[meal] ?? '');
      if (recipe) out.push({ day, dateKey, meal, recipe });
    }
  }
  return out;
}

// ── This week's budget ────────────────────────────────────────────────────

export interface Split { e: number; j: number; total: number }
const split = (e: number, j: number): Split => ({ e: round(e), j: round(j), total: round(e + j) });

export interface CategoryWeek {
  id: string;
  name: string;
  color: string;
  fixed: boolean;
  /** Filled by the meal plan (the "Groceries" category). */
  grocery: boolean;
  budget: Split;
  /** Spent so far this week: logged spends, plus planned meals for groceries; fixed = budget. */
  spent: Split;
  /** What counts towards the totals: the budget, or the spend where it's gone over. */
  counted: Split;
  over: number;
  mealCost: number;
  spends: Spend[];
}

/**
 * The week's budget against what's been spent. Each person's budget counts
 * until their spending goes over it; planned meals fill Groceries 50/50.
 */
export function weekBudget(D: HouseholdData, mon: Date) {
  const wk = key(mon);
  const spends = D.spends[wk] ?? [], extras = D.extras[wk] ?? [];
  const ctx = costContext(D);
  const mealCost = round(weekMeals(D, mon).reduce((a, m) => a + recipeCost(m.recipe, ctx), 0));
  const grocId = D.cats.find(c => /grocer/i.test(c.name))?.id;

  const cats: CategoryWeek[] = D.cats.map((c, i) => {
    const be = num(c.ella), bj = num(c.jackson), fixed = !!c.fixed, grocery = c.id === grocId;
    const mine = spends.filter(s => s.cat === c.id);
    let se = mine.reduce((a, s) => a + shareOf(s.who, s.amount, 'ella'), 0);
    let sj = mine.reduce((a, s) => a + shareOf(s.who, s.amount, 'jackson'), 0);
    if (grocery) { se += mealCost / 2; sj += mealCost / 2; }
    if (fixed) { se = Math.max(se, be); sj = Math.max(sj, bj); }
    const counted = split(Math.max(be, se), Math.max(bj, sj));
    const budget = split(be, bj);
    return {
      id: c.id, name: c.name, color: CAT_COLORS[i % CAT_COLORS.length], fixed, grocery,
      budget, spent: split(se, sj), counted, over: round(Math.max(0, se + sj - budget.total)),
      mealCost: grocery ? mealCost : 0, spends: mine,
    };
  });

  const extra = split(extras.reduce((a, x) => a + shareOf(x.who, x.amount, 'ella'), 0), extras.reduce((a, x) => a + shareOf(x.who, x.amount, 'jackson'), 0));
  const sum = (f: (c: CategoryWeek) => Split) => split(cats.reduce((a, c) => a + f(c).e, 0) + extra.e, cats.reduce((a, c) => a + f(c).j, 0) + extra.j);
  const committed = sum(c => c.counted), spent = sum(c => c.spent);
  const income = D.incomes.reduce((a, i) => a + num(i.amount), 0);
  return {
    cats, extra, committed, spent, income,
    left: round(income - committed.total),
    ellaLeft: round(earnings(D, 'ella') - committed.e),
    jacksonLeft: round(earnings(D, 'jackson') - committed.j),
    slices: [...cats.map(c => ({ label: c.name, total: c.counted.total, color: c.color })), { label: 'This week only', total: extra.total, color: EXTRA_COLOR }],
  };
}

// ── Units ──────────────────────────────────────────────────────────────────

export type Dim = 'mass' | 'volume' | 'count';
const UNIT_BASE: Record<Unit, [Dim, number]> = { g: ['mass', 1], kg: ['mass', 1000], ml: ['volume', 1], L: ['volume', 1000], each: ['count', 1] };
const BASE_UNIT: Record<Dim, Unit> = { mass: 'g', volume: 'ml', count: 'each' };

export interface Amount { dim: Dim; v: number }

/** Amount in grams, millilitres or items. */
export const toBase = (qty: number, unit: Unit): Amount => ({ dim: UNIT_BASE[unit][0], v: qty * UNIT_BASE[unit][1] });
export const baseUnit = (dim: Dim) => BASE_UNIT[dim];

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const fmtNum = (n: number) => round(n).toLocaleString('en-AU', { maximumFractionDigits: 2 });

export function fmtAmount({ dim, v }: Amount) {
  if (dim === 'mass') return v >= 1000 ? fmtNum(v / 1000) + ' kg' : fmtNum(v) + ' g';
  if (dim === 'volume') return v >= 1000 ? fmtNum(v / 1000) + ' L' : fmtNum(v) + ' ml';
  return fmtNum(v) + (v === 1 ? ' unit' : ' units');
}
export const fmtQty = (qty: number, unit: Unit) => (unit === 'each' ? fmtAmount({ dim: 'count', v: qty }) : fmtNum(qty) + ' ' + unit);

const pantryAmount = (p: PantryItem | undefined): Amount | null => (p && p.qty != null && p.unit ? toBase(p.qty, p.unit) : null);

// ── Costs ──────────────────────────────────────────────────────────────────

export const priceMap = (D: HouseholdData) => new Map(D.prices.map(p => [norm(p.name), p]));

/** Share of the purchase price this ingredient uses, or null if it can't be worked out. */
export function useCost(g: { qty?: number; unit?: Unit }, pr: Price | undefined) {
  if (!pr || !g.qty || !g.unit || !pr.qty) return null;
  const use = toBase(g.qty, g.unit), buy = toBase(pr.qty, pr.unit);
  if (use.dim !== buy.dim) return null;
  return pr.price * use.v / buy.v;
}

/** Meal cost from its ingredients; falls back to the old flat cost until any ingredient is priced. */
export const stapleSet = (D: HouseholdData) => new Set(D.staples.map(norm));

export interface CostContext { prices: Map<string, Price>; staples: Set<string> }
export const costContext = (D: HouseholdData): CostContext => ({ prices: priceMap(D), staples: stapleSet(D) });

/** Meal cost from its ingredients (staples at a nominal amount); falls back to the old flat cost until any ingredient is priced. */
export function recipeCost(r: Recipe, { prices, staples }: CostContext) {
  const isStaple = (n: string) => staples.has(norm(n));
  const costs = r.ingredients.filter(g => !isStaple(g.name)).map(g => useCost(g, prices.get(norm(g.name)))).filter((c): c is number => c !== null);
  const stapleCost = r.ingredients.filter(g => isStaple(g.name)).length * STAPLE_COST;
  if (!costs.length && r.cost) return r.cost;
  return round(costs.reduce((a, c) => a + c, 0) + stapleCost);
}

export function searchRecipes(recipes: Recipe[], q: string) {
  const pq = norm(q);
  return recipes.filter(r => !pq || norm(r.name).includes(pq) || r.ingredients.some(g => norm(g.name).includes(pq)));
}

/** In stock for the "dots" on recipe cards. */
export function isStocked(p: PantryItem | undefined) {
  if (!p) return false;
  const a = pantryAmount(p);
  return a ? a.v > 0 : p.state === 'Full' || p.state === 'Half' || (!INCLUDE_LOW && p.state === 'Low');
}

// ── Expiry ─────────────────────────────────────────────────────────────────

/** Days before the use-by date that count as "expiring soon". */
export const SOON_DAYS = 3;

export function expiry(expires: string | undefined, today = new Date()) {
  if (!expires) return null;
  const days = Math.round((+parse(expires) - +parse(key(today))) / 864e5);
  const d = parse(expires), date = d.getDate() + ' ' + MON[d.getMonth()];
  const label = days < 0 ? 'Expired ' + date : days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : days <= SOON_DAYS ? 'Expires in ' + days + ' days' : 'Use by ' + date;
  return { days, label, expired: days < 0, soon: days >= 0 && days <= SOON_DAYS };
}

// ── Shopping list ──────────────────────────────────────────────────────────

export interface ShopItem {
  lk: string;
  name: string;
  days: string[];
  status: string;
  /** Total the week's dinners use, when every recipe gives an amount in compatible units. */
  need: Amount | null;
  /** Pantry amount counted towards `need`. */
  have: Amount | null;
  buy: Price | null;
  packs: number;
  cost: number | null;
}
export interface Skipped { name: string; note: string }

interface Need { name: string; days: string[]; need: Amount | null; exact: boolean }

function weekNeeds(D: HouseholdData, mon: Date) {
  const needs = new Map<string, Need>();
  for (const m of weekMeals(D, mon)) for (const g of m.recipe.ingredients) addNeed(needs, g, DOW[m.day]);
  return needs;
}

function addNeed(needs: Map<string, Need>, g: RecipeIngredient, day: string) {
  const name = g.name.trim();
  if (!name) return;
  const lk = norm(name);
  let e = needs.get(lk);
  if (!e) { e = { name, days: [], need: null, exact: true }; needs.set(lk, e); }
  if (e.days.indexOf(day) < 0) e.days.push(day);
  if (!g.qty || !g.unit) { e.exact = false; return; }
  const a = toBase(g.qty, g.unit);
  if (!e.need) e.need = a;
  else if (e.need.dim === a.dim) e.need = { dim: a.dim, v: e.need.v + a.v };
  else e.exact = false;
}

/** What to buy for the week's dinners, after what's already in the pantry. */
export function shoppingList(D: HouseholdData, mon: Date, today = new Date()) {
  const wk = key(mon);
  // Expired items don't count as stock.
  const pantry = new Map(D.pantry.filter(p => !expiry(p.expires, today)?.expired).map(p => [norm(p.name), p]));
  const expired = new Set(D.pantry.filter(p => expiry(p.expires, today)?.expired).map(p => norm(p.name)));
  const prices = priceMap(D), staples = stapleSet(D);
  const items: ShopItem[] = [], skipped: Skipped[] = [];

  weekNeeds(D, mon).forEach((n, lk) => {
    const p = pantry.get(lk), have = pantryAmount(p), need = n.exact ? n.need : null;
    let short: Amount | null = need, status: string;

    if (have) {
      if (p!.forWeek === wk) { skipped.push({ name: n.name, note: 'bought' }); return; }
      if (need && have.dim === need.dim) {
        if (have.v >= need.v) { skipped.push({ name: n.name, note: fmtAmount(have) }); return; }
        short = { dim: need.dim, v: need.v - have.v };
        status = have.v > 0 ? 'Have ' + fmtAmount(have) : 'Run out';
      } else {
        if (have.v > 0) { skipped.push({ name: n.name, note: fmtAmount(have) }); return; }
        status = 'Run out';
      }
    } else if (isStocked(p)) {
      skipped.push({ name: n.name, note: p!.state }); return;
    } else {
      status = expired.has(lk) ? 'Expired' : p ? p.state : 'Not stocked';
    }

    // Staples are bought now and then, not per recipe, so they get no pack size or price.
    const pr = staples.has(lk) ? null : prices.get(lk) ?? null;
    let packs = pr ? 1 : 0;
    if (pr && short && toBase(pr.qty, pr.unit).dim === short.dim) packs = Math.max(1, Math.ceil(short.v / toBase(pr.qty, pr.unit).v - 1e-9));
    items.push({
      lk, name: n.name, days: n.days, status, need, packs, buy: pr,
      have: have && need && have.dim === need.dim ? have : null,
      cost: pr ? round(packs * pr.price) : null,
    });
  });
  return { items, skipped };
}

export const buyText = (i: ShopItem) =>
  !i.buy ? '' : i.buy.unit === 'each' ? fmtQty(i.buy.qty * i.packs, 'each') : (i.packs > 1 ? i.packs + ' × ' : '') + fmtQty(i.buy.qty, i.buy.unit);

/**
 * Puts bought items in the pantry. When we know how much the week's dinners
 * use, the pantry gets the leftover (what was there + what was bought − what
 * the dinners use) and is marked as already allowing for that week.
 */
export function stockUp(x: HouseholdData, items: ShopItem[], wk: string, expires: Record<string, string> = {}) {
  for (const i of items) {
    let p = x.pantry.find(c => norm(c.name) === i.lk);
    if (!p) { p = { name: i.name, state: 'Full' }; x.pantry.push(p); }
    const wasExpired = !!expiry(p.expires)?.expired;
    if (expires[i.lk]) p.expires = expires[i.lk];
    else if (wasExpired) delete p.expires;
    const bought = i.buy ? toBase(i.buy.qty * i.packs, i.buy.unit) : null;
    if (!bought) { p.state = 'Full'; delete p.qty; delete p.unit; delete p.forWeek; continue; }
    const had = wasExpired ? null : pantryAmount(p);
    const start = had && had.dim === bought.dim ? had.v : 0;
    const used = i.need && i.need.dim === bought.dim ? i.need.v : 0;
    p.qty = round(Math.max(0, start + bought.v - used));
    p.unit = baseUnit(bought.dim);
    p.state = 'Full';
    if (used) p.forWeek = wk; else delete p.forWeek;
  }
}

export function shoppingText(label: string, items: ShopItem[], skipped: Skipped[]) {
  const total = items.reduce((a, i) => a + (i.cost ?? 0), 0);
  const line = (i: ShopItem) => {
    const bits = [i.days.join(', ')];
    if (i.buy) bits.push(buyText(i));
    if (i.status !== 'Not stocked') bits.push(i.status.toLowerCase());
    return '☐ ' + i.name + '  (' + bits.join(' · ') + ')';
  };
  return 'Shopping list — ' + label + '\n\n' +
    (items.length ? items.map(line).join('\n') : 'Nothing needed.') +
    (total ? '\n\nEstimated total: $' + total.toFixed(2) : '') +
    (skipped.length ? '\n\nAlready in pantry: ' + skipped.map(x => x.name).join(', ') : '');
}

