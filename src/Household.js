import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { addDays, isoWeek, mondayOf, weekLabel as fmtWeek } from './lib/dates';
import { pendingPicks, shoppingList, weekMeals } from './lib/food';
import { DOW } from './lib/dates';
import { MEAL_LABEL, mealRecipes } from './lib/model';
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
const NAV = [['shop', 'Shopping list'], ['recipes', 'Recipes'], ['places', 'Places'], ['pantry', 'Pantry'], ['chores', 'Chores'], ['budget', 'Budget']];
const STATUS_TEXT = {
    local: 'Saved on this device',
    loading: 'Connecting…',
    synced: 'Synced',
    saving: 'Saving…',
    offline: 'Offline — changes will sync when you’re back online',
    retrying: 'Reconnecting… your changes are kept on this device',
    invalid: '',
};
export default function Household({ data: D, update, status }) {
    const [week, setWeek] = useState(0);
    const [page, setPage] = useState(null);
    const [calOff, setCalOff] = useState(0);
    const today = new Date();
    const mon = addDays(mondayOf(today), week * 7);
    const label = fmtWeek(mon);
    /** "Last week", "This week", "Next week", then the dates further out. */
    const relWeek = week === 0 ? 'This week' : week === 1 ? 'Next week' : week === -1 ? 'Last week' : null;
    const shop = useMemo(() => shoppingList(D, mon), [D, +mon]);
    // Planned meals whose bucket items haven't all been picked yet (they can't go on the list).
    const pending = weekMeals(D, mon).flatMap(m => pendingPicks(m, D).map(p => DOW[m.day] + ' ' + MEAL_LABEL[m.meal].toLowerCase() + ' (' + m.recipe.name + '): pick ' + (p.use.count - p.picked) + ' from ' + p.bucket.name));
    const go = (p) => () => {
        setPage(p);
        setCalOff(0);
        try {
            window.scrollTo(0, 0);
        }
        catch { /* not available */ }
    };
    const titles = {
        shop: ['Shopping list', label],
        recipes: ['Recipes', mealRecipes(D).length + ' saved'],
        pantry: ['Pantry', D.pantry.length + ' items'],
        chores: ['Chores', D.chores.length + ' chores'],
        budget: ['Budget', 'Your regular week'],
        places: ['Places', D.places.length + ' saved · restaurants, bars and cafés'],
        calendar: ['Month view', 'Plan ahead'],
    };
    return (_jsxs("div", { className: "app", "data-screen-label": "Household", children: [_jsxs("header", { className: "header", children: [_jsx(Logo, { onClick: go(null) }), _jsxs("div", { className: "row8", style: { alignItems: 'center' }, children: [_jsxs("div", { className: "week-nav", role: "group", "aria-label": "Week", children: [_jsx("button", { "aria-label": "Previous week", onClick: () => setWeek(w => w - 1), children: "\u2190" }), _jsx("button", { className: "week-nav-now", onClick: () => setWeek(0), "aria-current": week === 0 ? 'date' : undefined, title: week === 0 ? undefined : 'Back to this week', "aria-label": (relWeek ?? label) + (week === 0 ? '' : ', back to this week'), children: relWeek ?? label }), _jsx("button", { "aria-label": "Next week", onClick: () => setWeek(w => w + 1), children: "\u2192" })] }), _jsx("button", { className: 'month-btn' + (page === 'calendar' ? ' on' : ''), "aria-current": page === 'calendar' ? 'page' : undefined, onClick: go(page === 'calendar' ? null : 'calendar'), children: "Month" })] })] }), _jsxs("div", { className: "week-head", children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx("div", { style: { fontSize: 13 }, className: "muted", children: !page ? (relWeek ? relWeek + ' · ' : '') + 'Week ' + isoWeek(mon) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "link-btn", style: { fontSize: 13 }, onClick: go(null), children: "\u2190 Back to week" }), " \u00B7 ", titles[page][1]] })) }), _jsx("h1", { className: "h1", children: !page ? label : titles[page][0] })] }), _jsx("nav", { className: "tabbar", "aria-label": "Pages", children: NAV.map(([p, text]) => {
                            const on = page === p;
                            return (_jsxs("button", { className: 'tab-btn' + (on ? ' on' : ''), "aria-current": on ? 'page' : undefined, onClick: go(on ? null : p), children: [p === 'shop' ? _jsxs("span", { children: ["Shopping", _jsx("span", { className: "wide-only", children: " list" })] }) : text, p === 'shop' && _jsx("span", { className: "count-badge", children: shop.items.length }), p === 'recipes' && _jsxs("span", { className: "wide-only", children: ["\u00B7 ", mealRecipes(D).length] })] }, p));
                        }) })] }), !page ? (_jsxs("div", { className: "flow", children: [_jsx(WeekTable, { D: D, update: update, mon: mon }, +mon), _jsx(BudgetCard, { D: D, update: update, mon: mon, onEdit: go('budget') })] })) : (_jsxs("div", { className: "page", children: [page === 'shop' && _jsx(ShopPage, { update: update, mon: mon, label: label, ...shop, pending: pending }), page === 'recipes' && _jsx(RecipesPage, { D: D, update: update, mon: mon }), page === 'pantry' && _jsx(PantryPage, { D: D, update: update }), page === 'chores' && _jsx(ChoresPage, { D: D, update: update }), page === 'budget' && _jsx(BudgetPage, { D: D, update: update }), page === 'places' && _jsx(PlacesPage, { D: D, update: update }), page === 'calendar' && (_jsx(CalendarPage, { D: D, update: update, mon: mon, calOff: calOff, setCalOff: setCalOff, onPickWeek: w => { setWeek(w); setPage(null); setCalOff(0); } }))] })), _jsx("footer", { className: "footer", children: _jsx("span", { children: STATUS_TEXT[status] }) })] }));
}
