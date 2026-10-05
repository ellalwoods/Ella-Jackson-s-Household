import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { addDays, DOW, key, MONL, mondayOf, weekOffsetOf } from '../lib/dates';
import { useState } from 'react';
import { EAT_OUT, eatOutName, MEALS, norm, occurs, OWNERS, soft } from '../lib/model';
import EventDialog from './EventDialog';
export default function CalendarPage({ D, update, mon, calOff, setCalOff, onPickWeek }) {
    const [dialog, setDialog] = useState(null);
    const tagColor = (n) => D.tags.find(t => norm(t.name) === norm(n))?.color;
    const eventColor = (e) => (e.tags.length && tagColor(e.tags[0])) || OWNERS[e.who].color;
    const byDate = new Map();
    for (const e of D.events)
        byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
    byDate.forEach(list => list.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')));
    const today = new Date(), tk = key(today), end = addDays(mon, 6);
    const rBy = new Map(D.recipes.map(r => [r.id, r]));
    const base = new Date(mon.getFullYear(), mon.getMonth() + calOff, 1);
    const start = mondayOf(base);
    const cells = [];
    for (let i = 0; i < 42; i++) {
        const d = addDays(start, i), k = key(d), inM = d.getMonth() === base.getMonth(), inW = d >= mon && d <= end;
        if (i === 35 && !inM)
            break;
        cells.push({ d, k, inM, inW, meal: MEALS.map(m => (D.plan[k]?.[m] === EAT_OUT ? '🍽 ' + (eatOutName(D, k + '|' + m) || 'Eating out') : rBy.get(D.plan[k]?.[m] ?? '')?.name)).filter(Boolean).join(' · '), dots: D.chores.filter(c => occurs(c, d)).map(c => OWNERS[c.person].color) });
    }
    return (_jsxs("div", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, children: [_jsx("button", { className: "round-btn", style: { fontSize: 'inherit' }, "aria-label": "Previous month", onClick: () => setCalOff(x => x - 1), children: "\u2190" }), _jsxs("span", { style: { fontSize: 20, fontWeight: 600 }, children: [MONL[base.getMonth()], " ", base.getFullYear()] }), _jsx("button", { className: "round-btn", style: { fontSize: 'inherit' }, "aria-label": "Next month", onClick: () => setCalOff(x => x + 1), children: "\u2192" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 }, children: [DOW.map(h => _jsx("span", { style: { fontSize: 11, textAlign: 'center', fontWeight: 600, paddingBottom: 4 }, className: "muted", children: h }, h)), cells.map(c => {
                        const evs = byDate.get(c.k) ?? [];
                        return (_jsxs("div", { className: "cal-cell", onClick: () => onPickWeek(weekOffsetOf(c.d, today)), role: "button", tabIndex: 0, onKeyDown: e => { if (e.key === 'Enter' && e.target === e.currentTarget)
                                onPickWeek(weekOffsetOf(c.d, today)); }, style: { opacity: c.inM ? 1 : 0.4, borderColor: c.k === tk ? '#23221F' : c.inW ? '#CFC9BC' : '#EFEBE3', background: c.inW ? '#F6F3EC' : '#fff' }, children: [_jsxs("span", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600 }, children: c.d.getDate() }), _jsx("button", { className: "cal-add", "aria-label": 'Add event on ' + c.d.getDate(), title: "Add event", onClick: e => { e.stopPropagation(); setDialog({ date: c.k, event: null }); }, children: "+" })] }), evs.map(ev => (_jsxs("button", { className: "cal-event", title: [ev.time, ev.title, ev.place].filter(Boolean).join(' · '), onClick: e => { e.stopPropagation(); setDialog({ date: ev.date, event: ev }); }, style: { background: soft(eventColor(ev)), borderLeft: '3px solid ' + eventColor(ev) }, children: [_jsxs("span", { className: "cal-event-text", children: [ev.time && _jsx("span", { className: "cal-event-time", children: ev.time }), ev.title] }), _jsx("span", { className: "cal-event-who", style: { background: OWNERS[ev.who].color }, "aria-label": OWNERS[ev.who].name, title: OWNERS[ev.who].name })] }, ev.id))), _jsx("span", { className: "cal-meal", children: c.meal }), _jsx("span", { style: { display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'auto' }, children: c.dots.map((dt, i) => _jsx("span", { style: { width: 7, height: 7, borderRadius: '50%', background: dt } }, i)) })] }, c.k));
                    })] }), dialog && _jsx(EventDialog, { D: D, update: update, date: dialog.date, event: dialog.event, onClose: () => setDialog(null) }), _jsx("p", { className: "note", style: { margin: '12px 0 0' }, children: "Tap + to add an event. Tap a day to open its week. Dots are chores." })] }));
}
