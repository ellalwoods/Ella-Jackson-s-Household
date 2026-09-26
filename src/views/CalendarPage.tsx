import { addDays, DOW, key, MONL, mondayOf, weekOffsetOf } from '../lib/dates';
import { HouseholdData, MEALS, occurs, OWNERS } from '../lib/model';

interface Props { D: HouseholdData; mon: Date; calOff: number; setCalOff: (f: (n: number) => number) => void; onPickWeek: (week: number) => void }

export default function CalendarPage({ D, mon, calOff, setCalOff, onPickWeek }: Props) {
  const today = new Date(), tk = key(today), end = addDays(mon, 6);
  const rBy = new Map(D.recipes.map(r => [r.id, r]));
  const base = new Date(mon.getFullYear(), mon.getMonth() + calOff, 1);
  const start = mondayOf(base);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), k = key(d), inM = d.getMonth() === base.getMonth(), inW = d >= mon && d <= end;
    if (i === 35 && !inM) break;
    cells.push({ d, k, inM, inW, meal: MEALS.map(m => rBy.get(D.plan[k]?.[m] ?? '')?.name).filter(Boolean).join(' · '), dots: D.chores.filter(c => occurs(c, d)).map(c => OWNERS[c.person].color) });
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
        {cells.map(c => (
          <button key={c.k} className="cal-cell" onClick={() => onPickWeek(weekOffsetOf(c.d, today))}
            style={{ opacity: c.inM ? 1 : 0.4, borderColor: c.k === tk ? '#23221F' : c.inW ? '#CFC9BC' : '#EFEBE3', background: c.inW ? '#F6F3EC' : '#fff' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{c.d.getDate()}</span>
            <span className="cal-meal">{c.meal}</span>
            <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'auto' }}>
              {c.dots.map((dt, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: dt }} />)}
            </span>
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: '12px 0 0' }}>Tap a day to jump to its week. Dots are chores in each person's colour, blue for shared.</p>
    </div>
  );
}
