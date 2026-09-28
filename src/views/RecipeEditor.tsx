import { useState } from 'react';
import { Bucket, BucketItem, BucketUse, HouseholdData, Meal, MEAL_LABEL, MEALS, money, norm, Price, Recipe, RecipeIngredient, STAPLE_COST, uid, Unit } from '../lib/model';
import { bucketAverage, costContext, priceMap, stapleSet, useCost } from '../lib/food';
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
  /** Bucket items only: this bucket's tags that apply. */
  tags: string[];
}

const blankRow = (): Row => ({ key: uid(), name: '', qty: '', unit: 'g', buyQty: '', buyUnit: 'g', price: '', auto: false, staple: false, tags: [] });
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

/** Edits a recipe, or (with `bucket`) a bucket of interchangeable items, which uses the same ingredient rows. */
interface Props { D: HouseholdData; update: Update; recipe: Recipe | null; bucket?: Bucket | null; kind?: 'recipe' | 'bucket'; onDone: () => void }

export default function RecipeEditor({ D, update, recipe, bucket = null, kind = 'recipe', onDone }: Props) {
  const isBucket = kind === 'bucket';
  const prices = priceMap(D), staples = stapleSet(D), ctx = costContext(D);
  const [name, setName] = useState((isBucket ? bucket?.name : recipe?.name) ?? '');
  const [uses, setUses] = useState<BucketUse[]>(recipe?.buckets ?? []);
  const [choosing, setChoosing] = useState(false);
  const [perMeal, setPerMeal] = useState(String(bucket?.perMeal ?? 1));
  const [bucketTags, setBucketTags] = useState<string[]>(bucket?.tags ?? []);
  const [tags, setTags] = useState<string[]>(recipe?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const allRecipeTags = Array.from(new Set([...D.recipeTags, ...tags])).sort((a, b) => a.localeCompare(b));
  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (isBucket) { if (!bucketTags.some(x => norm(x) === norm(t))) setBucketTags(ts => [...ts, t]); }
    else {
      const existing = allRecipeTags.find(x => norm(x) === norm(t)) ?? t;
      if (!tags.some(x => norm(x) === norm(existing))) setTags(ts => [...ts, existing]);
    }
    setNewTag('');
  };
  const [link, setLink] = useState(recipe?.link ?? '');
  const [method, setMethod] = useState(recipe?.method ?? '');
  const [meals, setMeals] = useState<Meal[]>(recipe?.meals ?? ['dinner']);
  const [rows, setRows] = useState<Row[]>(() => {
    const rs = ((isBucket ? bucket?.items : recipe?.ingredients) ?? []).map(g => fromPrice({ ...blankRow(), name: g.name, qty: g.qty != null ? String(g.qty) : '', unit: g.unit ?? 'g', staple: staples.has(norm(g.name)), tags: (g as BucketItem).tags ?? [] }, prices.get(norm(g.name))));
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
  const bucketTotal = uses.reduce((a, u) => a + u.count * bucketAverage(D.buckets.find(b => b.id === u.bucket), ctx), 0);
  const total = priced.reduce((a, c) => a + c, 0) + bucketTotal;
  const average = priced.length ? priced.reduce((a, c) => a + c, 0) / priced.length : 0;

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const used = rows.filter(r => r.name.trim());
    const ingredients: RecipeIngredient[] = used.map(r => {
      if (r.staple) return { name: r.name.trim() };
      const q = numOr(r.qty);
      return q ? { name: r.name.trim(), qty: q, unit: r.unit } : { name: r.name.trim() };
    });
    const newPrices: Price[] = used.flatMap(r => {
      const bq = numOr(r.buyQty), pr = numOr(r.price);
      if (pr == null || isNaN(pr)) return [];
      // A staple only needs its purchase price; keep any pack size already known.
      if (r.staple) {
        const had = prices.get(norm(r.name));
        return [{ name: r.name.trim(), qty: had?.qty ?? 1, unit: had?.unit ?? 'each', price: pr }];
      }
      return bq ? [{ name: r.name.trim(), qty: bq, unit: r.buyUnit, price: pr }] : [];
    });
    const out: Recipe = { id: recipe?.id ?? uid(), name: n, meals: MEALS.filter(m => meals.includes(m)), ingredients };
    const keptUses = uses.filter(u => u.count > 0);
    if (keptUses.length) out.buckets = keptUses;
    if (safeLink(link)) out.link = safeLink(link);
    if (method.trim()) out.method = method;
    if (!priced.length && !keptUses.length && recipe?.cost) out.cost = recipe.cost;
    if (tags.length) out.tags = tags;
    const items: BucketItem[] = ingredients.map((g, i) => {
      const t = used[i].tags.filter(x => bucketTags.some(b => norm(b) === norm(x)));
      return t.length ? { ...g, tags: t } : g;
    });
    const outBucket: Bucket = { id: bucket?.id ?? uid(), name: n, items, perMeal: Math.max(1, parseInt(perMeal) || 1) };
    if (bucketTags.length) outBucket.tags = bucketTags;

    update(x => {
      if (isBucket) {
        const i = x.buckets.findIndex(z => z.id === outBucket.id);
        if (i >= 0) x.buckets[i] = outBucket; else x.buckets.push(outBucket);
      } else {
        const i = x.recipes.findIndex(z => z.id === out.id);
        if (i >= 0) x.recipes[i] = out; else x.recipes.push(out);
        for (const t of tags) if (!x.recipeTags.some(z => norm(z) === norm(t))) x.recipeTags.push(t);
      }
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
      <div style={{ fontWeight: 600 }}>{isBucket ? (bucket ? 'Edit bucket' : 'New bucket') : recipe ? 'Edit recipe' : 'New recipe'}</div>
      <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder={isBucket ? 'Bucket title, e.g. Vegetables' : 'Recipe name'} />
      {isBucket && <p className="note" style={{ margin: 0 }}>Add the interchangeable items in this bucket and how much of each a meal uses (or mark them Staple, at a nominal {money(STAPLE_COST)}). Recipes use a number of them, picked when you plan the meal.</p>}
      {isBucket && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14 }}>Items per meal</span>
          <input className="field-sm ing-num" inputMode="numeric" value={perMeal} onChange={e => setPerMeal(e.target.value)} aria-label="Items per meal" />
          <span className="note">The usual number; each recipe can change it.</span>
        </label>
      )}
      <TagRow label={isBucket ? 'Tags in this bucket (optional)' : 'Tags'}
        tags={isBucket ? bucketTags : allRecipeTags} selected={isBucket ? bucketTags : tags}
        onToggle={t => isBucket ? setBucketTags(ts => ts.filter(x => x !== t)) : setTags(ts => ts.some(x => norm(x) === norm(t)) ? ts.filter(x => norm(x) !== norm(t)) : [...ts, t])}
        removable={isBucket} value={newTag} onValue={setNewTag} onAdd={addTag} placeholder={isBucket ? '+ Tag, e.g. Greens' : '+ New tag, e.g. Quick'} />
      {!isBucket && <div className="row" style={{ alignItems: 'center' }}>
        <span className="ing-label" style={{ marginRight: 2 }}>For</span>
        {MEALS.map(m => {
          const on = meals.includes(m);
          return (
            <button key={m} className="filter" aria-pressed={on} onClick={() => setMeals(on ? meals.filter(z => z !== m) : [...meals, m])}
              style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{MEAL_LABEL[m]}</button>
          );
        })}
      </div>}
      {!isBucket && <input className="field" value={link} onChange={e => setLink(e.target.value)} placeholder="Link to recipe (optional)" inputMode="url" autoCapitalize="off" />}

      <div className="eyebrow" style={{ fontSize: 11, marginTop: 6 }}>{isBucket ? 'Items in this bucket' : 'Ingredients'}</div>
      <datalist id="known-ingredients">{known.map(k => <option key={k} value={k} />)}</datalist>
      {rows.map(r => {
        const c = rowCost(r);
        const mismatch = !r.staple && c === null && !!numOr(r.qty) && !!numOr(r.buyQty) && numOr(r.price) != null;
        return (
          <div key={r.key} className="ing-row">
            <input className="field-sm ing-name" list="known-ingredients" value={r.name} placeholder={isBucket ? 'Item, e.g. Broccoli' : 'Ingredient'} onChange={e => setRow(r.key, { name: e.target.value })} />
            {r.staple ? (
              <span className="ing-group">
                <span className="ing-label">Staple · buy for $</span>
                <input className={'field-sm ing-num' + (r.name.trim() && !r.price.trim() ? ' needs' : '')} inputMode="decimal" value={r.price} placeholder="0.00"
                  aria-label={'Purchase price of ' + (r.name || 'staple')} onChange={e => setRow(r.key, { price: e.target.value })} />
                <span className="ing-label">{r.name.trim() && !r.price.trim() ? 'add the price you pay' : 'per meal ' + money(STAPLE_COST)}</span>
              </span>
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
            {isBucket && bucketTags.length > 0 && (
              <span className="ing-group row-tags">
                {bucketTags.map(t => {
                  const on = r.tags.some(x => norm(x) === norm(t));
                  return <button key={t} className={'mini-tag' + (on ? ' on' : '')} aria-pressed={on}
                    onClick={() => setRow(r.key, { tags: on ? r.tags.filter(x => norm(x) !== norm(t)) : [...r.tags, t] })}>{t}</button>;
                })}
              </span>
            )}
            <button className={'pill-sm ing-staple' + (r.staple ? ' dark' : '')} aria-pressed={r.staple} onClick={() => setRow(r.key, { staple: !r.staple })}>Staple</button>
            <span className="ing-cost" title={mismatch ? 'Units don’t match (e.g. g vs ml)' : undefined}>{c !== null ? money(c) : mismatch ? 'units?' : '—'}</span>
            <button className="x-btn" aria-label="Remove ingredient" onClick={() => setRows(rs => (rs.length > 1 ? rs.filter(z => z.key !== r.key) : [blankRow()]))}>×</button>
          </div>
        );
      })}
      {!isBucket && (
        <div className="bucket-uses">
          {uses.map(u => {
            const b = D.buckets.find(z => z.id === u.bucket), avg = bucketAverage(b, ctx);
            return (
              <div key={u.bucket} className="ing-row">
                <span className="ing-name bucket-name">🪣 {b?.name ?? 'Missing bucket'}</span>
                <span className="ing-group">
                  <span className="ing-label">Uses</span>
                  <input className="field-sm ing-num" inputMode="numeric" value={String(u.count)} aria-label={'Items from ' + (b?.name ?? 'bucket')}
                    onChange={e => { const c = Math.max(0, parseInt(e.target.value) || 0); setUses(us => us.map(z => (z.bucket === u.bucket ? { ...z, count: c } : z))); }} />
                  <span className="ing-label">items · avg {money(avg)} each</span>
                </span>
                <span className="ing-cost">{money(u.count * avg)}</span>
                <button className="x-btn" aria-label={'Remove ' + (b?.name ?? 'bucket')} onClick={() => setUses(us => us.filter(z => z.bucket !== u.bucket))}>×</button>
              </div>
            );
          })}
          {choosing && (
            <div className="row" style={{ alignItems: 'center', padding: '6px 0' }}>
              {D.buckets.filter(b => !uses.some(u => u.bucket === b.id)).map(b => (
                <button key={b.id} className="filter" onClick={() => { setUses(us => [...us, { bucket: b.id, count: b.perMeal ?? 1 }]); setChoosing(false); }}>
                  🪣 {b.name} · {b.items.length}
                </button>
              ))}
              {!D.buckets.length && <span className="note">No buckets yet. Add one on the Recipes page first (e.g. Vegetables).</span>}
              {D.buckets.length > 0 && D.buckets.every(b => uses.some(u => u.bucket === b.id)) && <span className="note">All your buckets are already in this recipe.</span>}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="row">
          <button className="pill-sm" onClick={() => setRows(rs => [...rs, blankRow()])}>{isBucket ? '+ Add item' : '+ Add ingredient'}</button>
          {!isBucket && <button className="pill-sm" onClick={() => setChoosing(c => !c)}>{choosing ? 'Close buckets' : '+ Add bucket to recipe'}</button>}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {isBucket ? (priced.length ? 'Average ' + money(average) + ' per item' : 'Add prices to work out the average') : (priced.length || uses.length) ? 'Meal cost ' + money(total) + ' · ' + money(total / 2) + ' each' : recipe?.cost ? 'Meal cost ' + money(recipe.cost) + ' (add prices to work it out)' : 'Add prices to work out the cost'}
        </span>
      </div>
      {!isBucket && <p className="note" style={{ margin: 0 }}>Buy amounts, prices and staples are shared: set them once and every recipe using that ingredient updates. Staples (salt, pepper, spices) add a nominal {money(STAPLE_COST)} each.{uses.length > 0 && ' Buckets count at their average item cost until you pick items for a planned meal.'}</p>}

      {!isBucket && <textarea value={method} onChange={e => setMethod(e.target.value)} placeholder="Write the recipe yourself (optional)" rows={6}
        style={{ padding: '10px 12px', border: '1px solid #DDD8CC', borderRadius: 10, background: '#fff', fontSize: 14, resize: 'vertical', marginTop: 6 }} />}
      <div className="row8">
        <button className="pill dark" style={{ padding: '0 18px' }} onClick={save}>{isBucket ? 'Save bucket' : 'Save recipe'}</button>
        <button className="pill plain" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

/** Tag chips (tap to toggle, or × to remove in a bucket) plus a box to add a new one. */
function TagRow({ label, tags, selected, onToggle, removable, value, onValue, onAdd, placeholder }: {
  label: string; tags: string[]; selected: string[]; onToggle: (t: string) => void; removable: boolean;
  value: string; onValue: (v: string) => void; onAdd: () => void; placeholder: string;
}) {
  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <span className="ing-label" style={{ marginRight: 2 }}>{label}</span>
      {tags.map(t => {
        const on = selected.some(x => norm(x) === norm(t));
        return removable
          ? <span key={t} className="mini-tag on">{t}<button className="mini-tag-x" aria-label={'Remove tag ' + t} onClick={() => onToggle(t)}>×</button></span>
          : <button key={t} className={'mini-tag' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onToggle(t)}>{t}</button>;
      })}
      <input className="field-sm" style={{ height: 30, width: 150, fontSize: 13 }} value={value} placeholder={placeholder} aria-label="New tag"
        onChange={e => onValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }} />
      {value.trim() && <button className="pill-sm" style={{ height: 30 }} onClick={onAdd}>Add</button>}
    </div>
  );
}
