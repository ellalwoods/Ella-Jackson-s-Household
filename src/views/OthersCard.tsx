import { useState } from 'react';
import { key, MON, parse } from '../lib/dates';
import { HouseholdData, money, norm, num, OtherEntry, otherOpen, otherPos, PEOPLE, PersonId, settleOther, uid } from '../lib/model';
import { confirmRemove } from './confirm';
import type { Update } from '../Household';

const shortDate = (k: string) => { const d = parse(k); return d.getDate() + ' ' + MON[d.getMonth()]; };
const whoseText = (e: OtherEntry) => e.whose === 'both' ? 'both of you' : PEOPLE[e.whose].name;

/** One line per person: the running total, in the column for which way it goes. */
export function otherTotals(D: HouseholdData) {
  const names = new Map<string, string>();
  for (const e of D.others) if (!names.has(norm(e.person))) names.set(norm(e.person), e.person);
  return [...names.values()].map(name => {
    const open = otherOpen(D.others, name), pos = otherPos(open);
    return { name, open, pos, total: Math.round((pos.ella + pos.jackson) * 100) / 100 };
  }).filter(p => p.open.length);
}

/**
 * Money with people outside the household: two columns of running totals (what you owe,
 * what you're owed). Tap a name for the costs behind it, a part-payment or a settle-up.
 */
