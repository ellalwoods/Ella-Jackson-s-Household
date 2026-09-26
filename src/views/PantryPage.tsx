import { useState } from 'react';
import { HouseholdData, INCLUDE_LOW, norm, PantryItem, STATE_COLORS, STATES, StockState, Unit, UNIT_LABEL, UNITS } from '../lib/model';
import { addToPantry, expiry, fmtQty, priceMap } from '../lib/food';
import type { Update } from '../Household';

export const stockRule = (INCLUDE_LOW
  ? 'Full and Half items are skipped on the shopping list; Low and Replace get added.'
  : 'Full, Half and Low items are skipped; only Replace gets added.') +
  ' Items with an amount are skipped when there’s enough for the week’s dinners.';

export default function PantryPage({ D, update }: { D: HouseholdData; update: Update }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'All' | StockState | 'Expiring'>('All');
  const prices = priceMap(D);

  const cq = norm(q);
  const levelOf = (c: PantryItem) => (c.qty != null ? null : c.state);
  const expiring = (c: PantryItem) => { const e = expiry(c.expires); return !!e && (e.soon || e.expired); };
  const matches = (c: PantryItem, f: typeof filter) => f === 'All' || (f === 'Expiring' ? expiring(c) : levelOf(c) === f);
  const items = D.pantry
    .filter(c => (!cq || norm(c.name).includes(cq)) && matches(c, filter))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Items are keyed by name so edits still land correctly after a sync.
  const edit = (name: string, f: (c: PantryItem) => void) => update(x => { const c = x.pantry.find(c => c.name === name); if (c) f(c); });
  const remove = (name: string) => update(x => { x.pantry = x.pantry.filter(c => c.name !== name); });

  return (
    <>
      <AddToPantry D={D} update={update} />
      <div className="row8" style={{ marginBottom: 10 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search the pantry" />
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        {(['All', ...STATES, 'Expiring'] as const).map(f => {
          const on = filter === f;
          const cnt = D.pantry.filter(c => matches(c, f)).length;
          return (
            <button key={f} className="filter" onClick={() => setFilter(f)}
              style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{f} · {cnt}</button>
          );
        })}
      </div>
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 10 }}>
        {items.map(c => {
          const n = D.recipes.filter(r => r.ingredients.some(g => norm(g.name) === norm(c.name))).length;
          const pr = prices.get(norm(c.name));
          return (
            <div key={c.name} className="card" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {c.name} <span style={{ fontWeight: 400, fontSize: 12 }} className="muted">{n ? '· in ' + n + ' recipe' + (n > 1 ? 's' : '') : ''}</span>
                </span>
                <button className="link-btn" onClick={() => remove(c.name)}>Remove</button>
              </div>
              {c.qty != null ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="field-sm" style={{ height: 34, width: 90 }} inputMode="decimal" value={String(c.qty)} aria-label="Amount left"
                    onChange={e => { const v = e.target.value; edit(c.name, z => { z.qty = parseFloat(v) || 0; }); }} />
                  <UnitSelect value={c.unit ?? 'g'} onChange={u => edit(c.name, z => { z.unit = u; })} height={34} />
                  <span style={{ fontSize: 12 }} className="muted">left</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                  {STATES.map(st => {
                    const on = c.state === st;
                    return (
                      <button key={st} className="state-btn" onClick={() => edit(c.name, z => { z.state = st; })}
                        style={{ background: on ? STATE_COLORS[st] : '#fff', borderColor: on ? STATE_COLORS[st] : '#DDD8CC' }}>{st}</button>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }} className="muted">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  Use by <input type="date" className="field-sm" style={{ height: 32, fontSize: 13 }} value={c.expires ?? ''}
                    onChange={e => { const v = e.target.value; edit(c.name, z => { if (v) z.expires = v; else delete z.expires; }); }} />
                </label>
                {(() => { const e = expiry(c.expires); return e && (e.soon || e.expired) ? <span className={'exp-chip ' + (e.expired ? 'expired' : 'soon')}>{e.label}</span> : null; })()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="note">{pr ? 'Buy ' + fmtQty(pr.qty, pr.unit) + ' for $' + pr.price.toFixed(2) : ''}</span>
                <button className="link-btn" onClick={() => edit(c.name, z => {
                  if (z.qty != null) { delete z.qty; delete z.unit; delete z.forWeek; z.state = 'Full'; }
                  else { z.qty = 0; z.unit = pr?.unit ?? 'g'; }
                })}>{c.qty != null ? 'Track by level' : 'Track amount'}</button>
              </div>
            </div>
          );
        })}
      </div>
      {!items.length && <p className="empty">Nothing here. Add what you have so the shopping list can skip it.</p>}
      <p className="note" style={{ marginTop: 14 }}>{stockRule} Amounts added from the shopping list already allow for that week’s dinners. Expired items go back on the shopping list.</p>
    </>
  );
}

export function UnitSelect({ value, onChange, height = 40 }: { value: Unit; onChange: (u: Unit) => void; height?: number }) {
  return (
    <select className="field-sm" style={{ height, padding: '0 4px', width: 64 }} value={value} onChange={e => onChange(e.target.value as Unit)} aria-label="Unit">
      {UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
    </select>
  );
}

/** Add something to the pantry by hand: a name and, optionally, how much and when it's used by. */
function AddToPantry({ D, update }: { D: HouseholdData; update: Update }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>('each');
  const [expires, setExpires] = useState('');
  const existing = D.pantry.find(c => norm(c.name) === norm(name));
  const known = Array.from(new Set([...D.prices.map(p => p.name), ...D.recipes.flatMap(r => r.ingredients.map(g => g.name))]))
    .filter(n => !D.pantry.some(c => norm(c.name) === norm(n))).sort();

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const q = parseFloat(qty);
    update(x => addToPantry(x, { name: n, ...(q > 0 ? { qty: q, unit } : {}), ...(expires ? { expires } : {}) }));
    setName(''); setQty(''); setExpires('');
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') add(); };

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="shop-add" style={{ padding: 0 }}>
        <input className="field-sm" style={{ flex: '1 1 180px', height: 40 }} list="pantry-known" value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
          placeholder="Add to pantry, e.g. Rice" aria-label="Item to add to pantry" />
        <datalist id="pantry-known">{known.map(k => <option key={k} value={k} />)}</datalist>
        <span className="ing-group">
          <input className="field-sm" style={{ width: 56, height: 40 }} inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} onKeyDown={onKey} placeholder="qty" aria-label="Amount" />
          <UnitSelect value={unit} onChange={setUnit} />
        </span>
        <label className="ing-group">
          <span className="ing-label">Use by</span>
          <input type="date" className="field-sm" style={{ height: 40, fontSize: 13 }} value={expires} onChange={e => setExpires(e.target.value)} aria-label="Use by" />
        </label>
        <button className="pill-sm dark" style={{ height: 40 }} onClick={add}>Add</button>
      </div>
      <span className="note">
        {existing ? existing.name + ' is already in the pantry — an amount here is added to what’s there.' : 'Amount and use-by date are optional. Without an amount it’s marked Full.'}
      </span>
    </div>
  );
}
