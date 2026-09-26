import { useState } from 'react';
import { HouseholdData, INCLUDE_LOW, norm, STATE_COLORS, STATES, StockState } from '../lib/model';
import type { Update } from '../Household';

export const stockRule = INCLUDE_LOW
  ? 'Full and Half items are skipped on the shopping list; Low and Replace get added.'
  : 'Full, Half and Low items are skipped; only Replace gets added.';

export default function CupboardPage({ D, update }: { D: HouseholdData; update: Update }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'All' | StockState>('All');

  const cq = norm(q);
  const exists = D.cupboard.some(c => norm(c.name) === cq);
  const canAdd = !!cq && !exists;
  const items = D.cupboard
    .filter(c => (!cq || norm(c.name).includes(cq)) && (filter === 'All' || c.state === filter))
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = () => {
    const n = q.trim();
    if (!n || exists) return;
    update(x => { if (!x.cupboard.some(c => norm(c.name) === norm(n))) x.cupboard.push({ name: n, state: 'Full' }); });
    setQ('');
  };
  // Items are keyed by name so edits still land correctly after a sync.
  const setState = (name: string, st: StockState) => update(x => { const c = x.cupboard.find(c => c.name === name); if (c) c.state = st; });
  const remove = (name: string) => update(x => { x.cupboard = x.cupboard.filter(c => c.name !== name); });

  return (
    <>
      <div className="row8" style={{ marginBottom: 10 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Search, or type a new ingredient and press Enter" />
        {canAdd && <button className="pill dark" style={{ height: 44, padding: '0 18px' }} onClick={add}>+ Add “{q}”</button>}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        {(['All', ...STATES] as const).map(f => {
          const on = filter === f;
          const cnt = f === 'All' ? D.cupboard.length : D.cupboard.filter(c => c.state === f).length;
          return (
            <button key={f} className="filter" onClick={() => setFilter(f)}
              style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{f} · {cnt}</button>
          );
        })}
      </div>
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 10 }}>
        {items.map(c => {
          const n = D.recipes.filter(r => r.ingredients.some(g => norm(g) === norm(c.name))).length;
          return (
            <div key={c.name} className="card" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {c.name} <span style={{ fontWeight: 400, fontSize: 12 }} className="muted">{n ? '· in ' + n + ' recipe' + (n > 1 ? 's' : '') : ''}</span>
                </span>
                <button className="link-btn" onClick={() => remove(c.name)}>Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {STATES.map(st => {
                  const on = c.state === st;
                  return (
                    <button key={st} className="state-btn" onClick={() => setState(c.name, st)}
                      style={{ background: on ? STATE_COLORS[st] : '#fff', borderColor: on ? STATE_COLORS[st] : '#DDD8CC' }}>{st}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!items.length && <p className="empty">Nothing here. Add what you have so the shopping list can skip it.</p>}
      <p className="note" style={{ marginTop: 14 }}>{stockRule}</p>
    </>
  );
}
