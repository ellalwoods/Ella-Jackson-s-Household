import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { HouseholdData, Meal, MEAL_LABEL, MEALS, money, norm, STATE_COLORS } from '../lib/model';
import { bucketAverage, fmtQty, ingredientCost, isStocked, costContext, recipeCost, searchRecipes } from '../lib/food';
import type { Update } from '../Household';
import RecipeEditor, { safeLink } from './RecipeEditor';

export default function RecipesPage({ D, update, mon }: { D: HouseholdData; update: Update; mon: Date }) {
  const [q, setQ] = useState('');
  /** null = closed, 'new' = adding a recipe, 'bucket:new' = adding a bucket, 'bucket:<id>' or a recipe id = editing. */
  const [editing, setEditing] = useState<string | null>(null);
  const [openMethod, setOpenMethod] = useState<Record<string, boolean>>({});
  const [mealFilter, setMealFilter] = useState<Meal | 'all'>('all');

  const pantry = new Map(D.pantry.map(c => [norm(c.name), c]));
  const prices = costContext(D);
  const weekKeys = DOW.map((_, i) => key(addDays(mon, i)));
  const recipes = searchRecipes(D.recipes, q).filter(r => mealFilter === 'all' || r.meals.includes(mealFilter)).sort((a, b) => a.name.localeCompare(b.name));
  const editingBucket = editing?.startsWith('bucket:');
  const editingRecipe = editing && editing !== 'new' && !editingBucket ? D.recipes.find(r => r.id === editing) ?? null : null;
  const bucketBeingEdited = editingBucket ? D.buckets.find(b => 'bucket:' + b.id === editing) ?? null : null;
  const removeBucket = (id: string) => update(x => {
    x.buckets = x.buckets.filter(b => b.id !== id);
    for (const r of x.recipes) if (r.buckets) { r.buckets = r.buckets.filter(u => u.bucket !== id); if (!r.buckets.length) delete r.buckets; }
    for (const k of Object.keys(x.picks)) { delete x.picks[k][id]; if (!Object.keys(x.picks[k]).length) delete x.picks[k]; }
  });

  const edit = (id: string) => { setEditing(id); try { window.scrollTo(0, 0); } catch { /* not available */ } };
  const remove = (id: string) => update(x => {
    x.recipes = x.recipes.filter(z => z.id !== id);
    Object.keys(x.plan).forEach(k => {
      const p = x.plan[k];
      for (const m of MEALS) if (p[m] === id) delete p[m];
      if (!Object.keys(p).length) delete x.plan[k];
    });
  });

  return (
    <>
      <div className="row8" style={{ marginBottom: 14 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or ingredient" />
        {editing ? <button className="pill dark" style={{ height: 44, padding: '0 18px' }} onClick={() => setEditing(null)}>Close</button> : (<>
          <button className="pill dark" style={{ height: 44, padding: '0 18px' }} onClick={() => setEditing('new')}>+ New recipe</button>
          <button className="pill plain" style={{ height: 44, padding: '0 18px' }} onClick={() => setEditing('bucket:new')}>+ Add bucket</button>
        </>)}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        {(['all', ...MEALS] as const).map(m => {
          const on = mealFilter === m;
          const cnt = m === 'all' ? D.recipes.length : D.recipes.filter(r => r.meals.includes(m)).length;
          return (
            <button key={m} className="filter" onClick={() => setMealFilter(m)}
              style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>
              {m === 'all' ? 'All' : MEAL_LABEL[m]} · {cnt}
            </button>
          );
        })}
      </div>
      {editing && <RecipeEditor key={editing} D={D} update={update} recipe={editingRecipe} kind={editingBucket ? 'bucket' : 'recipe'} bucket={bucketBeingEdited} onDone={() => setEditing(null)} />}
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }}>
        {recipes.map(r => {
          const planned = weekKeys.flatMap((k, i) => MEALS.filter(m => D.plan[k]?.[m] === r.id).map(m => DOW[i] + ' ' + MEAL_LABEL[m].toLowerCase()));
          const link = safeLink(r.link);
          const showMethod = !!openMethod[r.id];
          return (
            <div key={r.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 13 }} className="muted">{money(recipeCost(r, prices))} · {planned.length ? 'On ' + planned.join(', ') : 'Not this week'}</div>
                  {r.meals.length > 0 && <div className="note" style={{ marginTop: 2 }}>{r.meals.map(m => MEAL_LABEL[m]).join(' · ')}</div>}
                </div>
                <span style={{ display: 'flex', gap: 10 }}>
                  <button className="link-btn" onClick={() => edit(r.id)}>Edit</button>
                  <button className="link-btn" onClick={() => remove(r.id)}>Remove</button>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {r.ingredients.map((g, i) => {
                  const c = pantry.get(norm(g.name));
                  const dot = !c ? '#BFB8AA' : isStocked(c) ? STATE_COLORS.Full : STATE_COLORS.Replace;
                  return (
                    <span key={i} className="ing-tag">
                      <span className="dot6" style={{ background: dot }} />{g.name}
                      {prices.staples.has(norm(g.name)) ? <span className="muted">· staple</span> : g.qty && g.unit ? <span className="muted">· {fmtQty(g.qty, g.unit)}</span> : null}
                    </span>
                  );
                })}
                {(r.buckets ?? []).map(u => {
                  const b = D.buckets.find(z => z.id === u.bucket);
                  return b ? <span key={u.bucket} className="ing-tag bucket-tag">🪣 {b.name}<span className="muted">· pick {u.count}</span></span> : null;
                })}
                {!r.ingredients.length && !r.buckets?.length && <span className="note">No ingredients yet — tap Edit to add them.</span>}
              </div>
              {(link || r.method) && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                  {link && <a href={link} target="_blank" rel="noopener noreferrer">Open recipe ↗</a>}
                  {r.method && (
                    <button className="link-btn" style={{ fontSize: 13 }} onClick={() => setOpenMethod(m => ({ ...m, [r.id]: !m[r.id] }))}>
                      {showMethod ? 'Hide method' : 'Show method'}
                    </button>
                  )}
                </div>
              )}
              {showMethod && r.method && <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', borderTop: '1px solid #F0ECE4', paddingTop: 10 }}>{r.method}</div>}
            </div>
          );
        })}
      </div>
      {!recipes.length && <p className="empty">{q ? <>No recipes match “{q}”.</> : 'No recipes here yet.'}</p>}

      <div className="note" style={{ marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span className="legend" style={{ gap: 5 }}><span className="dot6" style={{ background: STATE_COLORS.Full }} />In stock</span>
        <span className="legend" style={{ gap: 5 }}><span className="dot6" style={{ background: STATE_COLORS.Replace }} />Low / replace</span>
        <span className="legend" style={{ gap: 5 }}><span className="dot6" style={{ background: '#BFB8AA' }} />Not stocked</span>
      </div>
      <div className="bucket-head">
        <div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>Buckets</div>
          <div className="note">Groups of interchangeable items, like Vegetables. Recipes use a number of them, picked when you plan the meal.</div>
        </div>
        {!editing && <button className="pill plain" onClick={() => edit('bucket:new')}>+ Add bucket</button>}
      </div>
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }}>
        {D.buckets.slice().sort((a, b) => a.name.localeCompare(b.name)).map(b => {
          const usedBy = D.recipes.filter(r => r.buckets?.some(u => u.bucket === b.id)).length;
          return (
            <div key={b.id} className="card bucket-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>🪣 {b.name}</div>
                  <div style={{ fontSize: 13 }} className="muted">
                    {b.items.length} item{b.items.length === 1 ? '' : 's'} · avg {money(bucketAverage(b, prices))} each{usedBy ? ' · in ' + usedBy + ' recipe' + (usedBy > 1 ? 's' : '') : ''}
                  </div>
                </div>
                <span style={{ display: 'flex', gap: 10 }}>
                  <button className="link-btn" onClick={() => edit('bucket:' + b.id)}>Edit</button>
                  <button className="link-btn" onClick={() => removeBucket(b.id)}>Remove</button>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {b.items.map((g, i) => {
                  const c = ingredientCost(g, prices);
                  return <span key={i} className="ing-tag">{g.name}{c !== null ? <span className="muted">· {money(c)}</span> : g.qty && g.unit ? <span className="muted">· {fmtQty(g.qty, g.unit)}</span> : null}</span>;
                })}
                {!b.items.length && <span className="note">Empty — tap Edit to add items.</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!D.buckets.length && <p className="note" style={{ margin: '4px 0 0' }}>No buckets yet.</p>}
    </>
  );
}
