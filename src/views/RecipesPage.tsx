import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { Bucket, HouseholdData, Meal, MEAL_LABEL, mealRecipes, MEALS, miniRecipes, money, norm, Recipe, STATE_COLORS } from '../lib/model';
import { bucketAverage, fmtQty, isStocked, itemCost, costContext, miniCost, miniOf, recipeCost, searchRecipes } from '../lib/food';
import type { Update } from '../Household';
import RecipeEditor, { safeLink } from './RecipeEditor';
import { confirmRemove } from './confirm';
import TagFilter from './TagFilter';

type Tab = 'recipes' | 'buckets' | 'minis';

/**
 * Recipes: one quiet list (recipes, buckets or mini recipes). Tap one to open it on its
 * own page; adding or editing also opens on its own page.
 */
export default function RecipesPage({ D, update, mon }: { D: HouseholdData; update: Update; mon: Date }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recipes');
  /** A recipe id, or 'bucket:<id>', open on its own page. */
  const [open, setOpen] = useState<string | null>(null);
  /** null = closed, 'new' / 'mini:new' / 'bucket:new' = adding, 'bucket:<id>' or a recipe id = editing. */
  const [editing, setEditing] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<Meal | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');

  const pantry = new Map(D.pantry.map(c => [norm(c.name), c]));
  const prices = costContext(D);
  const weekKeys = DOW.map((_, i) => key(addDays(mon, i)));
  const mains = mealRecipes(D);
  const minis = searchRecipes(miniRecipes(D), q).sort((a, b) => a.name.localeCompare(b.name));
  const buckets = D.buckets.filter(b => !q || norm(b.name).includes(norm(q)) || b.items.some(g => norm(g.name).includes(norm(q)))).sort((a, b) => a.name.localeCompare(b.name));
  const recipes = searchRecipes(mains, q).filter(r => mealFilter === 'all' || r.meals.includes(mealFilter))
    .filter(r => !tagFilter || (r.tags ?? []).some(x => norm(x) === norm(tagFilter))).sort((a, b) => a.name.localeCompare(b.name));

  const top = () => { try { window.scrollTo(0, 0); } catch { /* not available */ } };
  const go = (id: string | null) => { setOpen(id); top(); };
  const edit = (id: string) => { setEditing(id); top(); };
  const editingBucket = editing?.startsWith('bucket:');
  const editingRecipe = editing && editing !== 'new' && editing !== 'mini:new' && !editingBucket ? D.recipes.find(r => r.id === editing) ?? null : null;
  const editKind = editingBucket ? 'bucket' : editing === 'mini:new' || editingRecipe?.mini ? 'mini' : 'recipe';
  const bucketBeingEdited = editingBucket ? D.buckets.find(b => 'bucket:' + b.id === editing) ?? null : null;

  const removeBucket = (id: string) => update(x => {
    x.buckets = x.buckets.filter(b => b.id !== id);
    for (const r of x.recipes) if (r.buckets) { r.buckets = r.buckets.filter(u => u.bucket !== id); if (!r.buckets.length) delete r.buckets; }
    for (const k of Object.keys(x.picks)) { delete x.picks[k][id]; if (!Object.keys(x.picks[k]).length) delete x.picks[k]; }
  });
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

  const plannedOn = (r: Recipe) => weekKeys.flatMap((k, i) => MEALS.filter(m => D.plan[k]?.[m] === r.id).map(m => DOW[i] + ' ' + MEAL_LABEL[m].toLowerCase()));
  const lowCount = (r: Recipe) => r.ingredients.filter(g => { const c = pantry.get(norm(g.name)); return c && !isStocked(c); }).length;
  const inBuckets = (r: Recipe) => D.buckets.filter(b => b.items.some(g => g.recipe === r.id)).map(b => b.name);

  // ── Adding or editing: its own page ──
  if (editing) {
    return (
      <div className="detail">
        <button className="link-btn back-link" onClick={() => setEditing(null)}>‹ Back</button>
        <RecipeEditor key={editing} D={D} update={update} recipe={editingRecipe} kind={editKind} bucket={bucketBeingEdited}
          onDone={() => setEditing(null)} />
      </div>
    );
  }

  // ── One recipe, mini recipe or bucket: its own page ──
  const openBucket = open?.startsWith('bucket:') ? D.buckets.find(b => 'bucket:' + b.id === open) : undefined;
  const openRecipe = open && !openBucket ? D.recipes.find(r => r.id === open) : undefined;
  if (openRecipe) {
    const r = openRecipe, link = safeLink(r.link), cost = r.mini ? miniCost(r, prices) : recipeCost(r, prices), planned = plannedOn(r);
    const meta = [
      cost !== null && cost !== undefined ? (r.mini ? money(cost) + ' a batch' : money(cost) + ' a meal · ' + money(cost / 2) + ' each') : '',
      r.mini ? (inBuckets(r).length ? 'In ' + inBuckets(r).join(', ') : 'Not in a bucket yet') : r.meals.map(m => MEAL_LABEL[m]).join(' · '),
      !r.mini && planned.length ? 'On ' + planned.join(', ') : '',
    ].filter(Boolean);
    return (
      <div className="detail">
        <button className="link-btn back-link" onClick={() => go(null)}>‹ {r.mini ? 'Mini recipes' : 'Recipes'}</button>
        <h2 className="detail-title">{r.name}</h2>
        <div className="detail-meta">{meta.join(' · ')}</div>
        {(r.tags ?? []).length > 0 && <div className="row" style={{ gap: 4 }}>{r.tags!.map(t => <span key={t} className="mini-tag dense">{t}</span>)}</div>}
        <div className="detail-actions">
          <button className="pill-sm dark" onClick={() => edit(r.id)}>Edit</button>
          {link && <a className="pill-sm detail-link" href={link} target="_blank" rel="noopener noreferrer">Open recipe ↗</a>}
          <button className="link-btn" onClick={() => { if (confirmRemove('“' + r.name + '”')) { remove(r.id); go(null); } }}>Remove</button>
        </div>

        <section className="detail-sec">
          <div className="sec-label">Ingredients</div>
          {r.ingredients.map((g, i) => {
            const c = pantry.get(norm(g.name));
            const dot = !c ? 'var(--extra)' : isStocked(c) ? STATE_COLORS.Full : STATE_COLORS.Replace;
            return (
              <div key={i} className="ing-line">
                <span className="dot8" style={{ background: dot }} />
                <span className="ing-line-name">{g.name}</span>
                <span className="ing-line-qty">{prices.staples.has(norm(g.name)) ? 'staple' : g.qty && g.unit ? fmtQty(g.qty, g.unit) : ''}</span>
              </div>
            );
          })}
          {(r.buckets ?? []).map(u => {
            const b = D.buckets.find(z => z.id === u.bucket);
            return b ? <div key={u.bucket} className="ing-line"><span className="dot8" style={{ background: '#C3A8DE' }} /><span className="ing-line-name">Pick {u.count} from {b.name}</span><span className="ing-line-qty">bucket</span></div> : null;
          })}
          {!r.ingredients.length && !r.buckets?.length && <p className="note">No ingredients yet. Tap Edit to add them.</p>}
          {r.ingredients.length > 0 && (
            <div className="note detail-legend">
              <span><span className="dot6" style={{ background: STATE_COLORS.Full }} /> In stock</span>
              <span><span className="dot6" style={{ background: STATE_COLORS.Replace }} /> Low</span>
              <span><span className="dot6" style={{ background: 'var(--extra)' }} /> Not stocked</span>
            </div>
          )}
        </section>

        {r.method && (
          <section className="detail-sec">
            <div className="sec-label">Method</div>
            <div className="method-text">{r.method}</div>
          </section>
        )}
      </div>
    );
  }
  if (openBucket) {
    const b = openBucket, usedBy = mains.filter(r => r.buckets?.some(u => u.bucket === b.id)), avg = bucketAverage(b, prices);
    return (
      <div className="detail">
        <button className="link-btn back-link" onClick={() => go(null)}>‹ Buckets</button>
        <h2 className="detail-title">{b.name}</h2>
        <div className="detail-meta">
          {[b.items.length + ' item' + (b.items.length === 1 ? '' : 's'), (b.perMeal ?? 1) + ' per meal', avg ? 'avg ' + money(avg) + ' each' : '',
            usedBy.length ? 'Used in ' + usedBy.map(r => r.name).join(', ') : 'Not used in a recipe yet'].filter(Boolean).join(' · ')}
        </div>
        <div className="detail-actions">
          <button className="pill-sm dark" onClick={() => edit('bucket:' + b.id)}>Edit</button>
          <button className="link-btn" onClick={() => { if (confirmRemove('the “' + b.name + '” bucket')) { removeBucket(b.id); go(null); } }}>Remove</button>
        </div>
        <BucketItems b={b} prices={prices} />
      </div>
    );
  }

  // ── The list ──
  const counts: Record<Tab, number> = { recipes: mains.length, buckets: D.buckets.length, minis: miniRecipes(D).length };
  const newLabel: Record<Tab, [string, string]> = { recipes: ['+ New recipe', 'new'], buckets: ['+ New bucket', 'bucket:new'], minis: ['+ New mini recipe', 'mini:new'] };

  return (
    <div className="list-page">
      <div className="list-tools">
        <input className="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'buckets' ? 'Search buckets' : tab === 'minis' ? 'Search mini recipes' : 'Search recipes'} aria-label="Search" />
        <button className="pill dark" onClick={() => edit(newLabel[tab][1])}>{newLabel[tab][0]}</button>
      </div>
      <div className="seg list-switch" role="group" aria-label="Show">
        {(['recipes', 'buckets', 'minis'] as Tab[]).map(t => (
          <button key={t} className={tab === t ? 'on' : ''} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'recipes' ? 'Recipes' : t === 'buckets' ? 'Buckets' : 'Mini recipes'} <span className="seg-count">{counts[t]}</span>
          </button>
        ))}
      </div>

      {tab === 'recipes' && (<>
        <div className="filter-rows">
          <div className="filter-row">
            <span className="filter-label">Meal</span>
            <div className="seg" role="group" aria-label="Filter by meal">
              {(['all', ...MEALS] as const).map(m => (
                <button key={m} className={mealFilter === m ? 'on' : ''} aria-pressed={mealFilter === m} onClick={() => setMealFilter(m)}>{m === 'all' ? 'All' : MEAL_LABEL[m]}</button>
              ))}
            </div>
          </div>
          <TagFilter D={D} update={update} kind="recipe" active={tagFilter} onPick={setTagFilter}
            count={t => mains.filter(r => (r.tags ?? []).some(x => norm(x) === norm(t))).length} />
        </div>
        <div className="item-list">
          {recipes.map(r => {
            const planned = plannedOn(r), low = lowCount(r);
            return (
              <button key={r.id} className="item-row" onClick={() => go(r.id)}>
                <span className="item-main">
                  <span className="item-name">{r.name}</span>
                  <span className="item-sub">
                    {money(recipeCost(r, prices))} · {r.meals.map(m => MEAL_LABEL[m]).join(', ')}{planned.length ? ' · On ' + planned.join(', ') : ''}
                    {low > 0 && <span className="ing-low"> · {low} low</span>}
                  </span>
                </span>
                <span className="item-chev" aria-hidden>›</span>
              </button>
            );
          })}
        </div>
        {!recipes.length && <p className="empty">{q ? <>No recipes match “{q}”.</> : 'No recipes here yet.'}</p>}
      </>)}

      {tab === 'buckets' && (<>
        <p className="note list-intro">Interchangeable items, like Vegetables, picked when you plan a meal.</p>
        <div className="item-list">
          {buckets.map(b => {
            const usedBy = mains.filter(r => r.buckets?.some(u => u.bucket === b.id)).length;
            return (
              <button key={b.id} className="item-row" onClick={() => go('bucket:' + b.id)}>
                <span className="item-main">
                  <span className="item-name">{b.name}</span>
                  <span className="item-sub">{b.items.length} item{b.items.length === 1 ? '' : 's'} · {b.perMeal ?? 1} per meal{usedBy ? ' · in ' + usedBy + ' recipe' + (usedBy > 1 ? 's' : '') : ''}</span>
                </span>
                <span className="item-chev" aria-hidden>›</span>
              </button>
            );
          })}
        </div>
        {!buckets.length && <p className="empty">{q ? <>No buckets match “{q}”.</> : 'No buckets yet.'}</p>}
      </>)}

      {tab === 'minis' && (<>
        <p className="note list-intro">Garnishes, sauces and dressings, used as one item in a bucket.</p>
        <div className="item-list">
          {minis.map(r => {
            const c = miniCost(r, prices), where = inBuckets(r);
            return (
              <button key={r.id} className="item-row" onClick={() => go(r.id)}>
                <span className="item-main">
                  <span className="item-name">{r.name}</span>
                  <span className="item-sub">{c !== null ? money(c) + ' a batch · ' : ''}{where.length ? 'In ' + where.join(', ') : 'Not in a bucket yet'}</span>
                </span>
                <span className="item-chev" aria-hidden>›</span>
              </button>
            );
          })}
        </div>
        {!minis.length && <p className="empty">{q ? <>No mini recipes match “{q}”.</> : 'No mini recipes yet.'}</p>}
      </>)}
    </div>
  );
}

