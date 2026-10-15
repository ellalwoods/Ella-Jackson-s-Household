import { useState } from 'react';
import { key, MON, parse } from '../lib/dates';
import { ChoreOwner, ellaPart, HouseholdData, money, num, otherPerson, PEOPLE, PersonId, SplitEntry, splitBalance, uid } from '../lib/model';
import { confirmRemove } from './confirm';
import type { Update } from '../Household';

type SplitHow = ChoreOwner | 'custom';
const HOW: [SplitHow, string][] = [['both', 'Equally'], ['ella', 'All Ella’s'], ['jackson', 'All Jackson’s'], ['custom', 'Custom']];

const shortDate = (k: string) => { const d = parse(k); return d.getDate() + ' ' + MON[d.getMonth()]; };

/** How an entry was shared, in words: "Ella paid · split equally". */
function detail(e: SplitEntry) {
  const payer = PEOPLE[e.paidBy].name;
  if (e.forWho === 'both' && e.ellaShare != null) return payer + ' paid · Ella ' + money(e.ellaShare) + ', Jackson ' + money(e.amount - e.ellaShare);
  if (e.forWho === 'both') return payer + ' paid · split equally';
  return payer + ' paid · all ' + PEOPLE[e.forWho].name + '’s';
}

/**
 * Split: shared costs one of you paid, and who owes whom. Completely separate from the
 * budget; only what you add here counts.
 */
