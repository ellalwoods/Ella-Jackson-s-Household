import { useState } from 'react';
import { key } from '../lib/dates';
import { budget, ChoreOwner, EXTRA_COLOR, Extra, HouseholdData, money, nextOwner, OWNERS, uid } from '../lib/model';
import type { Update } from '../Household';
import { GroceryEstimate, groceryEstimate, PLAN_SLOTS } from '../lib/food';

export function Donut({ bg, size, hole, children }: { bg: string; size: number; hole: number; children?: React.ReactNode }) {
  return (
    <div className="donut" style={{ width: size, height: size, background: bg }}>
      <div className="donut-hole" style={{ inset: hole }}>{children}</div>
    </div>
  );
}

export default function BudgetCard({ D, update, mon, onEdit }: { D: HouseholdData; update: Update; mon: Date; onEdit: () => void }) {
  const wk = key(mon);
  const extras = D.extras[wk] ?? [];
  const g = groceryEstimate(D, mon);
  const b = budget(D, g, extras);

  return (
    <section className="card" style={{ flex: '1 1 300px', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Budget <span style={{ fontWeight: 400, fontSize: 13 }} className="muted">per week</span></h2>
        <button className="link-btn" style={{ fontSize: 13 }} onClick={onEdit}>Edit</button>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Donut bg={b.donut} size={140} hole={22}>
          <span style={{ fontSize: 11 }} className="muted">Left over</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{money(b.left)}</span>
        </Donut>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, flex: 1, minWidth: 140 }}>
          <div className="kv"><span className="muted">Income</span><span style={{ fontWeight: 600 }}>{money(b.income)}</span></div>
          <div className="kv"><span className="muted">Committed</span><span style={{ fontWeight: 600 }}>{money(b.spend)}</span></div>
          <div className="kv"><span style={{ color: '#A9477B' }}>Ella pays</span><span>{money(b.ella)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson pays</span><span>{money(b.jackson)}</span></div>
          <div className="kv" style={{ borderTop: '1px solid #F0ECE4', paddingTop: 6 }}><span style={{ color: '#A9477B' }}>Ella has left</span><span style={{ fontWeight: 600 }}>{money(b.ellaLeft)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson has left</span><span style={{ fontWeight: 600 }}>{money(b.jacksonLeft)}</span></div>
        </div>
      </div>
      {b.cats.map(c => (
        <div key={c.id} className="cat-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="swatch" style={{ background: c.color }} />{c.name}</span>
            <span style={{ fontWeight: 600 }}>{money(c.total)}</span>
          </div>
          {g && g.id === c.id && <GroceryTag g={g} />}
          <div className="split-bar">
            <div style={{ background: '#E886B8', width: c.total ? (c.e / c.total * 100) + '%' : '50%' }} />
            <div style={{ background: '#2A9E80', width: c.total ? (c.j / c.total * 100) + '%' : '50%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#A9477B' }}>{money(c.e)}</span><span style={{ color: '#1B6B56' }}>{money(c.j)}</span>
          </div>
        </div>
      ))}
      {!b.cats.length && <p style={{ fontSize: 13, margin: 0 }} className="muted">No categories yet.</p>}
      <WeekExtras extras={extras} total={b.extraTotal} update={update} wk={wk} />
    </section>
  );
}

/** One-off costs for the week on screen; they don't touch the recurring budget. */
function WeekExtras({ extras, total, update, wk }: { extras: Extra[]; total: number; update: Update; wk: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [who, setWho] = useState<ChoreOwner>('both');

  const edit = (id: string, f: (x: Extra) => void) => update(d => { const x = (d.extras[wk] ?? []).find(z => z.id === id); if (x) f(x); });
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const x: Extra = { id: uid(), name: n, amount: parseFloat(amount) || 0, who };
    update(d => { d.extras[wk] = [...(d.extras[wk] ?? []), x]; });
    setName(''); setAmount(''); setOpen(false);
  };
  const remove = (id: string) => update(d => {
    const left = (d.extras[wk] ?? []).filter(z => z.id !== id);
    if (left.length) d.extras[wk] = left; else delete d.extras[wk];
  });
  const tag = (o: ChoreOwner, onClick: () => void) => (
    <button className="person-tag" title="Who pays" onClick={onClick}
      style={{ height: 26, minWidth: 64, padding: '0 8px', flex: 'none', fontSize: 11, background: OWNERS[o].tint, color: OWNERS[o].ink }}>{OWNERS[o].name}</button>
  );

  return (
    <div style={{ borderTop: '1px solid #F0ECE4', paddingTop: 10, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <span className="swatch" style={{ background: EXTRA_COLOR }} />This week only
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {total > 0 && <span style={{ fontWeight: 600, fontSize: 14 }}>{money(total)}</span>}
          <button className="x-btn" aria-label="Add a one-off cost" title="Add a one-off cost this week" onClick={() => setOpen(o => !o)}
            style={{ width: 28, height: 28, fontSize: 16, lineHeight: 1 }}>{open ? '×' : '+'}</button>
        </span>
      </div>
      {extras.map(x => (
        <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          {tag(x.who, () => edit(x.id, z => { z.who = nextOwner(z.who); }))}
          <span style={{ flex: 1, minWidth: 0 }}>{x.name}</span>
          <span>{money(+x.amount || 0)}</span>
          <button className="link-btn" aria-label={'Remove ' + x.name} onClick={() => remove(x.id)}>Remove</button>
        </div>
      ))}
      {open && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {tag(who, () => setWho(nextOwner(who)))}
          <input className="field-sm" style={{ flex: '1 1 120px', height: 34 }} autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="e.g. Birthday gift" />
          <input className="field-sm" style={{ width: 80, height: 34 }} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="$" />
          <button className="pill-sm dark" onClick={add}>Add</button>
        </div>
      )}
      {!extras.length && !open && <span className="note">One-off costs for this week. They don’t change your regular budget.</span>}
    </div>
  );
}

/** Marks the Groceries amount as a placeholder, part placeholder, or taken from the meal plan. */
export function GroceryTag({ g }: { g: GroceryEstimate }) {
  const tone = g.status === 'planned' ? { background: '#DAEFE7', color: '#1B6B56' } : { background: '#F2EEE6', color: '#6D675C' };
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
      <span style={{ ...tone, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{g.status === 'placeholder' ? 'Placeholder' : g.status === 'partial' ? 'Part placeholder' : 'Meal plan'}</span>
      <span className="muted">
        {g.status === 'placeholder' ? money(g.placeholder) + ' until you plan meals'
          : g.status === 'partial' ? money(g.mealCost) + ' planned + placeholder for ' + (PLAN_SLOTS - g.filled) + ' empty meals'
          : money(g.mealCost) + ' across this week’s meals'}
      </span>
    </span>
  );
}
