import { addDays, DOW, key, MON, parse } from './dates';
import { BLANK_PICK, Bucket, BucketItem, CAT_COLORS, Category, isShare, shareFractions, shareOut, earnings, NO_EXPIRY, SHOP_SECTION_LABEL, SHOP_SECTIONS, ShopSection, EXTRA_COLOR, HouseholdData, INCLUDE_LOW, Meal, MEALS, norm, num, shareOf, Spend, PantryItem, Price, Recipe, RecipeIngredient, STAPLE_COST, Unit } from './model';

// ── Plan ───────────────────────────────────────────────────────────────────

export interface PlannedMeal {
  day: number;
  dateKey: string;
  meal: Meal;
  recipe: Recipe;
  /** Bucket id → item names picked for this meal. */
  picks: Record<string, string[]>;
}

/** Key for a planned meal's bucket picks. */
export const slotKey = (dateKey: string, meal: Meal) => dateKey + '|' + meal;

/** Every planned meal in the week starting `mon`, in day then meal order. */
export function weekMeals(D: HouseholdData, mon: Date): PlannedMeal[] {
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const out: PlannedMeal[] = [];
  for (let day = 0; day < 7; day++) {
    const dateKey = key(addDays(mon, day)), p = D.plan[dateKey] ?? {};
    for (const meal of MEALS) {
      const recipe = rBy.get(p[meal] ?? '');
      if (recipe) out.push({ day, dateKey, meal, recipe, picks: D.picks[slotKey(dateKey, meal)] ?? {} });
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
  /** Percentage of what's left, for categories that split it. */
  pct: number | null;
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
  const mealCost = round(weekMeals(D, mon).reduce((a, m) => a + recipeCost(m.recipe, ctx, m.picks), 0));
  const grocId = D.cats.find(c => /grocer/i.test(c.name))?.id;

  const row = (c: Category, i: number, be: number, bj: number, pct: number | null): CategoryWeek => {
    const fixed = !!c.fixed, grocery = c.id === grocId;
    const mine = spends.filter(s => s.cat === c.id);
    let se = mine.reduce((a, s) => a + shareOf(s.who, s.amount, 'ella'), 0);
    let sj = mine.reduce((a, s) => a + shareOf(s.who, s.amount, 'jackson'), 0);
    if (grocery) { se += mealCost / 2; sj += mealCost / 2; }
    if (fixed) { se = Math.max(se, be); sj = Math.max(sj, bj); }
    const counted = split(Math.max(be, se), Math.max(bj, sj));
    const budget = split(be, bj);
    return {
      id: c.id, name: c.name, color: CAT_COLORS[i % CAT_COLORS.length], fixed, grocery, pct,
      budget, spent: split(se, sj), counted, over: round(Math.max(0, se + sj - budget.total)),
      mealCost: grocery ? mealCost : 0, spends: mine,
    };
  };

  // Set amounts first; what's actually left after them (and this week's extras) is shared out.
  const setRows = new Map(D.cats.map((c, i) => [c.id, isShare(c) ? null : row(c, i, num(c.ella), num(c.jackson), null)]));
  const extra = split(extras.reduce((a, x) => a + shareOf(x.who, x.amount, 'ella'), 0), extras.reduce((a, x) => a + shareOf(x.who, x.amount, 'jackson'), 0));
  const setList = [...setRows.values()].filter((c): c is CategoryWeek => !!c);
  const sum = (list: CategoryWeek[], f: (c: CategoryWeek) => Split) => split(list.reduce((a, c) => a + f(c).e, 0) + extra.e, list.reduce((a, c) => a + f(c).j, 0) + extra.j);
  const committed = sum(setList, c => c.counted);
  const ellaLeft = round(earnings(D, 'ella') - committed.e), jacksonLeft = round(earnings(D, 'jackson') - committed.j);
  const part = shareOut(D.cats, ellaLeft, jacksonLeft), frac = shareFractions(D.cats);
  const cats = D.cats.map((c, i) => setRows.get(c.id) ?? row(c, i, part(c).e, part(c).j, frac.get(c.id)! * 100));
  const spent = sum(cats, c => c.spent);
  const income = D.incomes.reduce((a, i) => a + num(i.amount), 0);
  return {
    cats, extra, committed, spent, income,
    left: round(income - committed.total),
    ellaLeft, jacksonLeft,
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

export interface CostContext { prices: Map<string, Price>; staples: Set<string>; buckets: Map<string, Bucket>; recipes: Map<string, Recipe> }
export const costContext = (D: HouseholdData): CostContext => ({
  prices: priceMap(D), staples: stapleSet(D), buckets: new Map(D.buckets.map(b => [b.id, b])), recipes: new Map(D.recipes.map(r => [r.id, r])),
});

/** One ingredient's cost in a meal: a nominal amount for staples, else its share of the purchase price. */
export function ingredientCost(g: RecipeIngredient, { prices, staples }: CostContext) {
  return staples.has(norm(g.name)) ? STAPLE_COST : useCost(g, prices.get(norm(g.name)));
}

/** The mini recipe a bucket item stands for, if any. */
export const miniOf = (g: BucketItem | undefined, ctx: CostContext) => (g?.recipe ? ctx.recipes.get(g.recipe) : undefined);

/** One mini recipe's cost from its priced ingredients (null until any are priced). */
export function miniCost(r: Recipe, ctx: CostContext) {
  const costs = r.ingredients.map(g => ingredientCost(g, ctx)).filter((c): c is number => c !== null);
  return costs.length ? round(costs.reduce((a, c) => a + c, 0)) : r.cost ?? null;
}

/** One bucket item's cost in a meal: a whole mini recipe, or the ingredient's share. */
export function itemCost(g: BucketItem, ctx: CostContext) {
  if (g.recipe) { const r = miniOf(g, ctx); return r ? miniCost(r, ctx) : null; }
  return ingredientCost(g, ctx);
}

/** Average cost of one item from a bucket (over the items that have prices). */
export function bucketAverage(b: Bucket | undefined, ctx: CostContext) {
  const costs = (b?.items ?? []).map(g => itemCost(g, ctx)).filter((c): c is number => c !== null);
  return costs.length ? round(costs.reduce((a, c) => a + c, 0) / costs.length) : 0;
}

/**
 * Meal cost from its ingredients (staples at a nominal amount) plus its
 * buckets: picked items at their own cost, anything not yet picked at the
 * bucket's average. Falls back to the old flat cost until anything is priced.
 */
export function recipeCost(r: Recipe, ctx: CostContext, picks: Record<string, string[]> = {}) {
  const costs = r.ingredients.map(g => ingredientCost(g, ctx)).filter((c): c is number => c !== null);
  let bucketCost = 0;
  for (const u of r.buckets ?? []) {
    const b = ctx.buckets.get(u.bucket), chosen = (picks[u.bucket] ?? []).slice(0, u.count);
    for (const n of chosen) {
      if (n === BLANK_PICK) continue; // left blank on purpose: omitted
      const item = b?.items.find(g => norm(g.name) === norm(n));
      bucketCost += (item && itemCost(item, ctx)) ?? bucketAverage(b, ctx);
    }
    bucketCost += (u.count - chosen.length) * bucketAverage(b, ctx);
  }
  if (!costs.length && !bucketCost && r.cost) return r.cost;
  return round(costs.reduce((a, c) => a + c, 0) + bucketCost);
}

/** Buckets in a planned meal still waiting for items to be picked. */
export function pendingPicks(m: PlannedMeal, D: HouseholdData) {
  return (m.recipe.buckets ?? []).map(u => ({ use: u, bucket: D.buckets.find(b => b.id === u.bucket), picked: (m.picks[u.bucket] ?? []).length }))
    .filter(x => x.bucket && x.picked < x.use.count);
}

export function searchRecipes(recipes: Recipe[], q: string) {
  const pq = norm(q);
  return recipes.filter(r => !pq || norm(r.name).includes(pq) || r.ingredients.some(g => norm(g.name).includes(pq)) || (r.tags ?? []).some(t => norm(t).includes(pq)));
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
  if (!expires || expires === NO_EXPIRY) return null;
  const days = Math.round((+parse(expires) - +parse(key(today))) / 864e5);
  const d = parse(expires), date = d.getDate() + ' ' + MON[d.getMonth()];
  const label = days < 0 ? 'Expired ' + date : days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : days <= SOON_DAYS ? 'Expires in ' + days + ' days' : 'Use by ' + date;
  return { days, label, expired: days < 0, soon: days >= 0 && days <= SOON_DAYS };
}

// ── Shopping list ──────────────────────────────────────────────────────────

// ── Shopping sections ──────────────────────────────────────────────────────

const CLEANING = /(clean|detergent|laundry|bleach|disinfect|sponge|scourer|dishwash|dish ?soap|wipes?\b|bin ?bags?|garbage bags?|rubbish bags?|fabric softener|polish|mop|gloves|steel wool|window|toilet (cleaner|duck)|napisan|vanish|glen ?20|domestos|jif|finish|air freshener)/i;
const PERSONAL = /(tooth|floss|mouthwash|shampoo|conditioner|body ?wash|soap|deodorant|razor|shav|sunscreen|moistur|lotion|tampon|sanitary pads|panty|cotton|tissues|makeup|mascara|lip|hair|nail|vitamin|panadol|nurofen|paracetamol|ibuprofen|bandaid|plasters?|contact|skincare|cleanser|serum|perfume|cologne|condom|pill)/i;
const LAUNDRY = /(laundry|washing (powder|liquid)|fabric softener|softener|napisan|vanish|stain remov|pre-?wash|dryer sheets?|pegs|omo|cold power|biozet|dynamo|sard|ironing|starch)/i;
const HOUSEHOLD = /(toilet paper|toilet roll|paper towel|foil|cling ?wrap|baking paper|batter(y|ies)|light ?bulb|candle|matches|zip ?lock|sandwich bags|freezer bags)/i;

/** A best guess at where a hand-added item belongs; food unless it looks otherwise. */
export function guessSection(name: string): ShopSection {
  if (HOUSEHOLD.test(name)) return 'other';
  if (/dish/i.test(name)) return 'cleaning';
  if (LAUNDRY.test(name)) return 'laundry';
  if (/detergent/i.test(name)) return 'cleaning';
  if (PERSONAL.test(name)) return 'personal';
  if (CLEANING.test(name)) return 'cleaning';
  return 'food';
}

export interface ShopItem {
  section: ShopSection;
  /** Unique on the list (ticks and expiry dates are keyed by it). */
  id: string;
  /** Normalised name, used to match the pantry. */
  lk: string;
  /** Set for items added by hand: the ManualShopItem id. */
  manual?: string;
  /** A staple: bought whole at its purchase price, no amounts. */
  staple?: boolean;
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
  const bBy = new Map(D.buckets.map(b => [b.id, b])), rBy = new Map(D.recipes.map(r => [r.id, r]));
  for (const m of weekMeals(D, mon)) {
    for (const g of m.recipe.ingredients) addNeed(needs, g, DOW[m.day]);
    // Items picked from buckets for this meal, with the amounts set in the bucket.
    for (const u of m.recipe.buckets ?? []) {
      for (const n of (m.picks[u.bucket] ?? []).slice(0, u.count)) {
        if (n === BLANK_PICK) continue;
        const item = bBy.get(u.bucket)?.items.find(g => norm(g.name) === norm(n));
        const mini = item?.recipe ? rBy.get(item.recipe) : undefined;
        // A mini recipe adds all of its ingredients.
        if (mini) for (const g of mini.ingredients) addNeed(needs, g, DOW[m.day]);
        else if (!item?.recipe) addNeed(needs, item ?? { name: n }, DOW[m.day]);
      }
    }
  }
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

    // Staples are bought whole now and then: one at their purchase price, tracked by level (no amount).
    if (staples.has(lk)) {
      const sp = prices.get(lk);
      items.push({
        section: D.shopSections[lk] ?? 'food', id: lk, lk, name: n.name, days: n.days, status,
        need: null, have: null, buy: null, packs: 0, cost: sp ? round(sp.price) : null, staple: true,
      });
      return;
    }
    const pr = prices.get(lk) ?? null;
    let packs = pr ? 1 : 0;
    if (pr && short && toBase(pr.qty, pr.unit).dim === short.dim) packs = Math.max(1, Math.ceil(short.v / toBase(pr.qty, pr.unit).v - 1e-9));
    items.push({
      section: D.shopSections[lk] ?? 'food',
      id: lk, lk, name: n.name, days: n.days, status, need, packs, buy: pr,
      have: have && need && have.dim === need.dim ? have : null,
      cost: pr ? round(packs * pr.price) : null,
    });
  });

  // Hand-added items always show, whatever the pantry holds.
  for (const m of D.shopExtras[wk] ?? []) {
    const buy: Price | null = m.qty && m.unit ? { name: m.name, qty: m.qty, unit: m.unit, price: m.price ?? 0 } : null;
    items.push({
      section: D.shopSections[norm(m.name)] ?? guessSection(m.name),
      id: 'm:' + m.id, lk: norm(m.name), manual: m.id, name: m.name, days: [], status: 'Added',
      need: null, have: null, buy, packs: buy ? 1 : 0, cost: m.price != null ? round(m.price) : null,
    });
  }
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
  const bought = new Set(items.map(i => i.manual).filter(Boolean));
  if (bought.size && x.shopExtras[wk]) {
    x.shopExtras[wk] = x.shopExtras[wk].filter(m => !bought.has(m.id));
    if (!x.shopExtras[wk].length) delete x.shopExtras[wk];
  }
  for (const i of items) {
    let p = x.pantry.find(c => norm(c.name) === i.lk);
    if (!p) { p = { name: i.name, state: 'Full' }; x.pantry.push(p); }
    const wasExpired = !!expiry(p.expires)?.expired;
    const exp = expires[i.id] ?? expires[i.lk];
    if (exp) p.expires = exp;
    else if (wasExpired) delete p.expires;
    const got = i.buy ? toBase(i.buy.qty * i.packs, i.buy.unit) : null;
    if (!got) { p.state = 'Full'; delete p.qty; delete p.unit; delete p.forWeek; continue; }
    const had = wasExpired ? null : pantryAmount(p);
    const start = had && had.dim === got.dim ? had.v : 0;
    const used = i.need && i.need.dim === got.dim ? i.need.v : 0;
    p.qty = round(Math.max(0, start + got.v - used));
    p.unit = baseUnit(got.dim);
    p.state = 'Full';
    if (used) p.forWeek = wk; else delete p.forWeek;
  }
}

/**
 * Adds something to the pantry by hand. An amount is added to what's there
 * (in matching units) or replaces a level; without one the item is marked Full.
 */
export function addToPantry(x: HouseholdData, item: { name: string; qty?: number; unit?: Unit; expires?: string }) {
  const name = item.name.trim();
  if (!name) return;
  let p = x.pantry.find(c => norm(c.name) === norm(name));
  if (!p) { p = { name, state: 'Full' }; x.pantry.push(p); }
  if (item.qty && item.unit) {
    const add = toBase(item.qty, item.unit), had = pantryAmount(p);
    if (had && had.dim === add.dim) { p.qty = round(had.v + add.v); p.unit = baseUnit(add.dim); }
    else { p.qty = item.qty; p.unit = item.unit; }
    delete p.forWeek;
  }
  p.state = 'Full';
  if (item.expires) p.expires = item.expires;
}

/**
 * Sets an ingredient's shared purchase price. With a qty and unit that's the
 * pack it buys; otherwise any pack size already known is kept (else 1 unit).
 */
export function setPrice(x: HouseholdData, name: string, price: number, qty?: number, unit?: Unit) {
  const n = name.trim();
  if (!n || isNaN(price)) return;
  const i = x.prices.findIndex(p => norm(p.name) === norm(n)), had = i >= 0 ? x.prices[i] : undefined;
  const p: Price = { name: had?.name ?? n, qty: qty && unit ? qty : had?.qty ?? 1, unit: qty && unit ? unit : had?.unit ?? 'each', price };
  if (i >= 0) x.prices[i] = p; else x.prices.push(p);
}

export function shoppingText(label: string, items: ShopItem[], skipped: Skipped[]) {
  const total = items.reduce((a, i) => a + (i.cost ?? 0), 0);
  const line = (i: ShopItem) => {
    const bits = i.days.length ? [i.days.join(', ')] : [];
    if (i.buy) bits.push(buyText(i));
    if (i.status !== 'Not stocked' && !i.manual) bits.push(i.status.toLowerCase());
    return '☐ ' + i.name + (bits.length ? '  (' + bits.join(' · ') + ')' : '');
  };
  return 'Shopping list — ' + label + '\n\n' +
    (items.length
      ? SHOP_SECTIONS.map(s => items.filter(i => i.section === s)).filter(g => g.length)
        .map(g => SHOP_SECTION_LABEL[g[0].section] + '\n' + g.map(line).join('\n')).join('\n\n')
      : 'Nothing needed.') +
    (total ? '\n\nEstimated total: $' + total.toFixed(2) : '') +
    (skipped.length ? '\n\nAlready in pantry: ' + skipped.map(x => x.name).join(', ') : '');
}