export default function OthersCard({ D, update, onAdd }: { D: HouseholdData; update: Update; onAdd: () => void }) {
  const [openName, setOpenName] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const past = D.others.filter(e => e.settle).reverse();
  const people = otherTotals(D);
  const owe = people.filter(p => p.total < 0).sort((a, b) => a.total - b.total);
  const owed = people.filter(p => p.total > 0).sort((a, b) => b.total - a.total);
  const even = people.filter(p => p.total === 0);
  const sum = (l: typeof people) => Math.abs(l.reduce((t, p) => t + p.total, 0));
  const sel = people.find(p => norm(p.name) === norm(openName ?? ''));

  const line = (p: (typeof people)[number]) => {
    const on = sel?.name === p.name;
    return (
      <button key={p.name} className={'other-line' + (on ? ' on' : '')} aria-expanded={on} onClick={() => setOpenName(on ? null : p.name)}>
        <span className="other-name">{p.name}</span>
        <span className="other-amt">{money(Math.abs(p.total))}</span>
      </button>
    );
  };

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div className="card-title">Other people<button className="link-btn card-title-end" onClick={onAdd}>+ Add someone</button></div>
      <div className="other-cols">
        <div>
          <div className="other-head">You owe{owe.length > 0 && <span> · {money(sum(owe))}</span>}</div>
          {owe.map(line)}
          {!owe.length && <p className="note" style={{ margin: '6px 0' }}>Nobody</p>}
        </div>
        <div>
          <div className="other-head">Owed to you{owed.length > 0 && <span> · {money(sum(owed))}</span>}</div>
          {owed.map(line)}
          {!owed.length && <p className="note" style={{ margin: '6px 0' }}>Nobody</p>}
        </div>
      </div>
      {even.length > 0 && (
        <div className="note" style={{ marginTop: 8 }}>
          Even with:{' '}
          {even.map((p, i) => <span key={p.name}>{i ? ', ' : ''}<button className="link-btn note" onClick={() => setOpenName(sel?.name === p.name ? null : p.name)}>{p.name}</button></span>)}
        </div>
      )}
      {!sel && people.length > 0 && <p className="note" style={{ margin: '8px 0 0' }}>Tap a name to see what it’s made up of, or to settle up.</p>}
      {sel && <PersonDetail D={D} update={update} p={sel} onClose={() => setOpenName(null)} />}
      {!people.length && <p className="note" style={{ margin: '8px 0 0' }}>{D.others.length ? 'Everyone’s settled up.' : 'Money you owe friends or family, or they owe you. Each person is kept as one running total.'}</p>}
      {past.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button className="link-btn note" onClick={() => setShowPast(v => !v)}>{showPast ? 'Hide past settle-ups' : 'Past settle-ups (' + past.length + ')'}</button>
          {showPast && past.map(e => (
            <div key={e.id} className="note" style={{ padding: '4px 0' }}>
              {shortDate(e.date)} · ✓ {e.amount === 0 ? 'Even with ' + e.person : e.dir === 'they' ? e.person + ' paid ' + PEOPLE[e.whose as PersonId].name + ' ' + money(e.amount) : PEOPLE[e.whose as PersonId].name + ' paid ' + e.person + ' ' + money(e.amount)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonDetail({ D, update, p, onClose }: {
  D: HouseholdData; update: Update; p: ReturnType<typeof otherTotals>[number]; onClose: () => void;
}) {
  const { name, open, pos, total } = p;
  const both = Math.abs(pos.ella) >= 0.005 && Math.abs(pos.jackson) >= 0.005;
  const [by, setBy] = useState<PersonId>(Math.abs(pos.ella) >= Math.abs(pos.jackson) ? 'ella' : 'jackson');
  const [payAmt, setPayAmt] = useState('');
  const [payBy, setPayBy] = useState<PersonId>(by);
  const [showPay, setShowPay] = useState(false);

  const head = total < 0 ? 'You owe ' + name + ' ' + money(-total) : total > 0 ? name + ' owes you ' + money(total) : 'You’re even with ' + name;
  const split = both ? 'Ella ' + (pos.ella < 0 ? 'owes ' : 'is owed ') + money(Math.abs(pos.ella)) + ' · Jackson ' + (pos.jackson < 0 ? 'owes ' : 'is owed ') + money(Math.abs(pos.jackson)) : '';

  const settle = () => {
    const ask = total === 0
      ? 'You’re even with ' + name + '. Archive these?'
      : (total > 0 ? 'Record that ' + name + ' paid ' + PEOPLE[by].name + ' ' + money(total) : 'Record that ' + PEOPLE[by].name + ' paid ' + name + ' ' + money(-total)) + ', and archive these?';
    try { if (!window.confirm(ask)) return; } catch { /* no dialogs */ }
    const { marker, couple } = settleOther(D.others, name, by, key(new Date()));
    update(x => { x.others.push(marker); if (couple) x.splits.push(couple); });
    onClose();
  };

  const pay = () => {
    const a = Math.round(num(payAmt) * 100) / 100;
    if (!(a > 0) || total === 0) return;
    // Money handed over reduces what's owed: they paid us back, or we paid them.
    const e: OtherEntry = total > 0
      ? { id: uid(), date: key(new Date()), person: name, what: name + ' paid ' + PEOPLE[payBy].name, amount: a, dir: 'we', whose: payBy, payment: true }
      : { id: uid(), date: key(new Date()), person: name, what: PEOPLE[payBy].name + ' paid ' + name, amount: a, dir: 'they', whose: payBy, payment: true };
    update(x => { x.others.push(e); });
    setPayAmt(''); setShowPay(false);
  };

  const pick = (set: (p: PersonId) => void, cur: PersonId, label: string) => (
    <div className="seg" role="group" aria-label={label}>
      {(['ella', 'jackson'] as PersonId[]).map(q => (
        <button key={q} className={cur === q ? 'on' : ''} aria-pressed={cur === q} onClick={() => set(q)}>{PEOPLE[q].name}</button>
      ))}
    </div>
  );

  return (
    <div className="other-detail">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{head}</div>
        <button className="x-btn" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {split && <div className="note">{split}</div>}
      <div style={{ marginTop: 6 }}>
        {[...open].reverse().map((e, i) => (
          <div key={e.id} className="split-row" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '8px 0' }}>
            <span className="split-date muted">{shortDate(e.date)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{e.what}</div>
              <div className="note">
                {e.payment ? 'Payment' : e.dir === 'they' ? 'Covered for ' + name + ' by ' + whoseText(e) : name + ' covered ' + whoseText(e)}
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, flex: 'none' }}>{money(e.amount)}</span>
            <button className="link-btn" style={{ flex: 'none' }}
              onClick={() => { if (confirmRemove('“' + e.what + '”')) update(x => { x.others = x.others.filter(z => z.id !== e.id); }); }}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
        {both && <><span className="note">Settled by</span>{pick(setBy, by, 'Who settles up')}</>}
        <button className="pill-sm dark" onClick={settle}>{total === 0 ? 'Archive these' : 'Settle up'}</button>
        {total !== 0 && !showPay && <button className="link-btn" onClick={() => setShowPay(true)}>Part-payment</button>}
      </div>
      {showPay && total !== 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 14 }}>
          {total > 0 ? name + ' paid' : null}
          {pick(setPayBy, payBy, 'Who')}
          {total < 0 ? 'paid ' + name : null}
          <input className="field-sm compact money" value={payAmt} onChange={e => setPayAmt(e.target.value)} inputMode="decimal" placeholder="$0" aria-label="Amount paid" />
          <button className="pill-sm" onClick={pay}>Save</button>
          <button className="link-btn" onClick={() => setShowPay(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
