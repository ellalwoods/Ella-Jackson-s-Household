import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { key } from '../lib/dates';
import { donutOf, EXTRA_COLOR, money, nextOwner, OWNERS, uid } from '../lib/model';
import { AddRow } from './SetField';
import { weekBudget } from '../lib/food';
/**
 * Pie chart of `slices`. Hovering (or tapping) a segment shows its name,
 * amount and share in the middle in place of `children`.
 */
export function Donut({ slices, size, hole, children }) {
    const [hover, setHover] = useState(null);
    const shown = slices.filter(s => s.total > 0);
    const sum = shown.reduce((a, s) => a + s.total, 0);
    const pick = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
        const dist = Math.hypot(dx, dy), outer = r.width / 2;
        if (!sum || dist > outer || dist < outer - hole) {
            setHover(null);
            return;
        }
        const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; // 0° at the top, clockwise like conic-gradient
        let acc = 0;
        for (let i = 0; i < shown.length; i++) {
            acc += shown[i].total / sum * 360;
            if (deg < acc) {
                setHover(i);
                return;
            }
        }
        setHover(null);
    };
    const h = hover !== null ? shown[hover] : null;
    return (_jsxs("div", { className: "donut", style: { width: size, height: size, background: donutOf(shown) }, onPointerMove: pick, onPointerDown: pick, onPointerLeave: e => { if (e.pointerType === 'mouse')
            setHover(null); }, role: "img", "aria-label": shown.map(s => s.label + ' ' + money(s.total)).join(', '), children: [h && (_jsx("svg", { className: "donut-ring", viewBox: "0 0 100 100", "aria-hidden": true, children: (() => {
                    const start = shown.slice(0, hover).reduce((a, s) => a + s.total, 0) / sum, end = start + h.total / sum;
                    const pt = (f, rad) => [50 + rad * Math.sin(f * 2 * Math.PI), 50 - rad * Math.cos(f * 2 * Math.PI)];
                    const [x1, y1] = pt(start, 49), [x2, y2] = pt(end, 49);
                    const large = end - start > 0.5 ? 1 : 0;
                    return end - start >= 0.999
                        ? _jsx("circle", { cx: "50", cy: "50", r: "49", fill: "none", stroke: "#23221F", strokeWidth: "1.5" })
                        : _jsx("path", { d: 'M' + x1 + ' ' + y1 + ' A49 49 0 ' + large + ' 1 ' + x2 + ' ' + y2, fill: "none", stroke: "#23221F", strokeWidth: "2", strokeLinecap: "round" });
                })() })), _jsx("div", { className: "donut-hole", style: { inset: hole }, children: h ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 11, maxWidth: '90%', textAlign: 'center', lineHeight: 1.2 }, className: "muted", children: h.label }), _jsx("span", { style: { fontSize: size > 120 ? 18 : 15, fontWeight: 600 }, children: money(h.total) }), _jsxs("span", { style: { fontSize: 11 }, className: "muted", children: [Math.round(h.total / sum * 100), "%"] })] })) : children })] }));
}
export default function BudgetCard({ D, update, mon, onEdit }) {
    const wk = key(mon);
    const extras = D.extras[wk] ?? [];
    const b = weekBudget(D, mon);
    const [open, setOpen] = useState(null);
    return (_jsxs("section", { className: "card", style: { flex: '1 1 300px', padding: 20 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }, children: [_jsxs("h2", { style: { margin: 0, fontSize: 17, fontWeight: 600 }, children: ["Budget ", _jsx("span", { style: { fontWeight: 400, fontSize: 13 }, className: "muted", children: "this week" })] }), _jsx("button", { className: "link-btn", style: { fontSize: 13 }, onClick: onEdit, children: "Edit" })] }), _jsxs("div", { style: { display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }, children: [_jsxs(Donut, { slices: b.slices, size: 150, hole: 20, children: [_jsx("span", { style: { fontSize: 11 }, className: "muted", children: "Left" }), _jsxs("span", { style: { fontSize: 14, fontWeight: 600, color: '#A9477B' }, children: ["Ella ", money(b.ellaLeft)] }), _jsxs("span", { style: { fontSize: 14, fontWeight: 600, color: '#1B6B56' }, children: ["Jackson ", money(b.jacksonLeft)] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, flex: 1, minWidth: 140 }, children: [_jsxs("div", { className: "kv", children: [_jsx("span", { className: "muted", children: "Income" }), _jsx("span", { style: { fontWeight: 600 }, children: money(b.income) })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { className: "muted", children: "Committed" }), _jsx("span", { style: { fontWeight: 600 }, children: money(b.committed.total) })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { className: "muted", children: "Spent so far" }), _jsx("span", { children: money(b.spent.total) })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { style: { color: '#A9477B' }, children: "Ella pays" }), _jsx("span", { children: money(b.committed.e) })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { style: { color: '#1B6B56' }, children: "Jackson pays" }), _jsx("span", { children: money(b.committed.j) })] }), _jsxs("div", { className: "kv", style: { borderTop: '1px solid #F0ECE4', paddingTop: 6 }, children: [_jsx("span", { style: { color: '#A9477B' }, children: "Ella has left" }), _jsx("span", { style: { fontWeight: 600 }, children: money(b.ellaLeft) })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { style: { color: '#1B6B56' }, children: "Jackson has left" }), _jsx("span", { style: { fontWeight: 600 }, children: money(b.jacksonLeft) })] })] })] }), b.cats.map(c => (_jsx(CategoryRow, { c: c, open: open === c.id, onToggle: () => setOpen(o => (o === c.id ? null : c.id)), update: update, wk: wk }, c.id))), !b.cats.length && _jsx("p", { style: { fontSize: 13, margin: 0 }, className: "muted", children: "No categories yet." }), _jsx(WeekExtras, { extras: extras, total: b.extra.total, update: update, wk: wk })] }));
}
const OVER_INK = '#B0532F';
/** One faded half per person, filling with their colour as they spend. */
function FillBar({ c }) {
    // Ella fills from the left edge, Jackson from the right, meeting in the middle.
    const half = (budget, spent, color, tint, width, fromRight) => (_jsx("div", { style: { width, background: tint, position: 'relative' }, children: _jsx("div", { style: { position: 'absolute', top: 0, bottom: 0, [fromRight ? 'right' : 'left']: 0, width: (budget ? Math.min(1, spent / budget) * 100 : spent ? 100 : 0) + '%', background: color } }) }));
    const t = c.budget.total;
    const ew = t ? (c.budget.e / t * 100) + '%' : '50%', jw = t ? (c.budget.j / t * 100) + '%' : '50%';
    return (_jsxs("div", { className: "split-bar", style: { gap: 2, background: 'transparent' }, children: [half(c.budget.e, c.spent.e, '#E886B8', '#FAE3EE', ew, false), half(c.budget.j, c.spent.j, '#2A9E80', '#DAEFE7', jw, true)] }));
}
function CategoryRow({ c, open, onToggle, update, wk }) {
    const personLine = (spent, budget) => (c.fixed ? money(budget) : money(spent) + ' of ' + money(budget));
    return (_jsxs("div", { className: "cat-row", children: [_jsxs("button", { className: "cat-toggle", onClick: c.fixed ? undefined : onToggle, "aria-expanded": c.fixed ? undefined : open, style: { cursor: c.fixed ? 'default' : 'pointer' }, children: [_jsxs("span", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }, children: [_jsxs("span", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { className: "swatch", style: { background: c.color } }), c.name, c.pct !== null && _jsxs("span", { className: "muted", style: { fontSize: 12 }, children: [Math.round(c.pct), "% of left"] }), !c.fixed && _jsx("span", { className: 'cat-log' + (open ? ' on' : ''), "aria-hidden": true, children: open ? 'Close' : '+ Log' })] }), c.fixed ? _jsx("span", { style: { fontWeight: 600 }, children: money(c.budget.total) })
                                : c.over > 0 ? _jsxs("span", { style: { fontWeight: 600, color: OVER_INK }, children: [money(c.spent.total), " ", _jsxs("span", { style: { fontWeight: 400, fontSize: 12 }, children: ["\u00B7 ", money(c.over), " over"] })] })
                                    : _jsxs("span", { children: [_jsx("span", { style: { fontWeight: 600 }, children: money(c.spent.total) }), " ", _jsxs("span", { className: "muted", style: { fontSize: 12 }, children: ["of ", money(c.budget.total)] })] })] }), _jsx(FillBar, { c: c }), _jsxs("span", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12 }, children: [_jsx("span", { style: { color: c.spent.e > c.budget.e && !c.fixed ? OVER_INK : '#A9477B' }, children: personLine(c.spent.e, c.budget.e) }), _jsx("span", { style: { color: c.spent.j > c.budget.j && !c.fixed ? OVER_INK : '#1B6B56' }, children: personLine(c.spent.j, c.budget.j) })] })] }), open && !c.fixed && _jsx(SpendPanel, { c: c, update: update, wk: wk })] }));
}
/** Quick entry for what each person has spent in a category this week. */
function SpendPanel({ c, update, wk }) {
    const [who, setWho] = useState('ella');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const add = () => {
        const amt = parseFloat(amount);
        if (!amt)
            return;
        const s = { id: uid(), cat: c.id, amount: amt, who };
        if (note.trim())
            s.note = note.trim();
        update(d => { d.spends[wk] = [...(d.spends[wk] ?? []), s]; });
        setAmount('');
        setNote('');
    };
    const remove = (id) => update(d => {
        const left = (d.spends[wk] ?? []).filter(z => z.id !== id);
        if (left.length)
            d.spends[wk] = left;
        else
            delete d.spends[wk];
    });
    const onKey = (e) => { if (e.key === 'Enter')
        add(); };
    return (_jsxs("div", { className: "spend-panel", children: [c.grocery && _jsxs("div", { className: "note", children: ["Planned meals: ", money(c.mealCost), ", split 50/50. Log anything else you buy below."] }), c.spends.map(s => (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }, children: [_jsx(OwnerTag, { o: s.who }), _jsx("span", { style: { flex: 1, minWidth: 0 }, className: s.note ? '' : 'muted', children: s.note || 'Spend' }), _jsx("span", { children: money(+s.amount || 0) }), _jsx("button", { className: "link-btn", "aria-label": "Remove spend", onClick: () => remove(s.id), children: "Remove" })] }, s.id))), _jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(OwnerTag, { o: who, onClick: () => setWho(nextOwner(who)) }), _jsx("input", { className: "field-sm compact", style: { flex: '1 1 80px' }, value: note, onChange: e => setNote(e.target.value), onKeyDown: onKey, placeholder: "What for?", "aria-label": "What for" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", autoFocus: true, value: amount, onChange: e => setAmount(e.target.value), onKeyDown: onKey, placeholder: "$", "aria-label": "Amount spent" }), _jsx("button", { className: "pill-sm dark", onClick: add, children: "Add" })] })] }));
}
/** Who paid: tap to switch between Ella, Jackson and Both. Without onClick it's just a label. */
function OwnerTag({ o, onClick }) {
    return (_jsx("button", { className: "person-tag", title: onClick ? 'Who pays — tap to switch' : undefined, onClick: onClick, disabled: !onClick, style: { height: onClick ? 'var(--h-sm)' : 'var(--h-xs)', minWidth: 64, padding: '0 8px', flex: 'none', fontSize: 11, opacity: 1, background: OWNERS[o].tint, color: OWNERS[o].ink, cursor: onClick ? 'pointer' : 'default' }, children: OWNERS[o].name }));
}
/** One-off costs for the week on screen; they don't touch the recurring budget. */
function WeekExtras({ extras, total, update, wk }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [who, setWho] = useState('both');
    const edit = (id, f) => update(d => { const x = (d.extras[wk] ?? []).find(z => z.id === id); if (x)
        f(x); });
    const add = () => {
        const n = name.trim();
        if (!n)
            return;
        const x = { id: uid(), name: n, amount: parseFloat(amount) || 0, who };
        update(d => { d.extras[wk] = [...(d.extras[wk] ?? []), x]; });
        setName('');
        setAmount('');
        setOpen(false);
    };
    const remove = (id) => update(d => {
        const left = (d.extras[wk] ?? []).filter(z => z.id !== id);
        if (left.length)
            d.extras[wk] = left;
        else
            delete d.extras[wk];
    });
    return (_jsxs("div", { style: { borderTop: '1px solid #F0ECE4', paddingTop: 10, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsxs("span", { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }, children: [_jsx("span", { className: "swatch", style: { background: EXTRA_COLOR } }), "This week only"] }), total > 0 && _jsx("span", { style: { fontWeight: 600, fontSize: 14 }, children: money(total) })] }), extras.map(x => (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }, children: [_jsx(OwnerTag, { o: x.who, onClick: () => edit(x.id, z => { z.who = nextOwner(z.who); }) }), _jsx("span", { style: { flex: 1, minWidth: 0 }, children: x.name }), _jsx("span", { children: money(+x.amount || 0) }), _jsx("button", { className: "link-btn", "aria-label": 'Remove ' + x.name, onClick: () => remove(x.id), children: "Remove" })] }, x.id))), !extras.length && !open && _jsx("span", { className: "note", children: "One-off costs that don\u2019t change your regular budget." }), _jsx(AddRow, { label: "Add a one-off cost", open: open, onOpen: () => setOpen(true), children: _jsxs("div", { className: "add-open-row", children: [_jsx(OwnerTag, { o: who, onClick: () => setWho(nextOwner(who)) }), _jsx("input", { className: "field-sm compact", style: { flex: '1 1 80px' }, autoFocus: true, value: name, onChange: e => setName(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                add(); }, placeholder: "e.g. Birthday gift", "aria-label": "What for" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", value: amount, onChange: e => setAmount(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                add(); }, placeholder: "$", "aria-label": "Amount" }), _jsx("button", { className: "pill-sm dark", onClick: add, children: "Add" }), _jsx("button", { className: "link-btn", onClick: () => setOpen(false), children: "Cancel" })] }) })] }));
}
