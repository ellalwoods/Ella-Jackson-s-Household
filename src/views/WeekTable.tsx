import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { BLANK_PICK, EAT_OUT, HouseholdData, Meal, MEAL_LABEL, MEALS, money, norm, occurs, OWNERS, Recipe, uid } from '../lib/model';
import { costContext, recipeCost, searchRecipes } from '../lib/food';
import BucketPickDialog from './BucketPickDialog';
import type { Update } from '../Household';

interface Props { D: HouseholdData; update: Update; mon: Date }

export default function WeekTable({ D, update, mon }: Props) {
  /** Open slot as `${dateKey}|${meal}`. */
  const [picker, setPicker] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  /** Slot whose bucket items are being picked. */
  const [picking, setPicking] = useState<string | null>(null);

  const tk = key(new Date());
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const prices = costContext(D);
  const cost = (r: Recipe, slot?: string) => recipeCost(r, prices, slot ? D.picks[slot] : undefined);

  const days = DOW.map((dow, i) => {
    const d = addDays(mon, i), k = key(d);
    const meals = MEALS.map(meal => ({ meal, slot: k + '|' + meal, r: rBy.get(D.plan[k]?.[meal] ?? ''), out: D.plan[k]?.[meal] === EAT_OUT }));
    const chores = D.chores.filter(c => occurs(c, d)).map(c => {
      const dk = k + '|' + c.id;
      return { c, dk, done: !!D.done[dk], p: OWNERS[c.person] };
    });
    return { k, dow, dateNum: d.getDate(), meals, isToday: k === tk, chores };
  });

  const planned = days.flatMap(d => d.meals.filter(m => m.r));
  const eatingOut = days.reduce((a, d) => a + d.meals.filter(m => m.out).length, 0);
  const mealTotal = planned.reduce((a, m) => a + cost(m.r!, m.slot), 0);
  const allChores = days.flatMap(d => d.chores);

  // Picker: recipes tagged for this meal first (only those until you search), then name matches, then alphabetical.
  const pickMeal = (picker?.split('|')[1] ?? 'dinner') as Meal;
  const pq = norm(query);
  const tagged = (r: Recipe) => r.meals.includes(pickMeal);
  const anyTagged = D.recipes.some(tagged);
  const matches = searchRecipes(D.recipes, query)
    .filter(r => pq || !anyTagged || tagged(r))
    .sort((a, b) => (+tagged(b) - +tagged(a)) || (norm(b.name).startsWith(pq) ? 1 : 0) - (norm(a.name).startsWith(pq) ? 1 : 0) || a.name.localeCompare(b.name));
  const pIdx = Math.min(idx, Math.max(0, matches.length - 1));
  const canCreate = !!pq && !D.recipes.some(r => norm(r.name) === pq);

  const close = () => { setPicker(null); setQuery(''); };
  const setMeal = (slot: string, rid: string | null) => {
    const [k, meal] = slot.split('|') as [string, Meal];
    const changed = (D.plan[k]?.[meal] ?? null) !== rid;
    update(x => {
      const p = { ...(x.plan[k] ?? {}) };
      if (rid) p[meal] = rid; else delete p[meal];
      if (Object.keys(p).length) x.plan[k] = p; else delete x.plan[k];
      // Picks belong to the recipe that was there.
      if (changed) { delete x.picks[slot]; delete x.eatOut[slot]; }
    });
    close();
    // A recipe with buckets asks straight away which items to use.
    const r = rid ? D.recipes.find(z => z.id === rid) : null;
    if (r?.buckets?.length && changed) setPicking(slot);
  };
  const createFromPick = () => {
    const n = query.trim(), slot = picker;
    if (!n || !slot) return;
    const id = uid(), meal = slot.split('|')[1] as Meal;
    update(x => { x.recipes.push({ id, name: n, meals: [meal], ingredients: [] }); });
    setMeal(slot, id);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.min(pIdx + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(pIdx - 1, 0)); }
    else if (e.key === 'Enter') { if (matches[pIdx]) setMeal(picker!, matches[pIdx].id); else createFromPick(); }
  };

  return (
    <section className="card" style={{ flex: '2 1 560px' }}>
      <div className="week-grid meals-row week-colhead">
        <span style={{ display: 'block' }}>Day</span>
        {MEALS.map(m => <span key={m} className="col-meal">{MEAL_LABEL[m]}</span>)}
        <span className="col-meals"><span>Meals</span></span>
        <span><span>Chores</span><span className="meta">{allChores.filter(c => c.done).length}/{allChores.length} done</span></span>
      </div>

      {days.map(d => (
        <div key={d.k} className="week-grid meals-row week-row" style={{ background: d.isToday ? '#FCFBF7' : '#fff' }}>
          <div className="day" style={{ color: d.isToday ? '#23221F' : '#8A857A' }}>
            <span className="day-dow">{d.dow}</span>
            <span className="day-num">{d.dateNum}</span>
          </div>

          <div className="meal-slots">
            {d.meals.map(({ meal, slot, r, out }, mi) => (
              <div key={meal} style={{ position: 'relative', minWidth: 0 }}>
                <button className="slot-btn" onClick={() => { setPicker(slot); setQuery(''); setIdx(0); }}
                  style={{ borderColor: r || out ? '#E8E4DB' : '#EFEBE3', background: out ? '#F6F1EA' : r ? '#FBFAF7' : 'transparent' }}>
                  <span className="slot-label">{MEAL_LABEL[meal]}</span>
                  {out ? (<>
                    <span className="slot-name" style={{ fontWeight: 500, color: '#23221F' }}>🍽 Eating out</span>
                    {D.eatOut[slot] && <span className="slot-cost">{D.eatOut[slot]}</span>}
                  </>) : (<>
                    <span className="slot-name" style={{ fontWeight: r ? 500 : 400, color: r ? '#23221F' : '#A39D90' }}>{r ? r.name : '+'}</span>
                    {r && <span className="slot-cost">{money(cost(r, slot))}</span>}
                  </>)}
                </button>
                {r?.buckets?.length ? <BucketLine D={D} recipe={r} picks={D.picks[slot] ?? {}} onOpen={() => setPicking(slot)} /> : null}
                {picker === slot && (
                  <>
                    <div className="scrim" onClick={close} />
                    <div className={'picker' + (mi >= 2 ? ' picker-right' : '')}>
                      <input className="picker-input" autoFocus value={query} placeholder={'Search ' + MEAL_LABEL[meal].toLowerCase() + ' recipes or ingredients'}
                        onChange={e => { setQuery(e.target.value); setIdx(0); }} onKeyDown={onKey} />
                      <div className="picker-list">
                        {matches.slice(0, 50).map((m, i) => (
                          <button key={m.id} className="picker-item" onClick={() => setMeal(slot, m.id)}
                            style={{ background: i === pIdx ? '#F5F2EC' : 'transparent' }}>
                            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }}>
                              <span style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</span>
                              <span style={{ fontSize: 12 }} className="muted">
                                {pq && !norm(m.name).includes(pq) ? 'Uses ' + m.ingredients.filter(g => norm(g.name).includes(pq)).map(g => g.name).join(', ') : m.ingredients.length + ' ingredients'}
                                {!m.meals.includes(meal) && m.meals.length ? ' · ' + m.meals.map(x => MEAL_LABEL[x]).join(', ') : ''}
                              </span>
                            </span>
                            <span style={{ fontSize: 13 }} className="muted">{money(cost(m))}</span>
                          </button>
                        ))}
                        {!matches.length && <span style={{ fontSize: 13, padding: '8px 10px' }} className="muted">No recipes match.</span>}
                      </div>
                      {out && (
                        <input className="field-sm" style={{ height: 36 }} placeholder="Where? (optional)" aria-label="Where you're eating out"
                          value={D.eatOut[slot] ?? ''} onChange={e => { const v = e.target.value; update(x => { if (v.trim()) x.eatOut[slot] = v; else delete x.eatOut[slot]; }); }}
                          onKeyDown={e => { if (e.key === 'Enter') close(); }} />
                      )}
                      <div className="picker-actions">
                        {canCreate && <button className="pill-sm dark" onClick={createFromPick}>+ New “{query}”</button>}
                        {!out && <button className="pill-sm" onClick={() => { setMeal(slot, EAT_OUT); setPicker(slot); }}>🍽 Eat out</button>}
                        {(r || out) && <button className="pill-sm" onClick={() => setMeal(slot, null)}>Clear</button>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="chores-cell">
            {d.chores.map(({ c, dk, done, p }) => (
              <button key={c.id} className="chore-chip" style={{ background: p.tint, color: p.ink, opacity: done ? 0.5 : 1 }}
                onClick={() => update(x => { if (x.done[dk]) delete x.done[dk]; else x.done[dk] = 1; })}>
                <span className="chore-check" style={{ borderColor: p.color, background: done ? p.color : 'transparent' }}>{done ? '✓' : ''}</span>
                <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{c.name}</span>
              </button>
            ))}
            {!d.chores.length && <span style={{ fontSize: 13, color: '#C2BCB0' }}>—</span>}
          </div>
        </div>
      ))}

      <div className="week-foot">
        <span>{planned.length} meal{planned.length === 1 ? '' : 's'} planned · {money(mealTotal)} · {money(mealTotal / 2)} each{eatingOut ? ' · ' + eatingOut + ' eating out' : ''}</span>
        <span style={{ display: 'flex', gap: 12 }}>
          <span className="legend"><span className="dot8" style={{ background: '#E886B8' }} />Ella</span>
          <span className="legend"><span className="dot8" style={{ background: '#2A9E80' }} />Jackson</span>
          <span className="legend"><span className="dot8" style={{ background: '#8FB0CF' }} />Both</span>
        </span>
      </div>
      {picking && (() => {
        const [k, meal] = picking.split('|') as [string, Meal];
        const r = rBy.get(D.plan[k]?.[meal] ?? '');
        const day = days.find(d => d.k === k);
        return r ? (
          <BucketPickDialog D={D} recipe={r} label={(day?.dow ?? '') + ' ' + MEAL_LABEL[meal].toLowerCase()} picks={D.picks[picking] ?? {}}
            onSave={p => update(x => { x.picks[picking] = p; })} onClose={() => setPicking(null)} />
        ) : null;
      })()}
    </section>
  );
}

/** Under a planned meal: what's been picked from each bucket, or how many are still to pick. */
function BucketLine({ D, recipe, picks, onOpen }: { D: HouseholdData; recipe: Recipe; picks: Record<string, string[]>; onOpen: () => void }) {
  const parts = (recipe.buckets ?? []).map(u => {
    const b = D.buckets.find(z => z.id === u.bucket), all = (picks[u.bucket] ?? []).slice(0, u.count);
    const got = all.filter(n => n !== BLANK_PICK);
    return b ? { name: b.name, got, blanks: all.length - got.length, missing: u.count - all.length } : null;
  }).filter((x): x is { name: string; got: string[]; blanks: number; missing: number } => !!x);
  if (!parts.length) return null;
  const todo = parts.some(p => p.missing > 0);
  return (
    <button className={'bucket-line' + (todo ? ' todo' : '')} onClick={onOpen} title="Choose bucket items">
      {parts.map((p, i) => (
        <span key={i}>
          🪣 {p.got.length ? p.name + ': ' + p.got.join(', ') : ''}{p.blanks ? (p.got.length ? ' + ' : p.name + ': ') + p.blanks + ' blank' + (p.blanks > 1 ? 's' : '') : ''}{p.missing > 0 ? (p.got.length || p.blanks ? ' · ' : '') + 'Pick ' + p.missing + (p.got.length || p.blanks ? ' more' : ' ' + p.name.toLowerCase()) : ''}
        </span>
      ))}
    </button>
  );
}
