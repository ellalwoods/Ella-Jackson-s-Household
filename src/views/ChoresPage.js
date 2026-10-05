import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DOW, key } from '../lib/dates';
import { CHORE_OWNERS, describe, nextOwner, norm, OWNERS, uid } from '../lib/model';
import { confirmRemove } from './confirm';
export default function ChoresPage({ D, update }) {
    const tk = key(new Date());
    const [q, setQ] = useState('');
    const [name, setName] = useState('');
    const [person, setPerson] = useState('ella');
    const [type, setType] = useState('weekly');
    const [days, setDays] = useState([]);
    const [n, setN] = useState('14');
    const [start, setStart] = useState(tk);
    const [date, setDate] = useState(tk);
    const [dom, setDom] = useState('1');
    const hq = norm(q);
    const list = D.chores.filter(c => !hq || norm(c.name).includes(hq) || norm(OWNERS[c.person].name).includes(hq));
    const add = () => {
        const nm = name.trim();
        if (!nm)
            return;
        let sched;
        if (type === 'weekly') {
            if (!days.length)
                return;
            sched = { type, days: days.slice() };
        }
        else if (type === 'every')
            sched = { type, n: Math.max(1, parseInt(n) || 7), start: start || tk };
        else if (type === 'monthly')
            sched = { type, dom: Math.min(31, Math.max(1, parseInt(dom) || 1)) };
        else
            sched = { type, date: date || tk };
        const chore = { id: uid(), name: nm, person, sched };
        update(x => { x.chores.push(chore); });
        setName('');
        setDays([]);
    };
    const pick = (p) => {
        const on = person === p, c = OWNERS[p];
        return (_jsx("button", { className: "owner-pick", "aria-pressed": on, onClick: () => setPerson(p), style: { borderColor: c.color, background: on ? c.color : '#fff', color: on ? '#fff' : c.ink }, children: c.name }, p));
    };
    return (_jsxs("div", { className: "two-col", children: [_jsxs("section", { style: { minWidth: 0 }, children: [_jsx("input", { className: "search", style: { width: '100%', marginBottom: 10 }, value: q, onChange: e => setQ(e.target.value), placeholder: "Search chores" }), _jsxs("div", { className: "card", style: { padding: '4px 18px' }, children: [list.map((c, i) => {
                                const p = OWNERS[c.person];
                                return (_jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid #F0ECE4' : 'none' }, children: [_jsx("button", { className: "person-tag", title: "Switch person", style: { height: 'var(--h-xs)', minWidth: 74, padding: '0 10px', flex: 'none', background: p.tint, color: p.ink }, onClick: () => update(x => { const z = x.chores.find(z => z.id === c.id); if (z)
                                                z.person = nextOwner(z.person); }), children: p.name }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15 }, children: c.name }), _jsx("div", { style: { fontSize: 12 }, className: "muted", children: describe(c.sched) })] }), _jsx("button", { className: "link-btn", onClick: () => { if (confirmRemove('“' + c.name + '”'))
                                                update(x => { x.chores = x.chores.filter(z => z.id !== c.id); }); }, children: "Remove" })] }, c.id));
                            }), !list.length && _jsx("p", { className: "empty", children: q ? 'No chores match “' + q + '”.' : 'No chores yet. Add one with New chore.' })] }), list.length > 0 && _jsx("p", { className: "note", style: { margin: '8px 2px 0' }, children: "Tap a name to change who does it." })] }), _jsxs("aside", { className: "add-panel", style: { marginBottom: 0 }, children: [_jsx("div", { className: "add-panel-title", children: "+ New chore" }), _jsx("input", { className: "field-sm compact", value: name, onChange: e => setName(e.target.value), placeholder: "Chore, e.g. Take bins out", "aria-label": "Chore" }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: CHORE_OWNERS.map(pick) }), _jsxs("select", { className: "field-sm compact", value: type, "aria-label": "How often", onChange: e => setType(e.target.value), children: [_jsx("option", { value: "weekly", children: "Weekly on chosen days" }), _jsx("option", { value: "every", children: "Every N days" }), _jsx("option", { value: "monthly", children: "Monthly on a date" }), _jsx("option", { value: "once", children: "One-off" })] }), type === 'weekly' && (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }, children: DOW.map((l, i) => {
                            const on = days.indexOf(i) >= 0;
                            return (_jsx("button", { onClick: () => setDays(on ? days.filter(z => z !== i) : days.concat(i)), style: { height: 'var(--h-sm)', borderRadius: 'var(--r-field)', cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1px solid #DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }, children: l }, l));
                        }) })), type === 'every' && (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, flexWrap: 'wrap' }, children: ["Every ", _jsx("input", { className: "field-sm compact num", value: n, onChange: e => setN(e.target.value), inputMode: "numeric", "aria-label": "Number of days" }), " days from", ' ', _jsx("input", { className: "field-sm compact", type: "date", value: start, onChange: e => setStart(e.target.value), "aria-label": "Starting" })] })), type === 'monthly' && (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }, children: ["On day ", _jsx("input", { className: "field-sm compact num", value: dom, onChange: e => setDom(e.target.value), inputMode: "numeric", "aria-label": "Day of the month" }), " of each month"] })), type === 'once' && _jsx("input", { className: "field-sm compact", type: "date", value: date, onChange: e => setDate(e.target.value), "aria-label": "Date" }), _jsx("button", { className: "pill-sm dark", onClick: add, children: "Add chore" })] })] }));
}
