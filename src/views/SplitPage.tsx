import { useState } from 'react';
import { key, MON, parse } from '../lib/dates';
import { HouseholdData, money, norm, num, PEOPLE, PersonId, uid } from '../lib/model';
import { equalShares, isUs, owesFrom, pairBalance, pairOpen, pairRounds, peopleIn, renamePerson, settleUp, Txn, US, Who } from '../lib/split';
import { confirmRemove } from './confirm';
import { TagEdit } from './RecipeEditor';
import type { Update } from '../Household';

const nm = (w: Who) => (isUs(w) ? PEOPLE[w as PersonId].name : w);
const shortDate = (k: string) => { const d = parse(k); return d.getDate() + ' ' + MON[d.getMonth()]; };
const listOf = (l: string[]) => (l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]);
const ask = (q: string) => { try { return window.confirm(q); } catch { return true; } };

/** "Mia paid · split between Ella and Jackson" */
function describe(t: Txn) {
  const ks = Object.keys(t.shares).filter(k => t.shares[k] > 0);
  const eq = ks.length > 1 && ks.every(k => Math.abs(t.shares[k] - t.amount / ks.length) < 0.011);
  const how = ks.length === 1 ? 'for ' + nm(ks[0]) : eq ? 'split between ' + listOf(ks.map(nm)) : ks.map(k => nm(k) + ' ' + money(t.shares[k])).join(' · ');
  return nm(t.paidBy) + ' paid · ' + how;
}

/** "Jackson owes Ella $30", for a balance where `a` owes `b` `bal` (negative: the other way). */
const owesLine = (a: Who, b: Who, bal: number) => (bal > 0 ? nm(a) + ' owes ' + nm(b) : nm(b) + ' owes ' + nm(a)) + ' ' + money(Math.abs(bal));

/**
 * Split, Splitwise-style: each cost has a payer and the people it was for, and each pair of
 * people keeps their own balance. Separate from the budget.
 */
export default function SplitPage({ D, update }: { D: HouseholdData; update: Update }) {
  const people = peopleIn(D.txns, D.splitPeople);
  // A cost can only be removed while every balance it touches is still unsettled.
  const removable = (t: Txn) => {
    const ws = [t.paidBy, ...Object.keys(t.shares)];
    return ws.every(a => ws.every(b => a === b || (!isUs(a) && !isUs(b)) || Math.abs(owesFrom(t, a, b)) < 0.005 || pairOpen(D.txns, a, b).includes(t)));
  };
  const remove = (t: Txn) => { if (confirmRemove('“' + t.what + '”')) update(x => { x.txns = x.txns.filter(z => z.id !== t.id); }); };

  return (
    <div className="two-col">
      <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BetweenUs D={D} update={update} removable={removable} remove={remove} />
        <WithOthers D={D} update={update} people={people} removable={removable} remove={remove} />
        <p className="note" style={{ margin: '0 2px' }}>Separate from the budget: only what you add here counts.</p>
      </section>
      <AddCost D={D} update={update} people={people} />
    </div>
  );
}

type RowProps = { removable: (t: Txn) => boolean; remove: (t: Txn) => void };

function CostRow({ t, i, note, removable, remove }: { t: Txn; i: number; note?: string } & RowProps) {
  return (
    <div className="split-row" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
      <span className="split-date muted">{shortDate(t.date)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15 }}>{t.what}</div>
        <div className="note">{t.payment ? nm(t.paidBy) + ' paid ' + nm(Object.keys(t.shares)[0]) : describe(t)}</div>
        {note && <div className="note" style={{ color: 'var(--ink)' }}>{note}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, flex: 'none' }}>{money(t.amount)}</div>
      {removable(t) && <button className="link-btn" style={{ flex: 'none' }} onClick={() => remove(t)}>Remove</button>}
    </div>
  );
}

