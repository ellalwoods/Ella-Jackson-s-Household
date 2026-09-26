import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { HouseholdData, money, norm, occurs, PEOPLE, uid } from '../lib/model';
import { priceMap, recipeCost, searchRecipes } from '../lib/food';
import type { Update } from '../Household';

interface Props { D: HouseholdData; update: Update; mon: Date }

export default function WeekTable({ D, update, mon }: Props) {
  const [picker, setPicker] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);

  const tk = key(new Date());
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const prices = priceMap(D);
  const cost = (r: (typeof D.recipes)[number]) => recipeCost(r, prices);

  const days = DOW.map((dow, i) => {
    const d = addDays(mon, i), k = key(d);
    const r = rBy.get(D.plan[k]?.r ?? '');
    const chores = D.chores.filter(c => occurs(c, d)).map(c => {
      const dk = k + '|' + c.id;
      return { c, dk, done: !!D.done[dk], p: PEOPLE[c.person] };
    });
    return { k, dow, dateNum: d.getDate(), r, isToday: k === tk, chores };
  });

  const mealTotal = days.reduce((a, d) => a + (d.r ? cost(d.r) : 0), 0);
  const allChores = days.flatMap(d => d.chores);

  // Picker search: name matches first, then alphabetical.
  const pq = norm(query);
  const matches = searchRecipes(D.recipes, query)
    .sort((a, b) => (norm(b.name).startsWith(pq) ? 1 : 0) - (norm(a.name).startsWith(pq) ? 1 : 0) || a.name.localeCompare(b.name));
  const pIdx = Math.min(idx, Math.max(0, matches.length - 1));
  const canCreate = !!pq && !D.recipes.some(r => norm(r.name) === pq);

  const close = () => { setPicker(null); setQuery(''); };
  const setMeal = (k: string, rid: string | null) => {
    update(x => { if (rid) x.plan[k] = { r: rid }; else delete x.plan[k]; });
    close();
  };
  const createFromPick = () => {
    const n = query.trim(), k = picker;
    if (!n || !k) return;
    const id = uid();
    update(x => { x.recipes.push({ id, name: n, cost: 0, ingredients: [] }); x.plan[k] = { r: id }; });
    close();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.min(pIdx + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(pIdx - 1, 0)); }
    else if (e.key === 'Enter') { if (matches[pIdx]) setMeal(picker!, matches[pIdx].id); else createFromPick(); }
  };

  return (
    <section className="card" style={{ flex: '2 1 560px' }}>
      <div className="week-grid week-colhead">
        <span style={{ display: 'block' }}>Day</span>
        <span><span>Dinner</span><span className="meta">{money(mealTotal)} · {money(mealTotal / 2)} each</span></span>
        <span><span>Chores</span><span className="meta">{allChores.filter(c => c.done).length}/{allChores.length} done</span></span>
      </div>

      {days.map(d => (
        <div key={d.k} className="week-grid week-row" style={{ background: d.isToday ? '#FCFBF7' : '#fff' }}>
          <div className="day" style={{ color: d.isToday ? '#23221F' : '#8A857A' }}>
            <span className="day-dow">{d.dow}</span>
            <span className="day-num">{d.dateNum}</span>
          </div>

          <div style={{ position: 'relative', minWidth: 0 }}>
            <button className="meal-btn" onClick={() => { setPicker(d.k); setQuery(''); setIdx(0); }}
              style={{ borderColor: d.r ? '#E8E4DB' : '#E3DED3', background: d.r ? '#FBFAF7' : 'transparent' }}>
              <span style={{ fontSize: 14, fontWeight: d.r ? 500 : 400, color: d.r ? '#23221F' : '#A39D90' }}>{d.r ? d.r.name : '+ Add dinner'}</span>
              {d.r && <span style={{ fontSize: 12 }} className="muted">{money(cost(d.r))} · {money(cost(d.r) / 2)} each</span>}
            </button>
            {picker === d.k && (
              <>
                <div className="scrim" onClick={close} />
                <div className="picker">
                  <input className="picker-input" autoFocus value={query} placeholder="Search recipes or ingredients"
                    onChange={e => { setQuery(e.target.value); setIdx(0); }} onKeyDown={onKey} />
                  <div className="picker-list">
                    {matches.slice(0, 50).map((r, i) => (
                      <button key={r.id} className="picker-item" onClick={() => setMeal(d.k, r.id)}
                        style={{ background: i === pIdx ? '#F5F2EC' : 'transparent' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</span>
                          <span style={{ fontSize: 12 }} className="muted">
                            {pq && !norm(r.name).includes(pq) ? 'Uses ' + r.ingredients.filter(g => norm(g.name).includes(pq)).map(g => g.name).join(', ') : r.ingredients.length + ' ingredients'}
                          </span>
                        </span>
                        <span style={{ fontSize: 13 }} className="muted">{money(cost(r))}</span>
                      </button>
                    ))}
                    {!matches.length && <span style={{ fontSize: 13, padding: '8px 10px' }} className="muted">No recipes match.</span>}
                  </div>
                  <div className="picker-actions">
                    {canCreate && <button className="pill-sm dark" onClick={createFromPick}>+ New “{query}”</button>}
                    {d.r && <button className="pill-sm" onClick={() => setMeal(d.k, null)}>Clear</button>}
                  </div>
                </div>
              </>
            )}
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
        <span>{days.filter(d => d.r).length} of 7 dinners planned</span>
        <span style={{ display: 'flex', gap: 12 }}>
          <span className="legend"><span className="dot8" style={{ background: '#E886B8' }} />Ella</span>
          <span className="legend"><span className="dot8" style={{ background: '#2A9E80' }} />Jackson</span>
        </span>
      </div>
    </section>
  );
}
