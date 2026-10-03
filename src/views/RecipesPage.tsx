import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { HouseholdData, Meal, MEAL_LABEL, mealRecipes, MEALS, miniRecipes, money, norm, Recipe, STATE_COLORS } from '../lib/model';
import { bucketAverage, fmtQty, isStocked, itemCost, costContext, miniCost, miniOf, recipeCost, searchRecipes } from '../lib/food';
import type { Update } from '../Household';
import RecipeEditor, { safeLink } from './RecipeEditor';
import { confirmRemove } from './confirm';
import TagFilter from './TagFilter';

export default function RecipesPage({ D, update, mon }: { D: HouseholdData; update: Update; mon: Date }) {
  const [q, setQ] = useState('');
  /** null = closed, 'new' / 'mini:new' / 'bucket:new' = adding, 'bucket:<id>' or a recipe id = editing. */
  const [editing, setEditing] = useState<string | null>(null);
  const [openMethod, setOpenMethod] = useState<Record<string, boolean>>({});
  const [mealFilter, setMealFilter] = useState<Meal | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');
  /** Tag filter per bucket card ('' = all). */
  const [bucketTag, setBucketTag] = useState<Record<string, string>>({});

  const pantry = new Map(D.pantry.map(c => [norm(c.name), c]));
  const prices = costContext(D);
  const weekKeys = DOW.map((_, i) => key(addDays(mon, i)));
  const mains = mealRecipes(D);
  const minis = searchRecipes(miniRecipes(D), q).sort((a, b) => a.name.localeCompare(b.name));
  const recipes = searchRecipes(mains, q).filter(r => mealFilter === 'all' || r.meals.includes(mealFilter))
    .filter(r => !tagFilter || (r.tags ?? []).some(x => norm(x) === norm(tagFilter))).sort((a, b) => a.name.localeCompare(b.name));
  const editingBucket = editing?.startsWith('bucket:');
  const editingRecipe = editing && editing !== 'new' && editing !== 'mini:new' && !editingBucket ? D.recipes.find(r => r.id === editing) ?? null : null;
  const editKind = editingBucket ? 'bucket' : editing === 'mini:new' || editingRecipe?.mini ? 'mini' : 'recipe';
  const bucketBeingEdited = editingBucket ? D.buckets.find(b => 'bucket:' + b.id === editing) ?? null : null;
  const removeBucket = (id: string) => update(x => {
    x.buckets = x.buckets.filter(b => b.id !== id);
    for (const r of x.recipes) if (r.buckets) { r.buckets = r.buckets.filter(u => u.bucket !== id); if (!r.buckets.length) delete r.buckets; }
    for (const k of Object.keys(x.picks)) { delete x.picks[k][id]; if (!Object.keys(x.picks[k]).length) delete x.picks[k]; }
  });

  const edit = (id: string) => { setEditing(id); try { window.scrollTo(0, 0); } catch { /* not available */ } };
  const remove = (id: string) => update(x => {
    x.recipes = x.recipes.filter(z => z.id !== id);
    // A mini recipe also leaves its buckets, and any meals it was picked for.
    for (const b of x.buckets) {
      const gone = b.items.filter(g => g.recipe === id).map(g => norm(g.name));
      if (!gone.length) continue;
      b.items = b.items.filter(g => g.recipe !== id);
      for (const slot of Object.values(x.picks)) if (slot[b.id]) slot[b.id] = slot[b.id].filter(n => !gone.includes(norm(n)));
    }
    Object.keys(x.plan).forEach(k => {
      const p = x.plan[k];
      for (const m of MEALS) if (p[m] === id) delete p[m];
      if (!Object.keys(p).length) delete x.plan[k];
    });
  });

  /** A recipe card: name, a summary line, ingredients, link and method. */
  const card = (r: Recipe, sub: string, cls = '') => {
    const link = safeLink(r.link);
    const showMethod = !!openMethod[r.id];
    return (
      <div key={r.id} className={'card ' + cls} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 13 }} className="muted">{sub}</div>
            {r.meals.length > 0 && <div className="note" style={{ marginTop: 2 }}>{r.meals.map(m => MEAL_LABEL[m]).join(' · ')}</div>}
            {(r.tags ?? []).length > 0 && (
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                {r.tags!.map(t => <button key={t} className={'mini-tag dense' + (norm(tagFilter) === norm(t) ? ' on' : '')} onClick={() => setTagFilter(norm(tagFilter) === norm(t) ? '' : t)}>{t}</button>)}
              </div>
            )}
          </div>
          <span style={{ display: 'flex', gap: 10 }}>
            <button className="link-btn" onClick={() => edit(r.id)}>Edit</button>
            <button className="link-btn" onClick={() => { if (confirmRemove('“' + r.name + '”')) remove(r.id); }}>Remove</button>
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
  };

  return (
    <>
      <div className="row8" style={{ marginBottom: 14 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or ingredient" />
        {editing ? <button className="pill plain lg" onClick={() => setEditing(null)}>Close editor</button> : (<>
          <button className="pill dark lg" onClick={() => setEditing('new')}>+ New recipe</button>
          <button className="pill plain lg" onClick={() => setEditing('bucket:new')}>+ New bucket</button>
          <button className="pill plain lg" onClick={() => setEditing('mini:new')}>+ New mini recipe</button>
        </>)}
      </div>
      {/* Filters: meal as one joined control, your tags as small chips below. */}
      <div className="filter-rows">
        <div className="filter-row">
          <span className="filter-label">Meal</span>
          <div className="seg" role="group" aria-label="Filter by meal">
            {(['all', ...MEALS] as const).map(m => {
              const on = mealFilter === m;
              const cnt = m === 'all' ? mains.length : mains.filter(r => r.meals.includes(m)).length;
              return (
                <button key={m} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setMealFilter(m)}>
                  {m === 'all' ? 'All' : MEAL_LABEL[m]} <span className="seg-count">{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>
        <TagFilter D={D} update={update} kind="recipe" active={tagFilter} onPick={setTagFilter}
          count={t => mains.filter(r => (r.tags ?? []).some(x => norm(x) === norm(t))).length} />
      </div>
      {editing && <RecipeEditor key={editing} D={D} update={update} recipe={editingRecipe} kind={editKind} bucket={bucketBeingEdited} onDone={() => setEditing(null)} />}
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }}>
        {recipes.map(r => {
          const planned = weekKeys.flatMap((k, i) => MEALS.filter(m => D.plan[k]?.[m] === r.id).map(m => DOW[i] + ' ' + MEAL_LABEL[m].toLowerCase()));
          return card(r, money(recipeCost(r, prices)) + ' · ' + (planned.length ? 'On ' + planned.join(', ') : 'Not this week'));
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
          <div className="note">Interchangeable items, like Vegetables, picked when you plan a meal.</div>
        </div>
        {!editing && <button className="pill plain" onClick={() => edit('bucket:new')}>+ New bucket</button>}
      </div>
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }}>
        {D.buckets.slice().sort((a, b) => a.name.localeCompare(b.name)).map(b => {
          const usedBy = mains.filter(r => r.buckets?.some(u => u.bucket === b.id)).length;
          return (
            <div key={b.id} className="card bucket-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>🪣 {b.name}</div>
                  <div style={{ fontSize: 13 }} className="muted">
                    {b.items.length} item{b.items.length === 1 ? '' : 's'} · {b.perMeal ?? 1} per meal · {bucketAverage(b, prices) ? 'avg ' + money(bucketAverage(b, prices)) + ' each' : 'no prices yet'}{usedBy ? ' · in ' + usedBy + ' recipe' + (usedBy > 1 ? 's' : '') : ''}
                  </div>
                </div>
                <span style={{ display: 'flex', gap: 10 }}>
                  <button className="link-btn" onClick={() => edit('bucket:' + b.id)}>Edit</button>
                  <button className="link-btn" onClick={() => { if (confirmRemove('the “' + b.name + '” bucket')) removeBucket(b.id); }}>Remove</button>
                </span>
              </div>
              {(b.tags ?? []).length > 0 && (
                <div className="row" style={{ gap: 4 }}>
                  {['', ...b.tags!].map(t => {
                    const on = (bucketTag[b.id] ?? '') === t;
                    return <button key={t || 'all'} className={'mini-tag dense' + (on ? ' on' : '')} aria-pressed={on}
                      onClick={() => setBucketTag(f => ({ ...f, [b.id]: t }))}>{t || 'All'}</button>;
                  })}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {b.items.filter(g => !bucketTag[b.id] || (g.tags ?? []).some(t => norm(t) === norm(bucketTag[b.id]))).map((g, i) => {
                  const c = itemCost(g, prices);
                  return <span key={i} className={'ing-tag' + (miniOf(g, prices) ? ' mini-item' : '')}>{g.name}{miniOf(g, prices) ? <span className="muted">· mini{c !== null ? ' · ' + money(c) : ''}</span> : prices.staples.has(norm(g.name)) ? <span className="muted">· staple</span> : c !== null ? <span className="muted">· {money(c)}</span> : g.qty && g.unit ? <span className="muted">· {fmtQty(g.qty, g.unit)}</span> : null}</span>;
                })}
                {!b.items.length && <span className="note">Empty — tap Edit to add items.</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!D.buckets.length && <p className="note" style={{ margin: '4px 0 0' }}>No buckets yet.</p>}

      <div className="bucket-head">
        <div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>Mini recipes</div>
          <div className="note">Garnishes, sauces and dressings, used as one item in a bucket.</div>
        </div>
        {!editing && <button className="pill plain" onClick={() => edit('mini:new')}>+ New mini recipe</button>}
      </div>
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }}>
        {minis.map(r => {
          const inBuckets = D.buckets.filter(b => b.items.some(g => g.recipe === r.id)).map(b => b.name);
          const c = miniCost(r, prices);
          return card(r, (c !== null ? money(c) + ' per batch · ' : '') + (inBuckets.length ? 'In ' + inBuckets.join(', ') : 'Not in a bucket yet'), 'mini-card');
        })}
      </div>
      {!minis.length && <p className="note" style={{ margin: '4px 0 0' }}>{q && miniRecipes(D).length ? <>No mini recipes match “{q}”.</> : 'No mini recipes yet.'}</p>}
    </>
  );
}

