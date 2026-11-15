import React, { useMemo, useState } from 'react';
import { addDays, isoWeek, mondayOf, weekLabel as fmtWeek } from './lib/dates';
import type { HouseholdData } from './lib/model';
import { pendingPicks, shoppingList, weekBudget, weekMeals } from './lib/food';
import { DOW } from './lib/dates';
import { MEAL_LABEL, mealRecipes } from './lib/model';
import type { Mutation, SyncStatus } from './lib/store';
import { Logo } from './views/Logo';
import { CalendarIcon, FoodIcon, HomeIcon, MoneyIcon, WeekIcon } from './views/Icons';
import HomePage, { longDate } from './views/HomePage';
import WeekTable from './views/WeekTable';
import BudgetCard from './views/BudgetCard';
import ShopPage from './views/ShopPage';
import RecipesPage from './views/RecipesPage';
import PantryPage from './views/PantryPage';
import ChoresPage from './views/ChoresPage';
import BudgetPage from './views/BudgetPage';
import PlacesPage from './views/PlacesPage';
import CalendarPage from './views/CalendarPage';
import SplitPage from './views/SplitPage';

export type Update = (m: Mutation) => void;

/**
 * Five sections, each with a few pages. New features go inside a section,
 * so the main navigation stays the same size.
 */
type Section = 'home' | 'week' | 'food' | 'money' | 'calendar';
export type Page = 'home' | 'plan' | 'chores' | 'shop' | 'recipes' | 'pantry' | 'places' | 'spend' | 'budget' | 'split' | 'calendar';

