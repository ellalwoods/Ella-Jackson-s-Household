import { useState } from 'react';
import { key } from '../lib/dates';
import { ChoreOwner, earnings, Extra, HouseholdData, money, nextOwner, OWNERS, Spend, uid } from '../lib/model';
import { AddRow } from './SetField';
import type { Update } from '../Household';
import { CategoryWeek, weekBudget } from '../lib/food';

/**
 * This week's budget, for checking rather than setting up: what each of you has left,
 * then one simple row per category. Tap a category to see each person's half and log a spend.
 */
export default function BudgetCard({ D, update, mon, onEdit }: { D: HouseholdData; update: Update; mon: Date; onEdit: () => void }) {
  const wk = key(mon);
  const extras = D.extras[wk] ?? [];
  const b = weekBudget(D, mon);
  const [open, setOpen] = useState<string | null>(null);
  const flexible = b.cats.filter(c => !c.fixed), fixed = b.cats.filter(c => c.fixed);

  return (
    <section className="budget-week">
      <div className="left-pair">
        {(['ella', 'jackson'] as const).map(p => (
          <div key={p} className="left-one">
            <span className="sec-label">{OWNERS[p].name} has left</span>
            <span className="left-big" style={{ color: OWNERS[p].ink }}>{money(p === 'ella' ? b.ellaLeft : b.jacksonLeft)}</span>
            <span className="note">of {money(earnings(D, p))} income</span>
          </div>
        ))}
      </div>
      <p className="note budget-sum">Spent so far {money(b.spent.total)} of {money(b.committed.total)} planned. <button className="link-btn" onClick={onEdit}>Set up budget</button></p>

      <div className="budget-block">
        <div className="sec-label">Spending</div>
        {flexible.map(c => (
          <CategoryRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(o => (o === c.id ? null : c.id))} update={update} wk={wk} />
        ))}
        {fixed.map(c => (
          <div key={c.id} className="cat-simple fixed">
            <span className="cat-simple-name">{c.name}</span>
            <span className="cat-simple-amt">{money(c.budget.total)} <span className="muted">· fixed</span></span>
          </div>
        ))}
        {!b.cats.length && <p className="note">No categories yet. <button className="link-btn" onClick={onEdit}>Set up your budget</button></p>}
      </div>
      <WeekExtras extras={extras} total={b.extra.total} update={update} wk={wk} />
    </section>
  );
}

const OVER_INK = '#B0532F';

/** A category: its name, "$37 of $180" and one bar. Tapping it opens each person's half and the spends. */
function CategoryRow({ c, open, onToggle, update, wk }: { c: CategoryWeek; open: boolean; onToggle: () => void; update: Update; wk: string }) {
  const pct = c.budget.total ? Math.min(1, c.spent.total / c.budget.total) * 100 : c.spent.total ? 100 : 0;
  const over = c.over > 0;
  return (
    <div className={'cat-simple' + (open ? ' open' : '')}>
      <button className="cat-simple-btn" onClick={onToggle} aria-expanded={open}>
        <span className="cat-simple-top">
          <span className="cat-simple-name">{c.name}{c.pct !== null && <span className="muted"> · {Math.round(c.pct)}% of left</span>}</span>
          <span className="cat-simple-amt" style={over ? { color: OVER_INK } : undefined}>
            <b>{money(c.spent.total)}</b> <span className={over ? '' : 'muted'}>{over ? money(c.over) + ' over' : 'of ' + money(c.budget.total)}</span>
          </span>
          <span className="cat-chev" aria-hidden>{open ? '−' : '+'}</span>
        </span>
        <span className="cat-bar"><span style={{ width: pct + '%', background: over ? OVER_INK : 'var(--ink)' }} /></span>
      </button>
      {open && (
        <>
          <div className="cat-halves">
            <span style={{ color: c.spent.e > c.budget.e ? OVER_INK : OWNERS.ella.ink }}>Ella {money(c.spent.e)} of {money(c.budget.e)}</span>
            <span style={{ color: c.spent.j > c.budget.j ? OVER_INK : OWNERS.jackson.ink }}>Jackson {money(c.spent.j)} of {money(c.budget.j)}</span>
          </div>
          <SpendPanel c={c} update={update} wk={wk} />
        </>
      )}
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
        <input className="field-sm compact" style={{ flex: '1 1 80px' }} value={note} onChange={e => setNote(e.target.value)} onKeyDown={onKey} placeholder="What for?" aria-label="What for" />
        <input className="field-sm compact num" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={onKey} placeholder="$" aria-label="Amount spent" />
        <button className="pill-sm dark" onClick={add}>Add</button>
      </div>
    </div>
  );
}

/** Who paid: tap to switch between Ella, Jackson and Both. Without onClick it's just a label. */
function OwnerTag({ o, onClick }: { o: ChoreOwner; onClick?: () => void }) {
  return (
    <button className="person-tag" title={onClick ? 'Who pays — tap to switch' : undefined} onClick={onClick} disabled={!onClick}
      style={{ height: onClick ? 'var(--h-sm)' : 'var(--h-xs)', minWidth: 64, padding: '0 8px', flex: 'none', fontSize: 11, opacity: 1, background: OWNERS[o].tint, color: OWNERS[o].ink, cursor: onClick ? 'pointer' : 'default' }}>{OWNERS[o].name}</button>
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

  return (
    <div className="budget-block" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="sec-label" style={{ justifyContent: 'space-between' }}>
        <span>This week only</span>
        {total > 0 && <span style={{ color: 'var(--ink)', letterSpacing: 0 }}>{money(total)}</span>}
      </div>
      {extras.map(x => (
        <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <OwnerTag o={x.who} onClick={() => edit(x.id, z => { z.who = nextOwner(z.who); })} />
          <span style={{ flex: 1, minWidth: 0 }}>{x.name}</span>
          <span>{money(+x.amount || 0)}</span>
          <button className="link-btn" aria-label={'Remove ' + x.name} onClick={() => remove(x.id)}>Remove</button>
        </div>
      ))}
      {!extras.length && !open && <span className="note">One-off costs that don’t change your regular budget.</span>}
      <AddRow label="Add a one-off cost" open={open} onOpen={() => setOpen(true)}>
        <div className="add-open-row">
          <OwnerTag o={who} onClick={() => setWho(nextOwner(who))} />
          <input className="field-sm compact" style={{ flex: '1 1 80px' }} autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="e.g. Birthday gift" aria-label="What for" />
          <input className="field-sm compact num" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="$" aria-label="Amount" />
          <button className="pill-sm dark" onClick={add}>Add</button>
          <button className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </AddRow>
    </div>
  );
}
