import { useState } from 'react';
import { DOW, key } from '../lib/dates';
import { CHORE_OWNERS, ChoreOwner, describe, HouseholdData, nextOwner, norm, OWNERS, Schedule, uid } from '../lib/model';
import { confirmRemove } from './confirm';
import type { Update } from '../Household';

type SchedType = Schedule['type'];

export default function ChoresPage({ D, update }: { D: HouseholdData; update: Update }) {
  const tk = key(new Date());
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [person, setPerson] = useState<ChoreOwner>('ella');
  const [type, setType] = useState<SchedType>('weekly');
  const [days, setDays] = useState<number[]>([]);
  const [n, setN] = useState('14');
  const [start, setStart] = useState(tk);
  const [date, setDate] = useState(tk);
  const [dom, setDom] = useState('1');

  const hq = norm(q);
  const list = D.chores.filter(c => !hq || norm(c.name).includes(hq) || norm(OWNERS[c.person].name).includes(hq));

  const add = () => {
    const nm = name.trim();
    if (!nm) return;
    let sched: Schedule;
    if (type === 'weekly') { if (!days.length) return; sched = { type, days: days.slice() }; }
    else if (type === 'every') sched = { type, n: Math.max(1, parseInt(n) || 7), start: start || tk };
    else if (type === 'monthly') sched = { type, dom: Math.min(31, Math.max(1, parseInt(dom) || 1)) };
    else sched = { type, date: date || tk };
    const chore = { id: uid(), name: nm, person, sched };
    update(x => { x.chores.push(chore); });
    setName(''); setDays([]);
  };

  const pick = (p: ChoreOwner) => {
    const on = person === p, c = OWNERS[p];
    return (
      <button key={p} className="owner-pick" aria-pressed={on} onClick={() => setPerson(p)}
        style={{ borderColor: c.color, background: on ? c.color : '#fff', color: on ? '#fff' : c.ink }}>
        {c.name}
      </button>
    );
  };

  return (
    <div className="two-col">
      <section style={{ minWidth: 0 }}>
        <input className="search" style={{ width: '100%', marginBottom: 10 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search chores" />
        <div className="card" style={{ padding: '4px 18px' }}>
          {list.map((c, i) => {
            const p = OWNERS[c.person];
            return (
              <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid #F0ECE4' : 'none' }}>
                <button className="person-tag" title="Switch person" style={{ height: 'var(--h-xs)', minWidth: 74, padding: '0 10px', flex: 'none', background: p.tint, color: p.ink }}
                  onClick={() => update(x => { const z = x.chores.find(z => z.id === c.id); if (z) z.person = nextOwner(z.person); })}>{p.name}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15 }}>{c.name}</div>
                  <div style={{ fontSize: 12 }} className="muted">{describe(c.sched)}</div>
                </div>
                <button className="link-btn" onClick={() => { if (confirmRemove('“' + c.name + '”')) update(x => { x.chores = x.chores.filter(z => z.id !== c.id); }); }}>Remove</button>
              </div>
            );
          })}
          {!list.length && <p className="empty">{q ? 'No chores match “' + q + '”.' : 'No chores yet. Add one with New chore.'}</p>}
        </div>
        {list.length > 0 && <p className="note" style={{ margin: '8px 2px 0' }}>Tap a name to change who does it.</p>}
      </section>
      <aside className="add-panel" style={{ marginBottom: 0 }}>
        <div className="add-panel-title">+ New chore</div>
        <input className="field-sm compact" value={name} onChange={e => setName(e.target.value)} placeholder="Chore, e.g. Take bins out" aria-label="Chore" />
        <div style={{ display: 'flex', gap: 6 }}>{CHORE_OWNERS.map(pick)}</div>
        <select className="field-sm compact" value={type} aria-label="How often" onChange={e => setType(e.target.value as SchedType)}>
          <option value="weekly">Weekly on chosen days</option>
          <option value="every">Every N days</option>
          <option value="monthly">Monthly on a date</option>
          <option value="once">One-off</option>
        </select>
        {type === 'weekly' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {DOW.map((l, i) => {
              const on = days.indexOf(i) >= 0;
              return (
                <button key={l} onClick={() => setDays(on ? days.filter(z => z !== i) : days.concat(i))}
                  style={{ height: 'var(--h-sm)', borderRadius: 'var(--r-field)', cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1px solid #DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{l}</button>
              );
            })}
          </div>
        )}
        {type === 'every' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, flexWrap: 'wrap' }}>
            Every <input className="field-sm compact num" value={n} onChange={e => setN(e.target.value)} inputMode="numeric" aria-label="Number of days" /> days from{' '}
            <input className="field-sm compact" type="date" value={start} onChange={e => setStart(e.target.value)} aria-label="Starting" />
          </div>
        )}
        {type === 'monthly' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            On day <input className="field-sm compact num" value={dom} onChange={e => setDom(e.target.value)} inputMode="numeric" aria-label="Day of the month" /> of each month
          </div>
        )}
        {type === 'once' && <input className="field-sm compact" type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />}
        <button className="pill-sm dark" onClick={add}>Add chore</button>
      </aside>
    </div>
  );
}
