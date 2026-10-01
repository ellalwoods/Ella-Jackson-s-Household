import { useMemo, useState } from 'react';
import { addDays, isoWeek, mondayOf, weekLabel as fmtWeek } from './lib/dates';
import type { HouseholdData } from './lib/model';
import { pendingPicks, shoppingList, weekMeals } from './lib/food';
import { DOW } from './lib/dates';
import { MEAL_LABEL, mealRecipes } from './lib/model';
import type { Mutation, SyncStatus } from './lib/store';
import { Logo } from './views/Logo';
import WeekTable from './views/WeekTable';
import BudgetCard from './views/BudgetCard';
import ShopPage from './views/ShopPage';
import RecipesPage from './views/RecipesPage';
import PantryPage from './views/PantryPage';
import ChoresPage from './views/ChoresPage';
import BudgetPage from './views/BudgetPage';
import PlacesPage from './views/PlacesPage';
import CalendarPage from './views/CalendarPage';

export type Page = 'shop' | 'recipes' | 'places' | 'pantry' | 'chores' | 'budget' | 'calendar';
export type Update = (m: Mutation) => void;

const NAV: [Page, string][] = [['shop', 'Shopping list'], ['recipes', 'Recipes'], ['places', 'Places'], ['pantry', 'Pantry'], ['chores', 'Chores'], ['budget', 'Budget']];

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'Saved on this device',
  loading: 'Connecting…',
  synced: 'Synced',
  saving: 'Saving…',
  offline: 'Offline — changes will sync when you’re back online',
  retrying: 'Reconnecting… your changes are kept on this device',
  invalid: '',
};

interface Props { data: HouseholdData; update: Update; status: SyncStatus }

export default function Household({ data: D, update, status }: Props) {
  const [week, setWeek] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [calOff, setCalOff] = useState(0);

  const today = new Date();
  const mon = addDays(mondayOf(today), week * 7);
  const label = fmtWeek(mon);
  /** "Last week", "This week", "Next week", then the dates further out. */
  const relWeek = week === 0 ? 'This week' : week === 1 ? 'Next week' : week === -1 ? 'Last week' : null;
  const shop = useMemo(() => shoppingList(D, mon), [D, +mon]);
  // Planned meals whose bucket items haven't all been picked yet (they can't go on the list).
  const pending = weekMeals(D, mon).flatMap(m => pendingPicks(m, D).map(p =>
    DOW[m.day] + ' ' + MEAL_LABEL[m.meal].toLowerCase() + ' (' + m.recipe.name + '): pick ' + (p.use.count - p.picked) + ' from ' + p.bucket!.name));

  const go = (p: Page | null) => () => {
    setPage(p);
    setCalOff(0);
    try { window.scrollTo(0, 0); } catch { /* not available */ }
  };

  const titles: Record<Page, [string, string]> = {
    shop: ['Shopping list', label],
    recipes: ['Recipes', mealRecipes(D).length + ' saved'],
    pantry: ['Pantry', D.pantry.length + ' items'],
    chores: ['Chores', D.chores.length + ' chores'],
    budget: ['Budget', 'Your regular week'],
    places: ['Places', D.places.length + ' saved · restaurants, bars and cafés'],
    calendar: ['Month view', 'Plan ahead'],
  };

  return (
    <div className="app" data-screen-label="Household">
      <header className="header">
        <Logo onClick={go(null)} />
        <div className="row8" style={{ alignItems: 'center' }}>
          {/* The arrows step the week, so they're joined to it. */}
          <div className="week-nav" role="group" aria-label="Week">
            <button aria-label="Previous week" onClick={() => setWeek(w => w - 1)}>←</button>
            <button className="week-nav-now" onClick={() => setWeek(0)} aria-current={week === 0 ? 'date' : undefined}
              title={week === 0 ? undefined : 'Back to this week'} aria-label={(relWeek ?? label) + (week === 0 ? '' : ', back to this week')}>{relWeek ?? label}</button>
            <button aria-label="Next week" onClick={() => setWeek(w => w + 1)}>→</button>
          </div>
          <button className={'month-btn' + (page === 'calendar' ? ' on' : '')} aria-current={page === 'calendar' ? 'page' : undefined}
            onClick={go(page === 'calendar' ? null : 'calendar')}>Month</button>
        </div>
      </header>

      {/* Same heading row and buttons on every screen; only the content below changes. */}
      <div className="week-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13 }} className="muted">
            {!page ? (relWeek ? relWeek + ' · ' : '') + 'Week ' + isoWeek(mon) : (
              <><button className="link-btn" style={{ fontSize: 13 }} onClick={go(null)}>← Back to week</button> · {titles[page][1]}</>
            )}
          </div>
          <h1 className="h1">{!page ? label : titles[page][0]}</h1>
        </div>
        <nav className="tabbar" aria-label="Pages">
          {NAV.map(([p, text]) => {
            const on = page === p;
            return (
              <button key={p} className={'tab-btn' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined} onClick={go(on ? null : p)}>
                {p === 'shop' ? <span>Shopping<span className="wide-only"> list</span></span> : text}
                {p === 'shop' && <span className="count-badge">{shop.items.length}</span>}
                {p === 'recipes' && <span className="wide-only">· {mealRecipes(D).length}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {!page ? (
        <div className="flow">
          <WeekTable key={+mon} D={D} update={update} mon={mon} />
          <BudgetCard D={D} update={update} mon={mon} onEdit={go('budget')} />
        </div>
      ) : (
        <div className="page">
          {page === 'shop' && <ShopPage update={update} mon={mon} label={label} {...shop} pending={pending} />}
          {page === 'recipes' && <RecipesPage D={D} update={update} mon={mon} />}
          {page === 'pantry' && <PantryPage D={D} update={update} />}
          {page === 'chores' && <ChoresPage D={D} update={update} />}
          {page === 'budget' && <BudgetPage D={D} update={update} />}
          {page === 'places' && <PlacesPage D={D} update={update} />}
          {page === 'calendar' && (
            <CalendarPage D={D} update={update} mon={mon} calOff={calOff} setCalOff={setCalOff}
              onPickWeek={w => { setWeek(w); setPage(null); setCalOff(0); }} />
          )}
        </div>
      )}

      <footer className="footer">
        <span>{STATUS_TEXT[status]}</span>
      </footer>
    </div>
  );
}
