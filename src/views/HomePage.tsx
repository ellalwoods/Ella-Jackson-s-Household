import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { CalEvent, EAT_OUT, eatOutName, HouseholdData, Meal, MEAL_LABEL, MEALS, money, occurs, OWNERS } from '../lib/model';
import EventDialog from './EventDialog';
import type { Update } from '../Household';

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dowOf = (d: Date) => (d.getDay() + 6) % 7;

interface Props {
  D: HouseholdData; update: Update;
  shopCount: number; ellaLeft: number; jacksonLeft: number;
  onPlan: () => void; onShop: () => void; onMoney: () => void; onCalendar: () => void;
}

/**
 * Home: today first (meals, what's on, chores), then the days coming up.
 * Money is one quiet line at the bottom.
 */
export default function HomePage({ D, update, shopCount, ellaLeft, jacksonLeft, onPlan, onShop, onMoney, onCalendar }: Props) {
  const [dialog, setDialog] = useState<CalEvent | null>(null);
  const today = new Date();
  const rBy = new Map(D.recipes.map(r => [r.id, r]));

  const dayInfo = (d: Date) => {
    const k = key(d);
    const meals = MEALS.map(meal => {
      const id = D.plan[k]?.[meal];
      const name = id === EAT_OUT ? (eatOutName(D, k + '|' + meal) || 'Eating out') : id ? rBy.get(id)?.name : undefined;
      return { meal, name, out: id === EAT_OUT };
    }).filter((m): m is { meal: Meal; name: string; out: boolean } => !!m.name);
    const events = D.events.filter(e => e.date === k).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    const chores = D.chores.filter(c => occurs(c, d)).map(c => ({ c, dk: k + '|' + c.id, done: !!D.done[k + '|' + c.id] }));
    return { d, k, meals, events, chores };
  };

  const t = dayInfo(today);
  // Only days with something on them; the section is left out when nothing is coming up.
  const coming = [1, 2, 3, 4, 5, 6].map(i => dayInfo(addDays(today, i))).filter(x => x.meals.length || x.events.length || x.chores.length);
  const toggle = (dk: string) => update(x => { if (x.done[dk]) delete x.done[dk]; else x.done[dk] = 1; });
  const tagColour = (e: CalEvent) => D.tags.find(g => e.tags[0] && g.name.toLowerCase() === e.tags[0].toLowerCase())?.color ?? OWNERS[e.who].color;
  const eventLine = (e: CalEvent) => (e.time ? e.time + ' · ' : '') + e.title + (e.place ? ' · ' + e.place : '');

  return (
    <div className="home">
      <section className="home-today">
        <div className="home-col">
          <div className="sec-label">Meals today</div>
          {MEALS.filter(m => m === 'lunch' || m === 'dinner' || t.meals.some(x => x.meal === m)).map(m => {
            const x = t.meals.find(y => y.meal === m);
            return (
              <button key={m} className="home-row" onClick={onPlan}>
                <span className="home-row-label">{MEAL_LABEL[m]}</span>
                <span className={'home-row-main' + (x ? '' : ' quiet')}>{x ? (x.out ? '🍽 ' : '') + x.name : 'Nothing planned'}</span>
                <span className="home-row-end">{x ? '' : 'Plan ›'}</span>
              </button>
            );
          })}
        </div>

        <div className="home-col">
          <div className="sec-label">On today</div>
          {t.events.map(e => (
            <button key={e.id} className="home-row event-row" onClick={() => setDialog(e)}>
              <span className="dot8" style={{ background: tagColour(e) }} />
              <span className="home-row-main">{eventLine(e)}</span>
              <span className="home-row-end">{e.who === 'both' ? '' : OWNERS[e.who].name}</span>
            </button>
          ))}
          {!t.events.length && <button className="home-row event-row" onClick={onCalendar}><span className="home-row-main quiet">Nothing on</span><span className="home-row-end">Calendar ›</span></button>}
        </div>

        <div className="home-col">
          <div className="sec-label">Chores today <span className="sec-count">{t.chores.filter(c => c.done).length}/{t.chores.length}</span></div>
          {t.chores.map(({ c, dk, done }) => {
            const p = OWNERS[c.person];
            return (
              <button key={c.id} className={'home-row chore-row' + (done ? ' done' : '')} onClick={() => toggle(dk)} aria-pressed={done}>
                <span className="tick" style={{ borderColor: p.color, background: done ? p.color : 'transparent' }}>{done ? '✓' : ''}</span>
                <span className="home-row-main">{c.name}</span>
                <span className="home-row-end" style={{ color: p.ink }}>{p.name}</span>
              </button>
            );
          })}
          {!t.chores.length && <p className="home-row-main quiet" style={{ padding: '12px 0', margin: 0 }}>No chores today</p>}
        </div>
      </section>

      {coming.length > 0 && <section className="home-coming">
        <div className="sec-label">Coming up</div>
        <div className="coming-grid">
        {coming.map(({ d, k, meals, events, chores }) => {
          return (
            <div key={k} className="coming-day">
              <div className="coming-date"><span>{DOW[dowOf(d)]}</span><b>{d.getDate()}</b></div>
              <div className="coming-body">
                {meals.map(m => (
                  <button key={m.meal} className="coming-line" onClick={onPlan}>
                    <span className="coming-tag">{MEAL_LABEL[m.meal]}</span>{m.out ? '🍽 ' : ''}{m.name}
                  </button>
                ))}
                {events.map(e => (
                  <button key={e.id} className="coming-line" onClick={() => setDialog(e)}>
                    <span className="dot8" style={{ background: tagColour(e) }} />{eventLine(e)}
                  </button>
                ))}
                {chores.length > 0 && (
                  <div className="coming-chores">
                    {chores.map(({ c, done }) => <span key={c.id} className={done ? 'done' : ''}><span className="dot6" style={{ background: OWNERS[c.person].color }} />{c.name}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </section>}

      <section className="home-also">
        <button className="also-link" onClick={onShop}><span className="sec-label">Shopping list</span><span>{shopCount} to buy ›</span></button>
        <button className="also-link" onClick={onMoney}><span className="sec-label">Left this week</span>
          <span><span style={{ color: OWNERS.ella.ink }}>Ella {money(ellaLeft)}</span> · <span style={{ color: OWNERS.jackson.ink }}>Jackson {money(jacksonLeft)}</span> ›</span>
        </button>
      </section>

      {dialog && <EventDialog D={D} update={update} date={dialog.date} event={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** "Sunday 15 November" */
export const longDate = (d: Date) => LONG_DAYS[dowOf(d)] + ' ' + d.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()];
