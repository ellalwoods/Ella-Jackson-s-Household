import { useState } from 'react';
import { key } from '../lib/dates';
import { ChoreOwner, EXTRA_COLOR, Extra, HouseholdData, money, nextOwner, OWNERS, Spend, uid } from '../lib/model';
import type { Update } from '../Household';
import { CategoryWeek, weekBudget } from '../lib/food';

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
  const b = weekBudget(D, mon);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="card" style={{ flex: '1 1 300px', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Budget <span style={{ fontWeight: 400, fontSize: 13 }} className="muted">this week</span></h2>
        <button className="link-btn" style={{ fontSize: 13 }} onClick={onEdit}>Edit</button>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Donut bg={b.donut} size={140} hole={22}>
          <span style={{ fontSize: 11 }} className="muted">Left over</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{money(b.left)}</span>
        </Donut>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, flex: 1, minWidth: 140 }}>
          <div className="kv"><span className="muted">Income</span><span style={{ fontWeight: 600 }}>{money(b.income)}</span></div>
          <div className="kv"><span className="muted">Committed</span><span style={{ fontWeight: 600 }}>{money(b.committed.total)}</span></div>
          <div className="kv"><span className="muted">Spent so far</span><span>{money(b.spent.total)}</span></div>
          <div className="kv"><span style={{ color: '#A9477B' }}>Ella pays</span><span>{money(b.committed.e)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson pays</span><span>{money(b.committed.j)}</span></div>
          <div className="kv" style={{ borderTop: '1px solid #F0ECE4', paddingTop: 6 }}><span style={{ color: '#A9477B' }}>Ella has left</span><span style={{ fontWeight: 600 }}>{money(b.ellaLeft)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson has left</span><span style={{ fontWeight: 600 }}>{money(b.jacksonLeft)}</span></div>
        </div>
      </div>
      {b.cats.map(c => (
        <CategoryRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(o => (o === c.id ? null : c.id))} update={update} wk={wk} />
      ))}
      {!b.cats.length && <p style={{ fontSize: 13, margin: 0 }} className="muted">No categories yet.</p>}
      <WeekExtras extras={extras} total={b.extra.total} update={update} wk={wk} />
    </section>
  );
}

const OVER_INK = '#B0532F';

/** One faded half per person, filling with their colour as they spend. */
function FillBar({ c }: { c: CategoryWeek }) {
  // Ella fills from the left edge, Jackson from the right, meeting in the middle.
  const half = (budget: number, spent: number, color: string, tint: string, width: string, fromRight: boolean) => (
    <div style={{ width, background: tint, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, [fromRight ? 'right' : 'left']: 0, width: (budget ? Math.min(1, spent / budget) * 100 : spent ? 100 : 0) + '%', background: color }} />
    </div>
  );
  const t = c.budget.total;
  const ew = t ? (c.budget.e / t * 100) + '%' : '50%', jw = t ? (c.budget.j / t * 100) + '%' : '50%';
  return (
    <div className="split-bar" style={{ gap: 2, background: 'transparent' }}>
      {half(c.budget.e, c.spent.e, '#E886B8', '#FAE3EE', ew, false)}
      {half(c.budget.j, c.spent.j, '#2A9E80', '#DAEFE7', jw, true)}
    </div>
  );
}

function CategoryRow({ c, open, onToggle, update, wk }: { c: CategoryWeek; open: boolean; onToggle: () => void; update: Update; wk: string }) {
  const personLine = (spent: number, budget: number) => (c.fixed ? money(budget) : money(spent) + ' of ' + money(budget));
  return (
    <div className="cat-row">
      <button className="cat-toggle" onClick={c.fixed ? undefined : onToggle} aria-expanded={c.fixed ? undefined : open}
        style={{ cursor: c.fixed ? 'default' : 'pointer' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="swatch" style={{ background: c.color }} />{c.name}
            {!c.fixed && <span className="cat-chevron" aria-hidden>{open ? '−' : '+'}</span>}
          </span>
          {c.fixed ? <span style={{ fontWeight: 600 }}>{money(c.budget.total)}</span>
            : c.over > 0 ? <span style={{ fontWeight: 600, color: OVER_INK }}>{money(c.spent.total)} <span style={{ fontWeight: 400, fontSize: 12 }}>· {money(c.over)} over</span></span>
            : <span><span style={{ fontWeight: 600 }}>{money(c.spent.total)}</span> <span className="muted" style={{ fontSize: 12 }}>of {money(c.budget.total)}</span></span>}
        </span>
        <FillBar c={c} />
        <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: c.spent.e > c.budget.e && !c.fixed ? OVER_INK : '#A9477B' }}>{personLine(c.spent.e, c.budget.e)}</span>
          <span style={{ color: c.spent.j > c.budget.j && !c.fixed ? OVER_INK : '#1B6B56' }}>{personLine(c.spent.j, c.budget.j)}</span>
        </span>
      </button>
      {open && !c.fixed && <SpendPanel c={c} update={update} wk={wk} />}
    </div>
  );
}

/** Quick entry for what each person has spent in a category this week. */
function SpendPanel({ c, update, wk }: { c: CategoryWeek; update: Update; wk: string }) {
  const [who, setWho] = useState<ChoreOwner>('ella');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const add = () => {
    const amt = parseFloat(amount);
    if (!amt) return;
    const s: Spend = { id: uid(), cat: c.id, amount: amt, who };
    if (note.trim()) s.note = note.trim();
    update(d => { d.spends[wk] = [...(d.spends[wk] ?? []), s]; });
    setAmount(''); setNote('');
  };
  const remove = (id: string) => update(d => {
    const left = (d.spends[wk] ?? []).filter(z => z.id !== id);
    if (left.length) d.spends[wk] = left; else delete d.spends[wk];
  });
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') add(); };
  return (
    <div className="spend-panel">
      {c.grocery && <div className="note">Planned meals: {money(c.mealCost)}, split 50/50. Log anything else you buy below.</div>}
      {c.spends.map(s => (
        <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <OwnerTag o={s.who} />
          <span style={{ flex: 1, minWidth: 0 }} className={s.note ? '' : 'muted'}>{s.note || 'Spend'}</span>
          <span>{money(+s.amount || 0)}</span>
          <button className="link-btn" aria-label="Remove spend" onClick={() => remove(s.id)}>Remove</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <OwnerTag o={who} onClick={() => setWho(nextOwner(who))} />
        <input className="field-sm" style={{ width: 80, height: 34 }} inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={onKey} placeholder="$" aria-label="Amount spent" />
        <input className="field-sm" style={{ flex: '1 1 100px', height: 34 }} value={note} onChange={e => setNote(e.target.value)} onKeyDown={onKey} placeholder="What for?" />
        <button className="pill-sm dark" onClick={add}>Add</button>
      </div>
    </div>
  );
}

function OwnerTag({ o, onClick }: { o: ChoreOwner; onClick?: () => void }) {
  return (
    <button className="person-tag" title={onClick ? 'Who paid' : undefined} onClick={onClick} disabled={!onClick}
      style={{ height: 26, minWidth: 64, padding: '0 8px', flex: 'none', fontSize: 11, background: OWNERS[o].tint, color: OWNERS[o].ink, cursor: onClick ? 'pointer' : 'default' }}>{OWNERS[o].name}</button>
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
