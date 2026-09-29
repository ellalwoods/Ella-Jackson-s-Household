import { useState } from 'react';
import { Bucket, BucketItem, BucketUse, HouseholdData, Meal, MEAL_LABEL, MEALS, miniRecipes, money, norm, Price, Recipe, RecipeIngredient, STAPLE_COST, uid, Unit } from '../lib/model';
import { bucketAverage, costContext, itemCost, priceMap, stapleSet, useCost } from '../lib/food';
import type { Update } from '../Household';
import { UnitSelect } from './PantryPage';
import { confirmRemove } from './confirm';

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
  /** Bucket items only: the mini recipe this item is. */
  recipe?: string;
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

/**
 * Edits a recipe, a mini recipe (used inside buckets), or (with `bucket`) a
 * bucket of interchangeable items, which uses the same ingredient rows.
 */
interface Props { D: HouseholdData; update: Update; recipe: Recipe | null; bucket?: Bucket | null; kind?: 'recipe' | 'bucket' | 'mini'; onDone: () => void }

export default function RecipeEditor({ D, update, recipe, bucket = null, kind = 'recipe', onDone }: Props) {
  const isBucket = kind === 'bucket', isMini = kind === 'mini';
  const minis = miniRecipes(D);
  const prices = priceMap(D), staples = stapleSet(D), ctx = costContext(D);
  const [name, setName] = useState((isBucket ? bucket?.name : recipe?.name) ?? '');
  const [uses, setUses] = useState<BucketUse[]>(recipe?.buckets ?? []);
  const [choosing, setChoosing] = useState(false);
  const [perMeal, setPerMeal] = useState(bucket?.perMeal ?? 1);
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
    const rs = ((isBucket ? bucket?.items : recipe?.ingredients) ?? []).map(g => fromPrice({ ...blankRow(), name: g.name, qty: g.qty != null ? String(g.qty) : '', unit: g.unit ?? 'g', staple: staples.has(norm(g.name)), tags: (g as BucketItem).tags ?? [], recipe: (g as BucketItem).recipe }, prices.get(norm(g.name))));
    return rs.length ? rs : [blankRow()];
  });

  const knownMinis = isBucket ? minis.map(r => r.name).sort() : [];
  const known = Array.from(new Set([...D.prices.map(p => p.name), ...D.pantry.map(p => p.name), ...D.recipes.flatMap(r => r.ingredients.map(g => g.name))])).sort();

  const setRow = (k: string, patch: Partial<Row>) => setRows(rs => rs.map(r => {
    if (r.key !== k) return r;
    const next = { ...r, ...patch };
    // In a bucket, typing a mini recipe's name makes the item that mini recipe.
    if ('name' in patch && isBucket) next.recipe = minis.find(m => norm(m.name) === norm(next.name))?.id;
    if (next.recipe) return next;
    if ('name' in patch && staples.has(norm(next.name))) next.staple = true;
    if ('name' in patch && (r.auto || (!r.buyQty && !r.price))) return fromPrice(next, prices.get(norm(next.name)));
    if ('buyQty' in patch || 'buyUnit' in patch || 'price' in patch) next.auto = false;
    return next;
  }));

  const rowCost = (r: Row) => {
    if (r.recipe) return itemCost({ name: r.name, recipe: r.recipe }, ctx);
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
      if (r.staple || r.recipe) return { name: r.name.trim() };
      const q = numOr(r.qty);
      return q ? { name: r.name.trim(), qty: q, unit: r.unit } : { name: r.name.trim() };
    });
    const newPrices: Price[] = used.filter(r => !r.recipe).flatMap(r => {
      const bq = numOr(r.buyQty), pr = numOr(r.price);
      if (pr == null || isNaN(pr)) return [];
      // A staple only needs its purchase price; keep any pack size already known.
      if (r.staple) {
        const had = prices.get(norm(r.name));
        return [{ name: r.name.trim(), qty: had?.qty ?? 1, unit: had?.unit ?? 'each', price: pr }];
      }
      return bq ? [{ name: r.name.trim(), qty: bq, unit: r.buyUnit, price: pr }] : [];
    });
    const out: Recipe = { id: recipe?.id ?? uid(), name: n, meals: isMini ? [] : MEALS.filter(m => meals.includes(m)), ingredients };
    if (isMini) out.mini = true;
    const keptUses = uses.filter(u => u.count > 0);
    if (keptUses.length) out.buckets = keptUses;
    if (safeLink(link)) out.link = safeLink(link);
    if (method.trim()) out.method = method;
    if (!priced.length && !keptUses.length && recipe?.cost) out.cost = recipe.cost;
    if (tags.length) out.tags = tags;
    const items: BucketItem[] = ingredients.map((g, i) => {
      const t = used[i].tags.filter(x => bucketTags.some(b => norm(b) === norm(x)));
      const item: BucketItem = used[i].recipe ? { ...g, recipe: used[i].recipe } : g;
      return t.length ? { ...item, tags: t } : item;
    });
    const outBucket: Bucket = { id: bucket?.id ?? uid(), name: n, items, perMeal: Math.max(1, perMeal) };
    if (bucketTags.length) outBucket.tags = bucketTags;

    update(x => {
      if (isBucket) {
        const i = x.buckets.findIndex(z => z.id === outBucket.id);
        if (i >= 0) x.buckets[i] = outBucket; else x.buckets.push(outBucket);
      } else {
        const i = x.recipes.findIndex(z => z.id === out.id);
        if (i >= 0) x.recipes[i] = out; else x.recipes.push(out);
        // A renamed mini recipe keeps its place in buckets and in picks already made.
        if (isMini && recipe && norm(recipe.name) !== norm(n)) {
          for (const b of x.buckets) for (const g of b.items) if (g.recipe === out.id) g.name = n;
          for (const slot of Object.values(x.picks)) for (const k of Object.keys(slot)) slot[k] = slot[k].map(p => (norm(p) === norm(recipe.name) ? n : p));
        }
        for (const t of tags) if (!x.recipeTags.some(z => norm(z) === norm(t))) x.recipeTags.push(t);
      }
      // Staple status is shared: marking or unmarking it here applies to every recipe.
      const plain = used.filter(r => !r.recipe);
      const staples = x.staples.filter(n => !plain.some(r => !r.staple && norm(r.name) === norm(n)));
      for (const r of plain) if (r.staple && !staples.some(n => norm(n) === norm(r.name))) staples.push(r.name.trim());
      x.staples = staples;
      for (const p of newPrices) {
        const j = x.prices.findIndex(z => norm(z.name) === norm(p.name));
        if (j >= 0) x.prices[j] = p; else x.prices.push(p);
      }
    });
    onDone();
  };

  const renameTag = (from: string, to: string) => {
    const t = to.trim();
    if (!t || norm(t) === norm(from)) return;
    const swap = (ts: string[]) => ts.map(x => (norm(x) === norm(from) ? t : x));
    if (isBucket) {
      setBucketTags(swap);
      setRows(rs => rs.map(r => ({ ...r, tags: swap(r.tags) })));
    } else {
      // Recipe tags are shared, so a rename applies to every recipe.
      setTags(swap);
      update(x => {
        x.recipeTags = swap(x.recipeTags).filter((z, i, a) => a.findIndex(y => norm(y) === norm(z)) === i);
        for (const r of x.recipes) if (r.tags) r.tags = swap(r.tags);
      });
    }
  };
  const deleteTag = (t: string) => {
    const drop = (ts: string[]) => ts.filter(x => norm(x) !== norm(t));
    if (isBucket) {
      setBucketTags(drop);
      setRows(rs => rs.map(r => ({ ...r, tags: drop(r.tags) })));
      return;
    }
    if (!confirmRemove('the “' + t + '” tag from every recipe')) return;
    setTags(drop);
    update(x => {
      x.recipeTags = drop(x.recipeTags);
      for (const r of x.recipes) if (r.tags) { r.tags = drop(r.tags); if (!r.tags.length) delete r.tags; }
    });
  };

  const summary = isBucket ? (priced.length ? 'Average ' + money(average) + ' per item' : 'Add prices to work out the average')
    : isMini ? (priced.length ? 'Costs ' + money(total) + ' per batch' : 'Add prices to work out the cost')
    : (priced.length || uses.length) ? 'Meal cost ' + money(total) + ' · ' + money(total / 2) + ' each'
    : recipe?.cost ? 'Meal cost ' + money(recipe.cost) + ' (add prices to work it out)' : 'Add prices to work out the cost';
  const thing = isBucket ? 'bucket' : isMini ? 'mini recipe' : 'recipe';

  // Each part of the form is its own numbered step, so it's clear what's asked for.
  const steps: { title: string; optional?: boolean; hint?: string; body: React.ReactNode }[] = [];
  steps.push({
    title: 'Name',
    hint: isBucket ? 'Interchangeable items, like Vegetables.' : isMini ? 'A garnish, sauce or dressing, used in buckets.' : undefined,
    body: <input className="field-sm compact" value={name} onChange={e => setName(e.target.value)} aria-label="Name"
      placeholder={isBucket ? 'e.g. Vegetables' : isMini ? 'e.g. Salsa verde' : 'e.g. Spaghetti bolognese'} />,
  });
  if (isBucket) steps.push({
    title: 'Per meal',
    hint: 'Items one meal uses. Recipes can change it.',
    body: (
      <div className="stepper-panel">
        <span className="field-label" style={{ fontSize: 14 }}>Items per meal</span>
        <Stepper value={perMeal} min={1} onChange={setPerMeal} label="Items per meal" />
      </div>
    ),
  });
  if (!isMini) steps.push({
    title: 'Tags', optional: true,
    hint: isBucket ? 'Group items, e.g. Greens.' : 'Which meal it’s for, plus your own tags.',
    body: (<>
      {!isBucket && (
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="field-label" style={{ width: 40 }}>For</span>
          {MEALS.map(m => {
            const on = meals.includes(m);
            return (
              <button key={m} className="filter" aria-pressed={on} onClick={() => setMeals(on ? meals.filter(z => z !== m) : [...meals, m])}
                style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{MEAL_LABEL[m]}</button>
            );
          })}
        </div>
      )}
      <TagRow label={isBucket ? '' : 'Tags'} tags={isBucket ? bucketTags : allRecipeTags} selected={isBucket ? bucketTags : tags} selectable={!isBucket}
        onToggle={t => setTags(ts => ts.some(x => norm(x) === norm(t)) ? ts.filter(x => norm(x) !== norm(t)) : [...ts, t])}
        onRename={renameTag} onDelete={deleteTag}
        value={newTag} onValue={setNewTag} onAdd={addTag} placeholder={isBucket ? '+ New tag, e.g. Greens' : '+ New tag, e.g. Quick'} />
    </>),
  });
  steps.push({
    title: isBucket ? 'Items' : 'Ingredients',
    hint: 'What it uses and what you pay. Staples cost ' + money(STAPLE_COST) + '.' + (isBucket ? ' Type a mini recipe’s name to add it.' : (!isMini ? ' Buckets are picked when you plan the meal.' : '')),
    body: (<>
      <datalist id="known-ingredients">{[...knownMinis, ...known.filter(k => !knownMinis.includes(k))].map(k => <option key={k} value={k} />)}</datalist>
      <div>
        {rows.map(r => {
          const c = rowCost(r);
          const mismatch = !r.staple && c === null && !!numOr(r.qty) && !!numOr(r.buyQty) && numOr(r.price) != null;
          return (
            <div key={r.key} className="ing-row">
              <input className="field-sm compact ing-name" list="known-ingredients" value={r.name} placeholder={isBucket ? 'Item, e.g. Broccoli' : 'Ingredient'} aria-label={isBucket ? 'Item' : 'Ingredient'} onChange={e => setRow(r.key, { name: e.target.value })} />
              {r.recipe ? (
                <span className="ing-group">
                  <span className="mini-tag dense on">Mini recipe</span>
                  <span className="ing-label">{(() => { const m = minis.find(z => z.id === r.recipe); return m ? m.ingredients.map(g => g.name).join(', ') || 'no ingredients yet' : ''; })()}</span>
                </span>
              ) : r.staple ? (
                <span className="ing-group">
                  <span className="ing-label">Buy for $</span>
                  <input className={'field-sm compact ing-num' + (r.name.trim() && !r.price.trim() ? ' needs' : '')} inputMode="decimal" value={r.price} placeholder="0.00"
                    aria-label={'Purchase price of ' + (r.name || 'staple')} onChange={e => setRow(r.key, { price: e.target.value })} />
                  <span className="ing-label">{r.name.trim() && !r.price.trim() ? 'add the price you pay' : 'staple · ' + money(STAPLE_COST) + ' a meal'}</span>
                </span>
              ) : (<>
                <span className="ing-group">
                  <span className="ing-label">Uses</span>
                  <input className="field-sm compact ing-num" inputMode="decimal" value={r.qty} placeholder="qty" aria-label="Amount used" onChange={e => setRow(r.key, { qty: e.target.value })} />
                  <UnitSelect value={r.unit} onChange={u => setRow(r.key, { unit: u })} compact />
                </span>
                <span className="ing-group">
                  <span className="ing-label">Buy</span>
                  <input className="field-sm compact ing-num" inputMode="decimal" value={r.buyQty} placeholder="qty" aria-label="Amount you buy" onChange={e => setRow(r.key, { buyQty: e.target.value })} />
                  <UnitSelect value={r.buyUnit} onChange={u => setRow(r.key, { buyUnit: u })} compact />
                  <span className="ing-label">for $</span>
                  <input className="field-sm compact ing-num" inputMode="decimal" value={r.price} placeholder="0.00" aria-label="Price" onChange={e => setRow(r.key, { price: e.target.value })} />
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
              {!r.recipe && <button className={'pill-sm ing-staple' + (r.staple ? ' dark' : '')} aria-pressed={r.staple} onClick={() => setRow(r.key, { staple: !r.staple })}>Staple</button>}
              <span className="ing-cost" title={mismatch ? 'Units don’t match (e.g. g vs ml)' : undefined}>{c !== null ? money(c) : mismatch ? 'units?' : ''}</span>
              <button className="x-btn" aria-label="Remove ingredient" onClick={() => setRows(rs => (rs.length > 1 ? rs.filter(z => z.key !== r.key) : [blankRow()]))}>×</button>
            </div>
          );
        })}
      </div>
      {!isBucket && !isMini && uses.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {uses.map(u => {
        const b = D.buckets.find(z => z.id === u.bucket), avg = bucketAverage(b, ctx);
        return (
          <div key={u.bucket} className="stepper-panel">
            <span className="bucket-name" style={{ minHeight: 0, flex: '1 1 140px' }}>🪣 {b?.name ?? 'Missing bucket'}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="field-label">Picks</span>
              <Stepper value={u.count} min={1} small label={'Items from ' + (b?.name ?? 'bucket')}
                onChange={c => setUses(us => us.map(z => (z.bucket === u.bucket ? { ...z, count: c } : z)))} />
            </span>
            <span className="note">{avg ? 'avg ' + money(avg) + ' each' : 'no prices yet'}</span>
            <span className="ing-cost">{money(u.count * avg)}</span>
            <button className="x-btn" aria-label={'Remove ' + (b?.name ?? 'bucket')} onClick={() => setUses(us => us.filter(z => z.bucket !== u.bucket))}>×</button>
          </div>
        );
      })}
      </div>}
      {!isBucket && !isMini && choosing && (
        <div className="row" style={{ alignItems: 'center' }}>
          {D.buckets.filter(b => !uses.some(u => u.bucket === b.id)).map(b => (
            <button key={b.id} className="filter" onClick={() => { setUses(us => [...us, { bucket: b.id, count: b.perMeal ?? 1 }]); setChoosing(false); }}>
              🪣 {b.name} · {b.items.length}
            </button>
          ))}
          {!D.buckets.length && <span className="note">No buckets yet. Add one on the Recipes page first (e.g. Vegetables).</span>}
          {D.buckets.length > 0 && D.buckets.every(b => uses.some(u => u.bucket === b.id)) && <span className="note">All your buckets are already in this recipe.</span>}
          <button className="link-btn" onClick={() => setChoosing(false)}>Cancel</button>
        </div>
      )}

      <div className="row8">
        <button className="pill-sm" onClick={() => setRows(rs => [...rs, blankRow()])}>{isBucket ? '+ Add item' : '+ Add ingredient'}</button>
        {!isBucket && !isMini && !choosing && <button className="pill-sm" onClick={() => setChoosing(true)}>+ Add bucket</button>}
      </div>
    </>),
  });
  if (!isBucket) steps.push({
    title: 'Instructions', optional: true,
    body: (<>
      <textarea value={method} onChange={e => setMethod(e.target.value)} placeholder="Steps to make it" rows={5} className="textarea" aria-label="Instructions" />
      <input className="field-sm compact" value={link} onChange={e => setLink(e.target.value)} placeholder="Link, e.g. www.recipetineats.com/…" aria-label="Link to recipe" inputMode="url" autoCapitalize="off" />
    </>),
  });

  return (
    <div className="editor">
      <div className="editor-title">{(isBucket ? bucket : recipe) ? 'Edit ' + thing : 'New ' + thing}</div>
      {steps.map((st, i) => (
        <section key={st.title} className="editor-step" style={i === 0 ? { borderTop: 'none', paddingTop: 0 } : undefined}>
          <div className="step-head">
            <span className="step-num" aria-hidden>{i + 1}</span>
            <div>
              <div className="step-title">{st.title}{st.optional && <span className="opt"> · optional</span>}</div>
              {st.hint && <div className="step-hint">{st.hint}</div>}
            </div>
          </div>
          <div className="step-body">{st.body}</div>
        </section>
      ))}
      <div className="editor-foot">
        <span className="row8">
          <button className="pill dark" style={{ padding: '0 18px' }} onClick={save}>Save {thing}</button>
          <button className="pill plain" onClick={onDone}>Cancel</button>
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{summary}</span>
      </div>
    </div>
  );
}

/** A whole number set with − and + buttons. */
function Stepper({ value, min = 0, onChange, label, small = false }: { value: number; min?: number; onChange: (n: number) => void; label: string; small?: boolean }) {
  return (
    <span className={'stepper' + (small ? ' small' : '')} role="group" aria-label={label}>
      <button aria-label={'Fewer: ' + label} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output aria-live="polite">{value}</output>
      <button aria-label={'More: ' + label} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

/**
 * Tag chips plus a box to add a new one. Recipe tags toggle on and off for the
 * recipe; "Edit tags" lets you rename or remove any tag.
 */
function TagRow({ label, tags, selected, selectable, onToggle, onRename, onDelete, value, onValue, onAdd, placeholder }: {
  label: string; tags: string[]; selected: string[]; selectable: boolean; onToggle: (t: string) => void;
  onRename: (from: string, to: string) => void; onDelete: (t: string) => void;
  value: string; onValue: (v: string) => void; onAdd: () => void; placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="row" style={{ alignItems: 'center' }}>
      {label && <span className="field-label" style={{ width: 40 }}>{label}</span>}
      {editing ? tags.map(t => <TagEdit key={t} tag={t} onRename={n => onRename(t, n)} onDelete={() => onDelete(t)} />)
        : tags.map(t => {
          const on = selected.some(x => norm(x) === norm(t));
          return selectable
            ? <button key={t} className={'mini-tag' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onToggle(t)}>{t}</button>
            : <span key={t} className="mini-tag on">{t}</span>;
        })}
      {!editing && <>
        <input className="field-sm compact" style={{ width: 170 }} value={value} placeholder={placeholder} aria-label="New tag"
          onChange={e => onValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }} />
        {value.trim() && <button className="pill-sm" onClick={onAdd}>Add</button>}
      </>}
      {tags.length > 0 && <button className="link-btn" style={{ marginLeft: 4 }} onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Edit tags'}</button>}
    </div>
  );
}

/** One tag in edit mode: rename it in place, or × to remove it. */
function TagEdit({ tag, onRename, onDelete }: { tag: string; onRename: (n: string) => void; onDelete: () => void }) {
  const [text, setText] = useState(tag);
  const commit = () => { if (text.trim() && text.trim() !== tag) onRename(text); else setText(tag); };
  return (
    <span className="tag-edit">
      <input className="field-sm compact" value={text} aria-label={'Rename ' + tag} onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
      <button className="x-btn" aria-label={'Remove tag ' + tag} title="Remove tag" onClick={onDelete}>×</button>
    </span>
  );
}