/** Ella and Jackson: one balance, the costs behind it, settle up, and the archive. */
function BetweenUs({ D, update, removable, remove }: { D: HouseholdData; update: Update } & RowProps) {
  const [showCosts, setShowCosts] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [openRound, setOpenRound] = useState<string | null>(null);
  const open = pairOpen(D.txns, 'jackson', 'ella').slice().reverse();
  const bal = pairBalance(D.txns, 'jackson', 'ella'); // what Jackson owes Ella
  const rounds = pairRounds(D.txns, 'jackson', 'ella');
  const n = open.length + ' cost' + (open.length === 1 ? '' : 's');
  const debtor: PersonId = bal > 0 ? 'jackson' : 'ella', creditor: PersonId = bal > 0 ? 'ella' : 'jackson';

  const settle = () => {
    const q = bal ? 'Record that ' + nm(debtor) + ' paid ' + nm(creditor) + ' back ' + money(Math.abs(bal)) + ', and archive these ' + n + '?' : 'These ' + n + ' come to all square. Archive them?';
    if (!ask(q)) return;
    update(x => { x.txns.push(...settleUp(x.txns, 'jackson', 'ella', key(new Date()), uid)); });
    setShowCosts(false);
  };

  return (
    <div className="card split-section">
      <div className="split-section-head"><span className="split-kicker">Between you two</span></div>
      <div className="split-hero">
        <span className="hero-mid">
          {bal === 0 ? 'All square' : <>
            <span style={{ color: PEOPLE[debtor].ink }}>{PEOPLE[debtor].name}</span> owes{' '}
            <span style={{ color: PEOPLE[creditor].ink }}>{PEOPLE[creditor].name}</span> {money(Math.abs(bal))}
          </>}
        </span>
        {open.length > 0 && <button className="pill-sm dark" onClick={settle}>{bal ? 'Settle up' : 'Archive these'}</button>}
      </div>
      <div className="row" style={{ gap: 14, marginTop: 6 }}>
        {open.length > 0 && <button className="link-btn" onClick={() => setShowCosts(v => !v)}>{showCosts ? 'Hide costs' : 'Show the ' + n}</button>}
        {rounds.length > 0 && <button className="link-btn" onClick={() => setShowArchive(v => !v)}>{showArchive ? 'Hide archive' : 'Archive (' + rounds.length + ')'}</button>}
        {!open.length && !rounds.length && <span className="note">Nothing yet. Add a cost with both of you in it.</span>}
      </div>
      {showCosts && (
        <div className="split-list">
          {open.map((t, i) => {
            const e = owesFrom(t, 'jackson', 'ella');
            return <CostRow key={t.id} t={t} i={i} note={(e > 0 ? 'Jackson owes ' : 'Ella owes ') + money(Math.abs(e))} removable={removable} remove={remove} />;
          })}
        </div>
      )}
      {showArchive && (
        <div className="split-list">
          {rounds.map((r, i) => {
            const isOpen = openRound === r.settle.id;
            return (
              <div key={r.settle.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '10px 0' }}>
                <div className="split-row" style={{ padding: 0 }}>
                  <span className="split-date muted">{shortDate(r.settle.date)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15 }}>✓ {r.settle.amount ? nm(r.settle.paidBy) + ' paid ' + nm(Object.keys(r.settle.shares)[0]) + ' ' + money(r.settle.amount) : 'Archived · all square'}</div>
                    <button className="link-btn note" onClick={() => setOpenRound(isOpen ? null : r.settle.id)}>{isOpen ? 'Hide' : 'Show'} {r.items.length} cost{r.items.length === 1 ? '' : 's'}</button>
                  </div>
                  {i === 0 && <button className="link-btn" style={{ flex: 'none' }} onClick={() => { if (ask('Undo this settle-up? Its costs go back to unsettled.')) update(x => { x.txns = x.txns.filter(z => z.id !== r.settle.id); }); }}>Undo</button>}
                </div>
                {isOpen && <div className="split-archived">{r.items.slice().reverse().map((t, j) => <CostRow key={t.id} t={t} i={j} removable={() => false} remove={remove} />)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Everyone else: one row per person, with Ella's and Jackson's own balances side by side. */
function WithOthers({ D, update, people, removable, remove }: { D: HouseholdData; update: Update; people: string[] } & RowProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const rows = people.map(p => ({ p, ella: pairBalance(D.txns, 'ella', p), jackson: pairBalance(D.txns, 'jackson', p) }))
    .filter(r => r.ella || r.jackson || pairOpen(D.txns, 'ella', r.p).length || pairOpen(D.txns, 'jackson', r.p).length);
  const past = D.txns.filter(t => t.settle && !(isUs(t.paidBy) && Object.keys(t.shares).every(isUs))).reverse();
  const total = (me: PersonId) => [rows.reduce((s, r) => s + Math.max(0, r[me]), 0), rows.reduce((s, r) => s + Math.max(0, -r[me]), 0)] as const;
  const cell = (v: number) => v > 0 ? <span className="bal owe">owes {money(v)}</span> : v < 0 ? <span className="bal owed">is owed {money(-v)}</span> : <span className="bal even">—</span>;

  return (
    <div className="card split-section">
      <div className="split-section-head">
        <span className="split-kicker">With other people</span>
        <span className="note">Each of you has your own balance with each person</span>
      </div>
      {rows.length > 0 ? (
        <div className="others-table" role="table">
          <div className="others-row others-headrow" role="row">
            <span role="columnheader" />
            {US.map(me => {
              const [owe, owed] = total(me);
              return (
                <span key={me} role="columnheader">
                  <span style={{ color: PEOPLE[me].ink, fontWeight: 600 }}>{PEOPLE[me].name}</span>
                  <span className="note others-tot">{owe ? 'owes ' + money(owe) : ''}{owe && owed ? ' · ' : ''}{owed ? 'owed ' + money(owed) : ''}{!owe && !owed ? 'all square' : ''}</span>
                </span>
              );
            })}
          </div>
          {rows.map(r => {
            const on = sel === r.p;
            return (
              <div key={r.p}>
                <button className={'others-row others-line' + (on ? ' on' : '')} role="row" aria-expanded={on} onClick={() => setSel(on ? null : r.p)}>
                  <span className="others-name" role="cell">{r.p}</span>
                  <span role="cell">{cell(r.ella)}</span>
                  <span role="cell">{cell(r.jackson)}</span>
                </button>
                {on && <PersonDetail D={D} update={update} person={r.p} removable={removable} remove={remove} onClose={() => setSel(null)} />}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="note" style={{ margin: '4px 0 0' }}>Nobody yet. When you add a cost, tap + Person to add a friend, and they’ll appear here.</p>
      )}
      {rows.length > 0 && !sel && <p className="note" style={{ margin: '8px 0 0' }}>Tap a name to see the costs, or to settle up.</p>}
      {past.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button className="link-btn note" onClick={() => setShowPast(v => !v)}>{showPast ? 'Hide past settle-ups' : 'Past settle-ups (' + past.length + ')'}</button>
          {showPast && past.map(t => (
            <div key={t.id} className="note" style={{ padding: '4px 0' }}>
              {shortDate(t.date)} · ✓ {t.amount ? nm(t.paidBy) + ' paid ' + nm(Object.keys(t.shares)[0]) + ' ' + money(t.amount) : nm(t.paidBy) + ' and ' + nm(Object.keys(t.shares)[0]) + ' all square'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonDetail({ D, update, person, removable, remove, onClose }: { D: HouseholdData; update: Update; person: string; onClose: () => void } & RowProps) {
  const [via, setVia] = useState<Partial<Record<PersonId, PersonId>>>({});
  const [payFor, setPayFor] = useState<PersonId | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const costs = D.txns.filter(t => US.some(me => pairOpen(D.txns, me, person).includes(t))).reverse();

  const settle = (me: PersonId) => {
    const bal = pairBalance(D.txns, me, person), by = via[me] ?? me;
    const q = bal === 0 ? nm(me) + ' and ' + person + ' are even. Archive these?'
      : 'Record that ' + (bal > 0 ? nm(by) + ' paid ' + person + ' ' + money(bal) + (by !== me ? ' for ' + nm(me) : '') : person + ' paid ' + nm(by) + ' ' + money(-bal) + (by !== me ? ' (' + nm(me) + '’s money)' : '')) + ', and archive?';
    if (!ask(q)) return;
    update(x => { x.txns.push(...settleUp(x.txns, me, person, key(new Date()), uid, by !== me ? by : undefined)); });
  };
  const pay = (me: PersonId) => {
    const bal = pairBalance(D.txns, me, person), a = Math.round(num(payAmt) * 100) / 100;
    if (!(a > 0) || !bal) return;
    const t: Txn = bal > 0
      ? { id: uid(), date: key(new Date()), what: 'Part-payment', amount: a, paidBy: me, shares: { [person]: a }, payment: true }
      : { id: uid(), date: key(new Date()), what: 'Part-payment', amount: a, paidBy: person, shares: { [me]: a }, payment: true };
    update(x => { x.txns.push(t); });
    setPayAmt(''); setPayFor(null);
  };

  return (
    <div className="other-detail">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{person}</div>
        <button className="x-btn" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {US.map(me => {
        const bal = pairBalance(D.txns, me, person), n = pairOpen(D.txns, me, person).length;
        if (!bal && !n) return null;
        const other: PersonId = me === 'ella' ? 'jackson' : 'ella', by = via[me] ?? me;
        return (
          <div key={me} className="pair-line">
            <span style={{ flex: '1 1 160px', fontSize: 14, color: PEOPLE[me].ink, fontWeight: 600 }}>{bal ? owesLine(me, person, bal) : nm(me) + ' and ' + person + ' are even'}</span>
            {bal !== 0 && (
              <label className="note" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={by === other} onChange={e => setVia(v => ({ ...v, [me]: e.target.checked ? other : me }))} />
                {bal > 0 ? nm(other) + ' paid it' : 'Paid to ' + nm(other)}
              </label>
            )}
            <button className="pill-sm dark" onClick={() => settle(me)}>{bal ? 'Settle up' : 'Archive'}</button>
            {bal !== 0 && payFor !== me && <button className="link-btn" onClick={() => { setPayFor(me); setPayAmt(''); }}>Part-payment</button>}
            {payFor === me && (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexBasis: '100%' }}>
                <span className="note">{bal > 0 ? nm(me) + ' paid ' + person : person + ' paid ' + nm(me)}</span>
                <input className="field-sm compact money" value={payAmt} onChange={e => setPayAmt(e.target.value)} inputMode="decimal" placeholder="$0" aria-label="Amount paid" />
                <button className="pill-sm" onClick={() => pay(me)}>Save</button>
                <button className="link-btn" onClick={() => setPayFor(null)}>Cancel</button>
              </span>
            )}
          </div>
        );
      })}
      <div style={{ marginTop: 6 }}>
        {costs.map((t, i) => {
          const notes = US.map(me => { const e = owesFrom(t, me, person); return Math.abs(e) < 0.005 ? '' : e > 0 ? nm(me) + ' owes ' + money(e) : nm(me) + ' is owed ' + money(-e); }).filter(Boolean).join(' · ');
          return <CostRow key={t.id} t={t} i={i} note={notes} removable={removable} remove={remove} />;
        })}
      </div>
    </div>
  );
}

/** One form for every cost: who paid, who it was for, and how it's split. */
function AddCost({ D, update, people }: { D: HouseholdData; update: Update; people: string[] }) {
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(key(new Date()));
  const [paidBy, setPaidBy] = useState<Who>(() => [...D.txns].reverse().find(t => !t.settle && isUs(t.paidBy))?.paidBy ?? 'ella');
  const [forWho, setForWho] = useState<Who[]>(['ella', 'jackson']);
  const [custom, setCustom] = useState(false);
  const [parts, setParts] = useState<Record<Who, string>>({});
  const [newName, setNewName] = useState<string | null>(null);
  const [editPeople, setEditPeople] = useState(false);

  const everyone: Who[] = ['ella', 'jackson', ...people];
  const amt = Math.round(num(amount) * 100) / 100;
  const shares: Record<Who, number> = custom
    ? Object.fromEntries(forWho.map(w => [w, Math.round(num(parts[w]) * 100) / 100]))
    : forWho.length ? equalShares(amt, forWho) : {};
  const left = Math.round((amt - Object.values(shares).reduce((s, v) => s + v, 0)) * 100) / 100;
  const onlyOthers = !isUs(paidBy) && !forWho.some(isUs);
  const ok = !!what.trim() && amt > 0 && forWho.length > 0 && (!custom || left === 0) && !(forWho.length === 1 && forWho[0] === paidBy) && !onlyOthers;
  // What adding this would do, in words, so it's clear before you add it.
  const preview: Txn = { id: '', date, what, amount: amt, paidBy, shares };
  const pairs: [Who, Who][] = [['jackson', 'ella'], ...US.flatMap(me => people.map(p => [me, p] as [Who, Who]))];
  const effects = amt > 0 ? pairs.map(([a, b]) => ({ a, b, v: owesFrom(preview, a, b) })).filter(e => Math.abs(e.v) >= 0.005).map(e => owesLine(e.a, e.b, e.v)) : [];

  const toggleFor = (w: Who) => setForWho(f => (f.includes(w) ? f.filter(x => x !== w) : [...f, w]));
  const addPerson = () => {
    const n = (newName ?? '').trim();
    setNewName(null);
    if (!n) return;
    const existing = everyone.find(w => norm(nm(w)) === norm(n));
    if (!existing) update(x => { x.splitPeople.push(n); });
    const w = existing ?? n;
    setForWho(f => (f.includes(w) ? f : [...f, w]));
  };
  const add = () => {
    if (!ok) return;
    const clean = Object.fromEntries(Object.entries(shares).filter(([, v]) => v > 0));
    const t: Txn = { id: uid(), date: date || key(new Date()), what: what.trim(), amount: amt, paidBy, shares: clean };
    update(x => { x.txns.push(t); });
    setWhat(''); setAmount(''); setParts({}); setCustom(false); setDate(key(new Date()));
  };
  const rename = (from: string, to: string) => {
    const n = to.trim();
    if (!n || everyone.some(w => w !== from && norm(nm(w)) === norm(n))) return;
    update(x => { renamePerson(x.txns, from, n); x.splitPeople = x.splitPeople.map(p => (p === from ? n : p)); if (!x.splitPeople.includes(n)) x.splitPeople.push(n); });
    setForWho(f => f.map(w => (w === from ? n : w)));
    if (paidBy === from) setPaidBy(n);
  };
  const removePerson = (p: string) => {
    if (D.txns.some(t => t.paidBy === p || p in t.shares)) { try { window.alert(p + ' has costs saved, so they can’t be removed. You can rename them instead.'); } catch { /* no dialogs */ } return; }
    update(x => { x.splitPeople = x.splitPeople.filter(z => z !== p); });
    setForWho(f => f.filter(w => w !== p));
    if (paidBy === p) setPaidBy('ella');
  };

  const chip = (w: Who, on: boolean, onClick: () => void) => {
    const us = isUs(w) ? PEOPLE[w as PersonId] : null;
    return (
      <button key={w} className={'who-chip' + (on ? ' on' : '')} aria-pressed={on} onClick={onClick}
        style={us ? { borderColor: us.color, background: on ? us.color : '#fff', color: on ? '#fff' : us.ink } : undefined}>{nm(w)}</button>
    );
  };

  return (
    <aside className="add-panel" style={{ marginBottom: 0 }}>
      <div className="add-panel-title">+ Add a cost</div>
      <input className="field-sm compact" value={what} onChange={e => setWhat(e.target.value)} placeholder="What, e.g. Dinner at Chin Chin" aria-label="What" />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="field-sm compact" style={{ flex: 1, minWidth: 0 }} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$ Amount" aria-label="Amount" />
        <input className="field-sm compact" style={{ flex: 1, minWidth: 0 }} type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
      </div>

      <div className="note">Paid by</div>
      <div className="who-row" role="group" aria-label="Paid by">{everyone.map(w => chip(w, paidBy === w, () => setPaidBy(w)))}</div>

      <div className="note">For</div>
      <div className="who-row" role="group" aria-label="For">
        {everyone.map(w => chip(w, forWho.includes(w), () => toggleFor(w)))}
        {newName === null
          ? <button className="who-chip add" onClick={() => setNewName('')}>+ Person</button>
          : <input className="field-sm compact" style={{ width: 120 }} autoFocus value={newName} placeholder="Name" aria-label="New person"
              onChange={e => setNewName(e.target.value)} onBlur={addPerson} onKeyDown={e => { if (e.key === 'Enter') addPerson(); if (e.key === 'Escape') setNewName(null); }} />}
      </div>
      {people.length > 0 && (
        <div>
          <button className="link-btn note" onClick={() => setEditPeople(v => !v)}>{editPeople ? 'Done' : 'Edit people'}</button>
          {editPeople && <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>{people.map(p => <TagEdit key={p} tag={p} onRename={n => rename(p, n)} onDelete={() => removePerson(p)} />)}</div>}
        </div>
      )}

      {forWho.length > 1 && (
        <div className="seg" role="group" aria-label="How to split" style={{ alignSelf: 'flex-start' }}>
          <button className={!custom ? 'on' : ''} aria-pressed={!custom} onClick={() => setCustom(false)}>Equally</button>
          <button className={custom ? 'on' : ''} aria-pressed={custom} onClick={() => setCustom(true)}>Custom amounts</button>
        </div>
      )}
      {custom && forWho.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {forWho.map(w => (
            <label key={w} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <span style={{ flex: 1 }}>{nm(w)}</span>
              <input className="field-sm compact money" value={parts[w] ?? ''} onChange={e => setParts(p => ({ ...p, [w]: e.target.value }))} inputMode="decimal" placeholder="$0" aria-label={nm(w) + '’s share'} />
            </label>
          ))}
          <span className="note" style={{ color: left ? '#B0563F' : undefined }}>{left === 0 ? 'Adds up ✓' : left > 0 ? money(left) + ' still to assign' : money(-left) + ' too much'}</span>
        </div>
      )}

      {effects.length > 0 && ok && <div className="split-preview">{effects.map(e => <div key={e}>{e}</div>)}</div>}
      {onlyOthers && forWho.length > 0 && <div className="note">Include Ella or Jackson: costs only between other people aren’t tracked.</div>}
      <button className="pill-sm dark" onClick={add} disabled={!ok}>Add</button>
    </aside>
  );
}