const SECTIONS: { id: Section; label: string; icon: () => React.JSX.Element; pages: [Page, string][] }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, pages: [['home', 'Home']] },
  { id: 'week', label: 'Week', icon: WeekIcon, pages: [['plan', 'Plan'], ['chores', 'Chores']] },
  { id: 'food', label: 'Food', icon: FoodIcon, pages: [['shop', 'Shopping'], ['recipes', 'Recipes'], ['pantry', 'Pantry'], ['places', 'Places']] },
  { id: 'money', label: 'Money', icon: MoneyIcon, pages: [['spend', 'Budget'], ['budget', 'Set up'], ['split', 'Split']] },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon, pages: [['calendar', 'Calendar']] },
];
/** Pages about one particular week get the week arrows. */
const WEEKLY: Page[] = ['plan', 'shop', 'spend'];

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
  const [section, setSection] = useState<Section>('home');
  /** The page last open in each section, so switching back returns to it. */
  const [last, setLast] = useState<Partial<Record<Section, Page>>>({});
  const [calOff, setCalOff] = useState(0);

  const today = new Date();
  const mon = addDays(mondayOf(today), week * 7);
  const label = fmtWeek(mon);
  /** "Last week", "This week", "Next week", then the dates further out. */
  const relWeek = week === 0 ? 'This week' : week === 1 ? 'Next week' : week === -1 ? 'Last week' : null;
  const shop = useMemo(() => shoppingList(D, mon), [D, +mon]);
  const thisWeek = useMemo(() => weekBudget(D, mondayOf(new Date())), [D]);
  // Planned meals whose bucket items haven't all been picked yet (they can't go on the list).
  const pending = weekMeals(D, mon).flatMap(m => pendingPicks(m, D).map(p =>
    DOW[m.day] + ' ' + MEAL_LABEL[m.meal].toLowerCase() + ' (' + m.recipe.name + '): pick ' + (p.use.count - p.picked) + ' from ' + p.bucket!.name));

  const sec = SECTIONS.find(s => s.id === section)!;
  const page: Page = last[section] ?? sec.pages[0][0];
  const top = () => { try { window.scrollTo(0, 0); } catch { /* not available */ } };
  const open = (s: Section, p?: Page) => {
    setSection(s);
    if (p) setLast(l => ({ ...l, [s]: p }));
    setCalOff(0);
    top();
  };

  const counts: Partial<Record<Page, string>> = {
    shop: String(shop.items.length),
    recipes: String(mealRecipes(D).length),
  };
  const title: Record<Page, [string, string]> = {
    home: ['Today', longDate(today)],
    plan: [label, (relWeek ? relWeek + ' · ' : '') + 'Week ' + isoWeek(mon)],
    chores: ['Chores', D.chores.length + ' chores'],
    shop: ['Shopping list', (relWeek ?? label) + ' · ' + shop.items.length + ' to buy'],
    recipes: ['Recipes', mealRecipes(D).length + ' saved'],
    pantry: ['Pantry', D.pantry.length + ' items'],
    places: ['Places', D.places.length + ' saved · restaurants, bars and cafés'],
    spend: ['Budget', relWeek ? relWeek + ' · ' + label : label],
    budget: ['Budget set-up', 'Your regular week'],
    split: ['Split', 'Shared costs and who owes whom'],
    calendar: ['Calendar', 'Plan ahead'],
  };

  const navButton = (s: (typeof SECTIONS)[number], cls: string) => {
    const on = s.id === section;
    return (
      <button key={s.id} className={cls + (on ? ' on' : '')} aria-current={on ? 'page' : undefined} onClick={() => open(s.id)}>
        <s.icon /><span>{s.label}</span>
      </button>
    );
  };

  return (
    <div className="app shell" data-screen-label="Household">
      <aside className="sidenav" aria-label="Sections">
        <Logo onClick={() => open('home')} />
        <nav className="sidenav-list">{SECTIONS.map(s => navButton(s, 'side-btn'))}</nav>
        <div className="sidenav-foot">{STATUS_TEXT[status]}</div>
      </aside>

      <main className="main">
        <div className="phone-top"><Logo onClick={() => open('home')} /></div>
        <div className="page-top">
          <div className="page-title">
            <div className="page-eyebrow">{title[page][1]}</div>
            <h1 className="h1">{title[page][0]}</h1>
          </div>
          {WEEKLY.includes(page) && (
            <div className="week-nav" role="group" aria-label="Week">
              <button aria-label="Previous week" onClick={() => setWeek(w => w - 1)}>←</button>
              <button className="week-nav-now" onClick={() => setWeek(0)} aria-current={week === 0 ? 'date' : undefined}
                title={week === 0 ? undefined : 'Back to this week'} aria-label={(relWeek ?? label) + (week === 0 ? '' : ', back to this week')}>{relWeek ?? label}</button>
              <button aria-label="Next week" onClick={() => setWeek(w => w + 1)}>→</button>
            </div>
          )}
        </div>
        {sec.pages.length > 1 && (
          <nav className="tabbar" aria-label={sec.label}>
            {sec.pages.map(([p, text]) => (
              <button key={p} className={'tab-btn' + (p === page ? ' on' : '')} aria-current={p === page ? 'page' : undefined} onClick={() => open(section, p)}>
                {text}{counts[p] && <span className="tab-count">{counts[p]}</span>}
              </button>
            ))}
          </nav>
        )}

        <div className="page">
          {page === 'home' && (
            <HomePage D={D} update={update} shopCount={shoppingList(D, mondayOf(today)).items.length} ellaLeft={thisWeek.ellaLeft} jacksonLeft={thisWeek.jacksonLeft}
              onPlan={() => { setWeek(0); open('week', 'plan'); }} onShop={() => { setWeek(0); open('food', 'shop'); }}
              onMoney={() => { setWeek(0); open('money', 'spend'); }} onCalendar={() => open('calendar')} />
          )}
          {page === 'plan' && <WeekTable key={+mon} D={D} update={update} mon={mon} />}
          {page === 'chores' && <ChoresPage D={D} update={update} />}
          {page === 'shop' && <ShopPage update={update} mon={mon} label={label} {...shop} pending={pending} />}
          {page === 'recipes' && <RecipesPage D={D} update={update} mon={mon} />}
          {page === 'pantry' && <PantryPage D={D} update={update} />}
          {page === 'places' && <PlacesPage D={D} update={update} />}
          {page === 'spend' && <BudgetCard D={D} update={update} mon={mon} onEdit={() => open('money', 'budget')} />}
          {page === 'budget' && <BudgetPage D={D} update={update} />}
          {page === 'split' && <SplitPage D={D} update={update} />}
          {page === 'calendar' && (
            <CalendarPage D={D} update={update} mon={mon} calOff={calOff} setCalOff={setCalOff}
              onPickWeek={w => { setWeek(w); open('week', 'plan'); }} />
          )}
        </div>

        <footer className="footer phone-only-foot">
          <span>{STATUS_TEXT[status]}</span>
        </footer>
      </main>

      <nav className="bottomnav" aria-label="Sections">{SECTIONS.map(s => navButton(s, 'bottom-btn'))}</nav>
    </div>
  );
}
