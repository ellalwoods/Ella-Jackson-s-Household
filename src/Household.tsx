import { useMemo, useState } from 'react';
import { addDays, isoWeek, mondayOf, weekLabel as fmtWeek } from './lib/dates';
import type { HouseholdData } from './lib/model';
import { shoppingList } from './lib/food';
import type { Mutation, SyncStatus } from './lib/store';
import { Logo } from './views/Logo';
import WeekTable from './views/WeekTable';
import BudgetCard from './views/BudgetCard';
import ShopPage from './views/ShopPage';
import RecipesPage from './views/RecipesPage';
import PantryPage from './views/PantryPage';
import ChoresPage from './views/ChoresPage';
import BudgetPage from './views/BudgetPage';
import CalendarPage from './views/CalendarPage';

export type Page = 'shop' | 'recipes' | 'pantry' | 'chores' | 'budget' | 'calendar';
export type Update = (m: Mutation) => void;

const TABS: [Page, string][] = [['shop', 'Shopping'], ['recipes', 'Recipes'], ['pantry', 'Pantry'], ['chores', 'Chores'], ['budget', 'Budget'], ['calendar', 'Month']];

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'Saved on this device',
  loading: 'Connecting…',
  synced: 'Synced',
  saving: 'Saving…',
  offline: 'Offline — changes will sync when you’re back online',
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
  const shop = useMemo(() => shoppingList(D, mon), [D, +mon]);

  const go = (p: Page | null) => () => {
    setPage(p);
    setCalOff(0);
    try { window.scrollTo(0, 0); } catch { /* not available */ }
  };

  const titles: Record<Page, [string, string]> = {
    shop: ['Shopping list', label + ' · excludes what’s in the pantry'],
    recipes: ['Recipes', D.recipes.length + ' saved · search by name or ingredient'],
    pantry: ['Pantry', D.pantry.length + ' ingredients tracked'],
    chores: ['Chores', D.chores.length + ' tasks · recurring & one-off'],
    budget: ['Budget', 'Your regular weekly budget, per person'],
    calendar: ['Month view', 'Plan ahead'],
  };

  return (
    <div className="app" data-screen-label="Household">
      <header className="header">
        <Logo onClick={go(null)} />
        {!page ? (
          <div className="row">
            <button className="round-btn" aria-label="Previous week" onClick={() => setWeek(w => w - 1)}>←</button>
            <button className="pill" onClick={() => setWeek(0)}>This week</button>
            <button className="round-btn" aria-label="Next week" onClick={() => setWeek(w => w + 1)}>→</button>
            <button className="pill" onClick={go('calendar')}>Month</button>
          </div>
        ) : (
          <button className="pill" onClick={go(null)}>← Back to week</button>
        )}
      </header>

      {!page ? (
        <>
          <div className="week-head">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13 }} className="muted">{(week === 0 ? 'This week · ' : '') + 'Week ' + isoWeek(mon)}</div>
              <h1 className="h1">{label}</h1>
            </div>
            <div className="row8">
              <button className="pill ghost" onClick={go('shop')} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Shopping list <span className="count-badge">{shop.items.length}</span>
              </button>
              <button className="pill ghost" onClick={go('recipes')}>Recipes · {D.recipes.length}</button>
              <button className="pill ghost" onClick={go('pantry')}>Pantry</button>
              <button className="pill ghost" onClick={go('chores')}>Chores</button>
              <button className="pill ghost" onClick={go('budget')}>Budget</button>
            </div>
          </div>
          <div className="flow">
            <WeekTable key={+mon} D={D} update={update} mon={mon} />
            <BudgetCard D={D} update={update} mon={mon} onEdit={go('budget')} />
          </div>
        </>
      ) : (
        <div className="page">
          <div className="page-head">
            <div>
              <h1 className="h1">{titles[page][0]}</h1>
              <div style={{ fontSize: 14, marginTop: 4 }} className="muted">{titles[page][1]}</div>
            </div>
            <div className="row" style={{ gap: 4 }}>
              {TABS.map(([p, l]) => {
                const on = page === p;
                return (
                  <button key={p} className="tab" onClick={go(p)}
                    style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{l}</button>
                );
              })}
            </div>
          </div>
          {page === 'shop' && <ShopPage update={update} mon={mon} label={label} {...shop} />}
          {page === 'recipes' && <RecipesPage D={D} update={update} mon={mon} />}
          {page === 'pantry' && <PantryPage D={D} update={update} />}
          {page === 'chores' && <ChoresPage D={D} update={update} />}
          {page === 'budget' && <BudgetPage D={D} update={update} />}
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
