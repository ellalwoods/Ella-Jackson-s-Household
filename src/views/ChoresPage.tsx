import { useState } from 'react';
import { DOW, key } from '../lib/dates';
import { describe, HouseholdData, norm, otherPerson, PEOPLE, PersonId, Schedule, uid } from '../lib/model';
import type { Update } from '../Household';

type SchedType = Schedule['type'];

export default function ChoresPage({ D, update }: { D: HouseholdData; update: Update }) {
  const tk = key(new Date());
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [person, setPerson] = useState<PersonId>('ella');
  const [type, setType] = useState<SchedType>('weekly');
  const [days, setDays] = useState<number[]>([]);
  const [n, setN] = useState('14');
  const [start, setStart] = useState(tk);
  const [date, setDate] = useState(tk);
  const [dom, setDom] = useState('1');

  const hq = norm(q);
  const list = D.chores.filter(c => !hq || norm(c.name).includes(hq) || norm(PEOPLE[c.person].name).includes(hq));

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

  const pick = (p: PersonId) => {
    const on = person === p, c = PEOPLE[p];
    return (
      <button onClick={() => setPerson(p)}
        style={{ flex: 1, height: 42, borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 600, border: '1.5px solid ' + c.color, background: on ? c.color : '#fff', color: on ? '#fff' : c.ink }}>
        {c.name}
      </button>
    );
  };

  const small = { height: 40, border: '1px solid #DDD8CC', borderRadius: 8, background: '#fff' } as const;

  return (
    <div className="flow">
      <section style={{ flex: '2 1 420px', minWidth: 0 }}>
        <input className="search" style={{ width: '100%', marginBottom: 10 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search chores" />
        <div className="card" style={{ padding: '4px 18px' }}>
          {list.map(c => {
            const p = PEOPLE[c.person];
            return (
              <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #F0ECE4' }}>
                <button className="person-tag" title="Switch person" style={{ height: 32, minWidth: 78, padding: '0 10px', flex: 'none', background: p.tint, color: p.ink }}
                  onClick={() => update(x => { const z = x.chores.find(z => z.id === c.id); if (z) z.person = otherPerson(z.person); })}>{p.name}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15 }}>{c.name}</div>
                  <div style={{ fontSize: 12 }} className="muted">{describe(c.sched)}</div>
                </div>
                <button className="link-btn" onClick={() => update(x => { x.chores = x.chores.filter(z => z.id !== c.id); })}>Remove</button>
              </div>
            );
          })}
          {!list.length && <p className="empty">No chores found.</p>}
        </div>
      </section>
      <aside className="card" style={{ flex: '1 1 300px', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>New chore</div>
        <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Take bins out" />
        <div style={{ display: 'flex', gap: 6 }}>{pick('ella')}{pick('jackson')}</div>
        <select className="field" style={{ padding: '0 8px' }} value={type} onChange={e => setType(e.target.value as SchedType)}>
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
                  style={{ height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1px solid #DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{l}</button>
              );
            })}
          </div>
        )}
        {type === 'every' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, flexWrap: 'wrap' }}>
            Every <input value={n} onChange={e => setN(e.target.value)} inputMode="numeric" style={{ ...small, width: 64, padding: '0 10px' }} /> days from{' '}
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ ...small, padding: '0 8px' }} />
          </div>
        )}
        {type === 'monthly' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            On day <input value={dom} onChange={e => setDom(e.target.value)} inputMode="numeric" style={{ ...small, width: 64, padding: '0 10px' }} /> of each month
          </div>
        )}
        {type === 'once' && <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...small, padding: '0 8px' }} />}
        <button className="pill dark" style={{ height: 42 }} onClick={add}>Add chore</button>
      </aside>
    </div>
  );
}