export default function SplitPage({ D, update }: { D: HouseholdData; update: Update }) {
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(key(new Date()));
  const [paidBy, setPaidBy] = useState<PersonId>(() => [...D.splits].reverse().find(e => !e.settle)?.paidBy ?? 'ella');
  const [how, setHow] = useState<SplitHow>('both');
  const [ellaShare, setEllaShare] = useState('');
  const [showOld, setShowOld] = useState(false);

  // Newest first; everything after the last settle-up is what the balance is made of.
  const all = D.splits.map((e, i) => ({ e, i })).sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i).map(x => x.e);
  const lastSettle = all.findIndex(e => e.settle);
  const current = lastSettle < 0 ? all : all.slice(0, lastSettle);
  const earlier = lastSettle < 0 ? [] : all.slice(lastSettle);
  const bal = splitBalance(D.splits);
  const owed: PersonId | null = bal > 0 ? 'ella' : bal < 0 ? 'jackson' : null;
  const owes = owed && otherPerson(owed);

  const amt = num(amount), share = num(ellaShare);
  const customBad = how === 'custom' && (!ellaShare.trim() || share < 0 || share > amt);
  const add = () => {
    if (!what.trim() || !(amt > 0) || customBad) return;
    const e: SplitEntry = { id: uid(), date: date || key(new Date()), what: what.trim(), amount: Math.round(amt * 100) / 100, paidBy, forWho: how === 'custom' ? 'both' : how };
    if (how === 'custom') e.ellaShare = Math.round(share * 100) / 100;
    update(x => { x.splits.push(e); });
    setWhat(''); setAmount(''); setEllaShare(''); setHow('both');
  };

  const settle = () => {
    if (!owed || !owes) return;
    const text = PEOPLE[owes].name + ' paid ' + PEOPLE[owed].name + ' back ' + money(Math.abs(bal));
    try { if (!window.confirm('Record that ' + text + '?')) return; } catch { /* no dialogs */ }
    const e: SplitEntry = { id: uid(), date: key(new Date()), what: 'Settled up', amount: Math.abs(bal), paidBy: owes, forWho: owed, settle: true };
    update(x => { x.splits.push(e); });
  };

  const row = (e: SplitEntry, i: number) => {
    const effect = (e.paidBy === 'ella' ? e.amount : 0) - ellaPart(e); // + means Jackson owes Ella more
    return (
      <div key={e.id} className="split-row" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
        <span className="split-date muted">{shortDate(e.date)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {e.settle ? (
            <div style={{ fontSize: 15 }}>✓ {PEOPLE[e.paidBy].name} paid {PEOPLE[otherPerson(e.paidBy)].name} back</div>
          ) : (
            <>
              <div style={{ fontSize: 15 }}>{e.what}</div>
              <div className="note">{detail(e)}</div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{money(e.amount)}</div>
          {!e.settle && Math.abs(effect) >= 0.005 && (
            <div className="note" title="What this adds to the balance">
              {effect > 0 ? 'Jackson owes ' + money(effect) : 'Ella owes ' + money(-effect)}
            </div>
          )}
        </div>
        <button className="link-btn" style={{ flex: 'none' }}
          onClick={() => { if (confirmRemove('“' + (e.settle ? 'Settled up' : e.what) + '”')) update(x => { x.splits = x.splits.filter(z => z.id !== e.id); }); }}>Remove</button>
      </div>
    );
  };

  const pickPayer = (p: PersonId) => {
    const on = paidBy === p, c = PEOPLE[p];
    return (
      <button key={p} className="owner-pick" aria-pressed={on} onClick={() => setPaidBy(p)}
        style={{ borderColor: c.color, background: on ? c.color : '#fff', color: on ? '#fff' : c.ink }}>{c.name}</button>
    );
  };

  return (
    <div className="two-col">
      <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card split-hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="hero-label">Balance</span>
            {owed && owes ? (
              <span className="hero-mid">
                <span style={{ color: PEOPLE[owes].ink }}>{PEOPLE[owes].name}</span> owes{' '}
                <span style={{ color: PEOPLE[owed].ink }}>{PEOPLE[owed].name}</span> {money(Math.abs(bal))}
              </span>
            ) : (
              <span className="hero-mid">All square</span>
            )}
          </div>
          {owed && <button className="pill-sm dark" onClick={settle}>Settle up</button>}
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div className="card-title">{earlier.length ? 'Since you last settled' : 'Shared costs'}</div>
          {current.map(row)}
          {!current.length && <p className="empty">{earlier.length ? 'Nothing since you settled up.' : 'Nothing yet. Add a shared cost when one of you pays for something together.'}</p>}
        </div>

        {earlier.length > 0 && (
          <div>
            <button className="link-btn" onClick={() => setShowOld(v => !v)}>{showOld ? 'Hide earlier' : 'Show earlier (' + earlier.length + ')'}</button>
            {showOld && <div className="card" style={{ padding: '6px 18px', marginTop: 8, opacity: 0.8 }}>{earlier.map(row)}</div>}
          </div>
        )}
        <p className="note" style={{ margin: '0 2px' }}>Separate from the budget: only what you add here counts.</p>
      </section>

      <aside className="add-panel" style={{ marginBottom: 0 }}>
        <div className="add-panel-title">+ Add a shared cost</div>
        <input className="field-sm compact" value={what} onChange={e => setWhat(e.target.value)} placeholder="What, e.g. Dinner at Chin Chin" aria-label="What" />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-sm compact" style={{ flex: 1, minWidth: 0 }} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$ Amount" aria-label="Amount" />
          <input className="field-sm compact" style={{ flex: 1, minWidth: 0 }} type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
        </div>
        <div className="note">Paid by</div>
        <div style={{ display: 'flex', gap: 6 }}>{(['ella', 'jackson'] as PersonId[]).map(pickPayer)}</div>
        <div className="note">Who it was for</div>
        <div className="seg" role="group" aria-label="Who it was for" style={{ alignSelf: 'flex-start', flexWrap: 'wrap', borderRadius: 18 }}>
          {HOW.map(([h, label]) => (
            <button key={h} className={how === h ? 'on' : ''} aria-pressed={how === h} onClick={() => setHow(h)}>{label}</button>
          ))}
        </div>
        {how === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, flexWrap: 'wrap' }}>
            Ella’s share <input className="field-sm compact money" value={ellaShare} onChange={e => setEllaShare(e.target.value)} inputMode="decimal" placeholder="$0" aria-label="Ella’s share" />
            <span className="muted">Jackson’s: {amt > 0 && !customBad ? money(Math.round((amt - share) * 100) / 100) : '—'}</span>
          </div>
        )}
        <button className="pill-sm dark" onClick={add} disabled={!what.trim() || !(amt > 0) || customBad}>Add</button>
      </aside>
    </div>
  );
}
