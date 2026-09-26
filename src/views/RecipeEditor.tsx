import { useState } from 'react';
import { HouseholdData, money, norm, Price, Recipe, RecipeIngredient, STAPLE_COST, uid, Unit } from '../lib/model';
import { priceMap, stapleSet, useCost } from '../lib/food';
import type { Update } from '../Household';
import { UnitSelect } from './PantryPage';

interface Row {
  key: string;
  name: string;
  qty: string;
  unit: Unit;
  buyQty: string;
  buyUnit: Unit;
  price: string;
  /** Buy fields were filled in from the saved price, so they follow the name until edited. */
  auto: boolean;
  /** Used without measuring; costs a nominal amount. */
  staple: boolean;
}

const blankRow = (): Row => ({ key: uid(), name: '', qty: '', unit: 'g', buyQty: '', buyUnit: 'g', price: '', auto: false, staple: false });
const numOr = (s: string) => (s.trim() === '' ? undefined : parseFloat(s));

function fromPrice(row: Row, pr: Price | undefined): Row {
  return pr
    ? { ...row, buyQty: String(pr.qty), buyUnit: pr.unit, price: String(pr.price), auto: true }
    : { ...row, buyQty: '', buyUnit: row.unit, price: '', auto: false };
}

/** Safe outbound link: only http(s), adding https:// when left off. */
export function safeLink(s: string | undefined) {
  const t = (s ?? '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? '' : 'https://' + t;
}

interface Props { D: HouseholdData; update: Update; recipe: Recipe | null; onDone: () => void }

export default function RecipeEditor({ D, update, recipe, onDone }: Props) {
  const prices = priceMap(D), staples = stapleSet(D);
  const [name, setName] = useState(recipe?.name ?? '');
  const [link, setLink] = useState(recipe?.link ?? '');
  const [method, setMethod] = useState(recipe?.method ?? '');
  const [rows, setRows] = useState<Row[]>(() => {
    const rs = (recipe?.ingredients ?? []).map(g => fromPrice({ ...blankRow(), name: g.name, qty: g.qty != null ? String(g.qty) : '', unit: g.unit ?? 'g', staple: staples.has(norm(g.name)) }, prices.get(norm(g.name))));
    return rs.length ? rs : [blankRow()];
  });

  const known = Array.from(new Set([...D.prices.map(p => p.name), ...D.pantry.map(p => p.name), ...D.recipes.flatMap(r => r.ingredients.map(g => g.name))])).sort();

  const setRow = (k: string, patch: Partial<Row>) => setRows(rs => rs.map(r => {
    if (r.key !== k) return r;
    const next = { ...r, ...patch };
    if ('name' in patch && staples.has(norm(next.name))) next.staple = true;
    if ('name' in patch && (r.auto || (!r.buyQty && !r.price))) return fromPrice(next, prices.get(norm(next.name)));
    if ('buyQty' in patch || 'buyUnit' in patch || 'price' in patch) next.auto = false;
    return next;
  }));

  const rowCost = (r: Row) => {
    if (r.staple) return r.name.trim() ? STAPLE_COST : null;
    const bq = numOr(r.buyQty), pr = numOr(r.price);
    return bq && pr != null ? useCost({ qty: numOr(r.qty), unit: r.unit }, { name: r.name, qty: bq, unit: r.buyUnit, price: pr }) : null;
  };
  const priced = rows.map(rowCost).filter((c): c is number => c !== null);
  const total = priced.reduce((a, c) => a + c, 0);

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const used = rows.filter(r => r.name.trim());
    const ingredients: RecipeIngredient[] = used.map(r => {
      if (r.staple) return { name: r.name.trim() };
      const q = numOr(r.qty);
      return q ? { name: r.name.trim(), qty: q, unit: r.unit } : { name: r.name.trim() };
    });
    const newPrices: Price[] = used.filter(r => !r.staple).flatMap(r => {
      const bq = numOr(r.buyQty), pr = numOr(r.price);
      return bq && pr != null && !isNaN(pr) ? [{ name: r.name.trim(), qty: bq, unit: r.buyUnit, price: pr }] : [];
    });
    const out: Recipe = { id: recipe?.id ?? uid(), name: n, ingredients };
    if (safeLink(link)) out.link = safeLink(link);
    if (method.trim()) out.method = method;
    if (!priced.length && recipe?.cost) out.cost = recipe.cost;

    update(x => {
      const i = x.recipes.findIndex(z => z.id === out.id);
      if (i >= 0) x.recipes[i] = out; else x.recipes.push(out);
      // Staple status is shared: marking or unmarking it here applies to every recipe.
      const staples = x.staples.filter(n => !used.some(r => !r.staple && norm(r.name) === norm(n)));
      for (const r of used) if (r.staple && !staples.some(n => norm(n) === norm(r.name))) staples.push(r.name.trim());
      x.staples = staples;
      for (const p of newPrices) {
        const j = x.prices.findIndex(z => norm(z.name) === norm(p.name));
        if (j >= 0) x.prices[j] = p; else x.prices.push(p);
      }
    });
    onDone();
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #23221F', borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>{recipe ? 'Edit recipe' : 'New recipe'}</div>
      <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Recipe name" />
      <input className="field" value={link} onChange={e => setLink(e.target.value)} placeholder="Link to recipe (optional)" inputMode="url" autoCapitalize="off" />

      <div className="eyebrow" style={{ fontSize: 11, marginTop: 6 }}>Ingredients</div>
      <datalist id="known-ingredients">{known.map(k => <option key={k} value={k} />)}</datalist>
      {rows.map(r => {
        const c = rowCost(r);
        const mismatch = !r.staple && c === null && !!numOr(r.qty) && !!numOr(r.buyQty) && numOr(r.price) != null;
        return (
          <div key={r.key} className="ing-row">
            <input className="field-sm ing-name" list="known-ingredients" value={r.name} placeholder="Ingredient" onChange={e => setRow(r.key, { name: e.target.value })} />
            {r.staple ? (
              <span className="ing-group"><span className="ing-label">Staple — no need to measure</span></span>
            ) : (<>
            <span className="ing-group">
              <span className="ing-label">Uses</span>
              <input className="field-sm ing-num" inputMode="decimal" value={r.qty} placeholder="qty" aria-label="Amount used" onChange={e => setRow(r.key, { qty: e.target.value })} />
              <UnitSelect value={r.unit} onChange={u => setRow(r.key, { unit: u })} />
            </span>
            <span className="ing-group">
              <span className="ing-label">Buy</span>
              <input className="field-sm ing-num" inputMode="decimal" value={r.buyQty} placeholder="qty" aria-label="Amount you buy" onChange={e => setRow(r.key, { buyQty: e.target.value })} />
              <UnitSelect value={r.buyUnit} onChange={u => setRow(r.key, { buyUnit: u })} />
              <span className="ing-label">for $</span>
              <input className="field-sm ing-num" inputMode="decimal" value={r.price} placeholder="0.00" aria-label="Price" onChange={e => setRow(r.key, { price: e.target.value })} />
            </span>
            </>)}
            <button className={'pill-sm ing-staple' + (r.staple ? ' dark' : '')} aria-pressed={r.staple} onClick={() => setRow(r.key, { staple: !r.staple })}>Staple</button>
            <span className="ing-cost" title={mismatch ? 'Units don’t match (e.g. g vs ml)' : undefined}>{c !== null ? money(c) : mismatch ? 'units?' : '—'}</span>
            <button className="x-btn" aria-label="Remove ingredient" onClick={() => setRows(rs => (rs.length > 1 ? rs.filter(z => z.key !== r.key) : [blankRow()]))}>×</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button className="pill-sm" onClick={() => setRows(rs => [...rs, blankRow()])}>+ Add ingredient</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {priced.length ? 'Meal cost ' + money(total) + ' · ' + money(total / 2) + ' each' : recipe?.cost ? 'Meal cost ' + money(recipe.cost) + ' (add prices to work it out)' : 'Add prices to work out the cost'}
        </span>
      </div>
      <p className="note" style={{ margin: 0 }}>Buy amounts, prices and staples are shared: set them once and every recipe using that ingredient updates. Staples (salt, pepper, spices) add a nominal {money(STAPLE_COST)} each.</p>

      <textarea value={method} onChange={e => setMethod(e.target.value)} placeholder="Write the recipe yourself (optional)" rows={6}
        style={{ padding: '10px 12px', border: '1px solid #DDD8CC', borderRadius: 10, background: '#fff', fontSize: 14, resize: 'vertical', marginTop: 6 }} />
      <div className="row8">
        <button className="pill dark" style={{ padding: '0 18px' }} onClick={save}>Save recipe</button>
        <button className="pill plain" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
