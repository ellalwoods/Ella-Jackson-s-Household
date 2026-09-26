import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { HouseholdData, Meal, MEAL_LABEL, MEALS, money, norm, occurs, OWNERS, Recipe, uid } from '../lib/model';
import { costContext, recipeCost, searchRecipes } from '../lib/food';
import type { Update } from '../Household';

interface Props { D: HouseholdData; update: Update; mon: Date }

export default function WeekTable({ D, update, mon }: Props) {
  /** Open slot as `${dateKey}|${meal}`. */
  const [picker, setPicker] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);

  const tk = key(new Date());
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const prices = costContext(D);
  const cost = (r: (typeof D.recipes)[number]) => recipeCost(r, prices);

  const days = DOW.map((dow, i) => {
    const d = addDays(mon, i), k = key(d);
    const meals = MEALS.map(meal => ({ meal, slot: k + '|' + meal, r: rBy.get(D.plan[k]?.[meal] ?? '') }));
    const chores = D.chores.filter(c => occurs(c, d)).map(c => {
      const dk = k + '|' + c.id;
      return { c, dk, done: !!D.done[dk], p: OWNERS[c.person] };
    });
    return { k, dow, dateNum: d.getDate(), meals, isToday: k === tk, chores };
  });

  const planned = days.flatMap(d => d.meals.filter(m => m.r));
  const mealTotal = planned.reduce((a, m) => a + cost(m.r!), 0);
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
    update(x => {
      const p = { ...(x.plan[k] ?? {}) };
      if (rid) p[meal] = rid; else delete p[meal];
      if (Object.keys(p).length) x.plan[k] = p; else delete x.plan[k];
    });
    close();
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
      <div className="week-grid meals-wide week-colhead">
        <span style={{ display: 'block' }}>Day</span>
        <span><span>Meals</span><span className="meta">{money(mealTotal)} · {money(mealTotal / 2)} each</span></span>
        <span><span>Chores</span><span className="meta">{allChores.filter(c => c.done).length}/{allChores.length} done</span></span>
      </div>

      {days.map(d => (
        <div key={d.k} className="week-grid meals-wide week-row" style={{ background: d.isToday ? '#FCFBF7' : '#fff' }}>
          <div className="day" style={{ color: d.isToday ? '#23221F' : '#8A857A' }}>
            <span className="day-dow">{d.dow}</span>
            <span className="day-num">{d.dateNum}</span>
          </div>

          <div className="meal-slots">
            {d.meals.map(({ meal, slot, r }) => (
              <div key={meal} style={{ position: 'relative', minWidth: 0 }}>
                <button className="slot-btn" onClick={() => { setPicker(slot); setQuery(''); setIdx(0); }}
                  style={{ borderColor: r ? '#E8E4DB' : '#EFEBE3', background: r ? '#FBFAF7' : 'transparent' }}>
                  <span className="slot-label">{MEAL_LABEL[meal]}</span>
                  <span className="slot-name" style={{ fontWeight: r ? 500 : 400, color: r ? '#23221F' : '#A39D90' }}>{r ? r.name : '+ Add'}</span>
                  {r && <span className="slot-cost">{money(cost(r))}</span>}
                </button>
                {picker === slot && (
                  <>
                    <div className="scrim" onClick={close} />
                    <div className="picker">
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
                      <div className="picker-actions">
                        {canCreate && <button className="pill-sm dark" onClick={createFromPick}>+ New “{query}”</button>}
                        {r && <button className="pill-sm" onClick={() => setMeal(slot, null)}>Clear</button>}
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
        <span>{planned.length} meal{planned.length === 1 ? '' : 's'} planned · {money(mealTotal / 2)} each</span>
        <span style={{ display: 'flex', gap: 12 }}>
          <span className="legend"><span className="dot8" style={{ background: '#E886B8' }} />Ella</span>
          <span className="legend"><span className="dot8" style={{ background: '#2A9E80' }} />Jackson</span>
          <span className="legend"><span className="dot8" style={{ background: '#8FB0CF' }} />Both</span>
        </span>
      </div>
    </section>
  );
}
