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
  const [shareText, setShareText] = useState('');
  const [shareOf, setShareOf] = useState<PersonId>('ella');
  const [showArchive, setShowArchive] = useState(false);
  const [openRound, setOpenRound] = useState<string | null>(null);

  // Each settle-up closes a round. Rounds follow the order things were added, so a cost
  // back-dated after settling still counts as unsettled.
  const rounds: { settle: SplitEntry; items: SplitEntry[] }[] = [];
  let open: SplitEntry[] = [];
  for (const e of D.splits) {
    if (e.settle) { rounds.push({ settle: e, items: open }); open = []; } else open.push(e);
  }
  const newestFirst = (l: SplitEntry[]) => l.map((e, i) => ({ e, i })).sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i).map(x => x.e);
  const current = newestFirst(open);
  const archive = rounds.slice().reverse();
  const bal = splitBalance(open);
  const owed: PersonId | null = bal > 0 ? 'ella' : bal < 0 ? 'jackson' : null;
  const owes = owed && otherPerson(owed);

  // Custom: type either person's share; the other person's is the rest.
  const amt = num(amount), share = num(shareText);
  const customBad = how === 'custom' && (!shareText.trim() || share < 0 || share > amt);
  const otherShare = Math.round((amt - share) * 100) / 100;
  const add = () => {
    if (!what.trim() || !(amt > 0) || customBad) return;
    const e: SplitEntry = { id: uid(), date: date || key(new Date()), what: what.trim(), amount: Math.round(amt * 100) / 100, paidBy, forWho: how === 'custom' ? 'both' : how };
    if (how === 'custom') e.ellaShare = shareOf === 'ella' ? Math.round(share * 100) / 100 : otherShare;
    update(x => { x.splits.push(e); });
    setWhat(''); setAmount(''); setShareText(''); setHow('both'); setDate(key(new Date()));
  };

  const costs = current.length + ' cost' + (current.length === 1 ? '' : 's');
  /** Record the payment (if any) and archive everything since the last settle-up. */
  const settle = () => {
    if (!current.length) return;
    const ask = owed && owes
      ? 'Record that ' + PEOPLE[owes].name + ' paid ' + PEOPLE[owed].name + ' back ' + money(Math.abs(bal)) + ', and archive these ' + costs + '?'
      : 'These ' + costs + ' come to all square. Archive them?';
    try { if (!window.confirm(ask)) return; } catch { /* no dialogs */ }
    const e: SplitEntry = owed && owes
      ? { id: uid(), date: key(new Date()), what: 'Settled up', amount: Math.abs(bal), paidBy: owes, forWho: owed, settle: true }
      : { id: uid(), date: key(new Date()), what: 'Settled up', amount: 0, paidBy: 'ella', forWho: 'jackson', settle: true };
    update(x => { x.splits.push(e); });
  };
  const undoSettle = (r: { settle: SplitEntry; items: SplitEntry[] }) => {
    const n = r.items.length + ' cost' + (r.items.length === 1 ? '' : 's');
    try { if (!window.confirm('Undo this settle-up? Its ' + n + ' go back to unsettled.')) return; } catch { /* no dialogs */ }
    update(x => { x.splits = x.splits.filter(z => z.id !== r.settle.id); });
  };
  const settledText = (e: SplitEntry) => e.amount > 0
    ? PEOPLE[e.paidBy].name + ' paid ' + PEOPLE[otherPerson(e.paidBy)].name + ' ' + money(e.amount)
    : 'all square';

  const row = (e: SplitEntry, i: number, archived = false) => {
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
        {!archived && (
          <button className="link-btn" style={{ flex: 'none' }}
            onClick={() => { if (confirmRemove('“' + e.what + '”')) update(x => { x.splits = x.splits.filter(z => z.id !== e.id); }); }}>Remove</button>
        )}
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
          {current.length > 0 && <button className="pill-sm dark" onClick={settle}>{owed ? 'Settle up' : 'Archive these'}</button>}
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div className="card-title">Unsettled<span className="sub">{current.length ? costs : ''}</span></div>
          {current.map((e, i) => row(e, i))}
          {!current.length && <p className="empty">{archive.length ? 'Nothing since you last settled up.' : 'Nothing yet. Add a shared cost when one of you pays for something together.'}</p>}
        </div>

        {archive.length > 0 && (
          <div>
            <button className="link-btn" onClick={() => setShowArchive(v => !v)}>
              {showArchive ? 'Hide archive' : 'Archive · ' + archive.length + ' settle-up' + (archive.length === 1 ? '' : 's')}
            </button>
            {showArchive && (
              <div className="card" style={{ padding: '6px 18px', marginTop: 8 }}>
                {archive.map((r, i) => {
                  const isOpen = openRound === r.settle.id;
                  return (
                    <div key={r.settle.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '10px 0' }}>
                      <div className="split-row" style={{ padding: 0 }}>
                        <span className="split-date muted">{shortDate(r.settle.date)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15 }}>✓ Settled · {settledText(r.settle)}</div>
                          <button className="link-btn note" onClick={() => setOpenRound(isOpen ? null : r.settle.id)}>
                            {isOpen ? 'Hide' : 'Show'} {r.items.length} cost{r.items.length === 1 ? '' : 's'}
                          </button>
                        </div>
                        {i === 0 && <button className="link-btn" style={{ flex: 'none' }} onClick={() => undoSettle(r)}>Undo</button>}
                      </div>
                      {isOpen && <div className="split-archived">{newestFirst(r.items).map((e, j) => row(e, j, true))}</div>}
                    </div>
                  );
                })}
              </div>
            )}
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
            <div className="seg" role="group" aria-label="Whose share to enter">
              {(['ella', 'jackson'] as PersonId[]).map(p => (
                <button key={p} className={shareOf === p ? 'on' : ''} aria-pressed={shareOf === p}
                  onClick={() => { if (p !== shareOf && shareText.trim() && amt > 0 && !customBad) setShareText(String(otherShare)); setShareOf(p); }}>{PEOPLE[p].name}’s</button>
              ))}
            </div>
            <input className="field-sm compact money" value={shareText} onChange={e => setShareText(e.target.value)} inputMode="decimal" placeholder="$0" aria-label={PEOPLE[shareOf].name + '’s share'} />
            <span className="muted">{PEOPLE[otherPerson(shareOf)].name}’s: {amt > 0 && !customBad ? money(otherShare) : '—'}</span>
          </div>
        )}
        <button className="pill-sm dark" onClick={add} disabled={!what.trim() || !(amt > 0) || customBad}>Add</button>
      </aside>
    </div>
  );
}
