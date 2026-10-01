import { addDays, DOW, key, MONL, mondayOf, weekOffsetOf } from '../lib/dates';
import { useState } from 'react';
import { CalEvent, EAT_OUT, eatOutName, HouseholdData, MEALS, norm, occurs, OWNERS, soft } from '../lib/model';
import type { Update } from '../Household';
import EventDialog from './EventDialog';

interface Props { D: HouseholdData; update: Update; mon: Date; calOff: number; setCalOff: (f: (n: number) => number) => void; onPickWeek: (week: number) => void }

export default function CalendarPage({ D, update, mon, calOff, setCalOff, onPickWeek }: Props) {
  const [dialog, setDialog] = useState<{ date: string; event: CalEvent | null } | null>(null);
  const tagColor = (n: string) => D.tags.find(t => norm(t.name) === norm(n))?.color;
  const eventColor = (e: CalEvent) => (e.tags.length && tagColor(e.tags[0])) || OWNERS[e.who].color;
  const byDate = new Map<string, CalEvent[]>();
  for (const e of D.events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  byDate.forEach(list => list.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')));
  const today = new Date(), tk = key(today), end = addDays(mon, 6);
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const base = new Date(mon.getFullYear(), mon.getMonth() + calOff, 1);
  const start = mondayOf(base);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), k = key(d), inM = d.getMonth() === base.getMonth(), inW = d >= mon && d <= end;
    if (i === 35 && !inM) break;
    cells.push({ d, k, inM, inW, meal: MEALS.map(m => (D.plan[k]?.[m] === EAT_OUT ? '🍽 ' + (eatOutName(D, k + '|' + m) || 'Eating out') : rBy.get(D.plan[k]?.[m] ?? '')?.name)).filter(Boolean).join(' · '), dots: D.chores.filter(c => occurs(c, d)).map(c => OWNERS[c.person].color) });
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button className="round-btn" style={{ fontSize: 'inherit' }} aria-label="Previous month" onClick={() => setCalOff(x => x - 1)}>←</button>
        <span style={{ fontSize: 20, fontWeight: 600 }}>{MONL[base.getMonth()]} {base.getFullYear()}</span>
        <button className="round-btn" style={{ fontSize: 'inherit' }} aria-label="Next month" onClick={() => setCalOff(x => x + 1)}>→</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 }}>
        {DOW.map(h => <span key={h} style={{ fontSize: 11, textAlign: 'center', fontWeight: 600, paddingBottom: 4 }} className="muted">{h}</span>)}
        {cells.map(c => {
          const evs = byDate.get(c.k) ?? [];
          return (
            <div key={c.k} className="cal-cell" onClick={() => onPickWeek(weekOffsetOf(c.d, today))} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onPickWeek(weekOffsetOf(c.d, today)); }}
              style={{ opacity: c.inM ? 1 : 0.4, borderColor: c.k === tk ? '#23221F' : c.inW ? '#CFC9BC' : '#EFEBE3', background: c.inW ? '#F6F3EC' : '#fff' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.d.getDate()}</span>
                <button className="cal-add" aria-label={'Add event on ' + c.d.getDate()} title="Add event"
                  onClick={e => { e.stopPropagation(); setDialog({ date: c.k, event: null }); }}>+</button>
              </span>
              {evs.map(ev => (
                <button key={ev.id} className="cal-event" title={[ev.time, ev.title, ev.place].filter(Boolean).join(' · ')}
                  onClick={e => { e.stopPropagation(); setDialog({ date: ev.date, event: ev }); }}
                  style={{ background: soft(eventColor(ev)), borderLeft: '3px solid ' + eventColor(ev) }}>
                  <span className="cal-event-text">{ev.time && <span className="cal-event-time">{ev.time}</span>}{ev.title}</span>
                  <span className="cal-event-who" style={{ background: OWNERS[ev.who].color }} aria-label={OWNERS[ev.who].name} title={OWNERS[ev.who].name} />
                </button>
              ))}
              <span className="cal-meal">{c.meal}</span>
              <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'auto' }}>
                {c.dots.map((dt, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: dt }} />)}
              </span>
            </div>
          );
        })}
      </div>
      {dialog && <EventDialog D={D} update={update} date={dialog.date} event={dialog.event} onClose={() => setDialog(null)} />}
      <p className="note" style={{ margin: '12px 0 0' }}>Tap + to add an event. Tap a day to open its week. Dots are chores.</p>
    </div>
  );
}