/** A bucket's items, with its own tag filter. */
function BucketItems({ b, prices }: { b: Bucket; prices: ReturnType<typeof costContext> }) {
  const [tag, setTag] = useState('');
  return (
    <section className="detail-sec">
      <div className="sec-label">Items</div>
      {(b.tags ?? []).length > 0 && (
        <div className="row" style={{ gap: 4, margin: '4px 0 6px' }}>
          {['', ...b.tags!].map(t => <button key={t || 'all'} className={'mini-tag dense' + (tag === t ? ' on' : '')} aria-pressed={tag === t} onClick={() => setTag(t)}>{t || 'All'}</button>)}
        </div>
      )}
      {b.items.filter(g => !tag || (g.tags ?? []).some(t => norm(t) === norm(tag))).map((g, i) => {
        const c = itemCost(g, prices), mini = miniOf(g, prices);
        return (
          <div key={i} className="ing-line">
            <span className="ing-line-name">{g.name}</span>
            <span className="ing-line-qty">{mini ? 'mini recipe' + (c !== null ? ' · ' + money(c) : '') : prices.staples.has(norm(g.name)) ? 'staple' : c !== null ? money(c) : g.qty && g.unit ? fmtQty(g.qty, g.unit) : ''}</span>
          </div>
        );
      })}
      {!b.items.length && <p className="note">Empty. Tap Edit to add items.</p>}
    </section>
  );
}
