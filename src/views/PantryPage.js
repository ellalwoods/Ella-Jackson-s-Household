import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { MON, parse } from '../lib/dates';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { INCLUDE_LOW, money, NO_EXPIRY, norm, STATE_COLORS, STATES, UNIT_LABEL, UNITS } from '../lib/model';
import { addToPantry, expiry, fmtQty, priceMap, setPrice } from '../lib/food';
import { SetField } from './SetField';
export const stockRule = (INCLUDE_LOW
    ? 'Low and Replace go on the shopping list; Full and Half don’t.'
    : 'Only Replace goes on the shopping list.') +
    ' Tracked amounts are used before buying more.';
export default function PantryPage({ D, update }) {
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('All');
    const prices = priceMap(D);
    const cq = norm(q);
    const levelOf = (c) => (c.qty != null ? null : c.state);
    const expiring = (c) => { const e = expiry(c.expires); return !!e && (e.soon || e.expired); };
    const matches = (c, f) => f === 'All' || (f === 'Expiring' ? expiring(c) : levelOf(c) === f);
    const items = D.pantry
        .filter(c => (!cq || norm(c.name).includes(cq)) && matches(c, filter))
        .sort((a, b) => a.name.localeCompare(b.name));
    // Items are keyed by name so edits still land correctly after a sync.
    const edit = (name, f) => update(x => { const c = x.pantry.find(c => c.name === name); if (c)
        f(c); });
    const remove = (name) => update(x => { x.pantry = x.pantry.filter(c => c.name !== name); });
    return (_jsxs(_Fragment, { children: [_jsx(AddToPantry, { D: D, update: update }), _jsx("input", { className: "search", style: { width: '100%', marginBottom: 10 }, value: q, onChange: e => setQ(e.target.value), placeholder: "Search the pantry", "aria-label": "Search the pantry" }), _jsx("div", { className: "filter-rows", children: _jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Show" }), _jsx("div", { className: "seg", role: "group", "aria-label": "Filter by stock level", children: ['All', ...STATES, 'Expiring'].map(f => {
                                const on = filter === f;
                                const cnt = D.pantry.filter(c => matches(c, f)).length;
                                return _jsxs("button", { className: on ? 'on' : '', "aria-pressed": on, onClick: () => setFilter(f), children: [f, " ", _jsx("span", { className: "seg-count", children: cnt })] }, f);
                            }) })] }) }), _jsx("div", { className: "auto-grid", style: { gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,264px),1fr))', gap: 10 }, children: items.map(c => {
                    const n = D.recipes.filter(r => r.ingredients.some(g => norm(g.name) === norm(c.name))).length;
                    const pr = prices.get(norm(c.name));
                    return (_jsxs("div", { className: "card", style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsxs("span", { style: { display: 'flex', flexDirection: 'column', minWidth: 0 }, children: [_jsx("span", { style: { fontSize: 15, fontWeight: 600 }, children: c.name }), n > 0 && _jsxs("span", { style: { fontSize: 12 }, className: "muted", children: ["In ", n, " recipe", n > 1 ? 's' : ''] })] }), _jsxs("span", { style: { display: 'flex', gap: 12, flex: 'none' }, children: [_jsx("button", { className: "link-btn", onClick: () => edit(c.name, z => {
                                                    if (z.qty != null) {
                                                        delete z.qty;
                                                        delete z.unit;
                                                        delete z.forWeek;
                                                        z.state = 'Full';
                                                    }
                                                    else {
                                                        z.qty = 0;
                                                        z.unit = pr?.unit ?? 'g';
                                                    }
                                                }), children: c.qty != null ? 'Track by level' : 'Track amount' }), _jsx("button", { className: "link-btn", onClick: () => remove(c.name), children: "Remove" })] })] }), c.qty != null ? (_jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center' }, children: [_jsx("span", { style: { width: 'var(--w-num)' }, children: _jsx(SetField, { value: String(c.qty), numeric: true, align: "right", label: 'Amount of ' + c.name + ' left', onCommit: v => edit(c.name, z => { z.qty = parseFloat(v) || 0; }) }) }), _jsx(UnitSelect, { value: c.unit ?? 'g', onChange: u => edit(c.name, z => { z.unit = u; }), compact: true }), _jsx("span", { style: { fontSize: 12 }, className: "muted", children: "left" })] })) : (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4 }, children: STATES.map(st => {
                                    const on = c.state === st;
                                    return (_jsx("button", { className: "state-btn", onClick: () => edit(c.name, z => { z.state = st; }), style: { background: on ? STATE_COLORS[st] : '#fff', borderColor: on ? STATE_COLORS[st] : '#DDD8CC' }, children: st }, st));
                                }) })), _jsxs("div", { className: "card-fields", children: [_jsx(ExpiryInput, { label: "Use by", compact: true, value: c.expires ?? '', onChange: v => edit(c.name, z => { if (v)
                                            z.expires = v;
                                        else
                                            delete z.expires; }) }), _jsx(PriceField, { name: c.name, update: update, price: pr }, String(pr?.price)), (() => { const e = expiry(c.expires); return e && (e.soon || e.expired) ? _jsx("span", { className: 'exp-chip ' + (e.expired ? 'expired' : 'soon'), children: e.label }) : null; })()] })] }, c.name));
                }) }), !items.length && _jsx("p", { className: "empty", children: "Nothing here. Add what you have so the shopping list can skip it." }), _jsxs("p", { className: "note", style: { marginTop: 14 }, children: [stockRule, " Expired items go back on the list."] })] }));
}
export function UnitSelect({ value, onChange, compact = false }) {
    return (_jsx("select", { className: 'field-sm unit' + (compact ? ' compact' : ''), value: value, onChange: e => onChange(e.target.value), "aria-label": "Unit", children: UNITS.map(u => _jsx("option", { value: u, children: UNIT_LABEL[u] }, u)) }));
}
/** Add something to the pantry by hand: a name and, optionally, how much and when it's used by. */
function AddToPantry({ D, update }) {
    const [name, setName] = useState('');
    const [qty, setQty] = useState('');
    const [unit, setUnit] = useState('each');
    const [expires, setExpires] = useState('');
    const [price, setPrice_] = useState('');
    const existing = D.pantry.find(c => norm(c.name) === norm(name));
    const knownPrice = D.prices.find(p => norm(p.name) === norm(name));
    const known = Array.from(new Set([...D.prices.map(p => p.name), ...D.recipes.flatMap(r => r.ingredients.map(g => g.name))]))
        .filter(n => !D.pantry.some(c => norm(c.name) === norm(n))).sort();
    const add = () => {
        const n = name.trim();
        if (!n)
            return;
        const q = parseFloat(qty), pr = parseFloat(price);
        update(x => {
            addToPantry(x, { name: n, ...(q > 0 ? { qty: q, unit } : {}), ...(expires ? { expires } : {}) });
            // The amount added is what you bought, so it doubles as the pack size for the price.
            if (!isNaN(pr))
                setPrice(x, n, pr, q > 0 ? q : undefined, unit);
        });
        setName('');
        setQty('');
        setExpires('');
        setPrice_('');
    };
    const onKey = (e) => { if (e.key === 'Enter')
        add(); };
    return (_jsxs("div", { className: "add-panel", children: [_jsx("div", { className: "add-panel-title", children: "+ Add to pantry" }), _jsxs("div", { className: "shop-add", style: { padding: 0 }, children: [_jsx("input", { className: "field-sm compact", style: { flex: '1 1 180px' }, list: "pantry-known", value: name, onChange: e => setName(e.target.value), onKeyDown: onKey, placeholder: "Item, e.g. Rice", "aria-label": "Item to add to pantry" }), _jsx("datalist", { id: "pantry-known", children: known.map(k => _jsx("option", { value: k }, k)) }), _jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Amount" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", value: qty, onChange: e => setQty(e.target.value), onKeyDown: onKey, placeholder: "qty", "aria-label": "Amount" }), _jsx(UnitSelect, { value: unit, onChange: setUnit, compact: true })] }), _jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Price $" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", value: price, onChange: e => setPrice_(e.target.value), onKeyDown: onKey, placeholder: knownPrice ? knownPrice.price.toFixed(2) : '0.00', "aria-label": "Price" })] }), _jsx("span", { className: "ing-group", children: _jsx(ExpiryInput, { label: "Use by", compact: true, value: expires, onChange: setExpires }) }), _jsx("button", { className: "pill-sm dark", style: { padding: '0 16px' }, onClick: add, children: "Add" })] }), _jsx("span", { className: "note", children: existing ? existing.name + ' is already here — an amount adds to it.' : 'Only the name is needed. Price is for the amount given.' })] }));
}
/**
 * A use-by date box with an "N/A" button for things that don't expire.
 * The value is a date key, NO_EXPIRY, or '' for not set.
 */
export function ExpiryInput({ label, value, onChange, compact = false }) {
    const [editing, setEditing] = useState(false);
    const none = value === NO_EXPIRY, dated = !!value && !none;
    // The date box, its N/A button and the set-date pill all share one height.
    const h = compact ? 'var(--h-sm)' : 'var(--h-md)';
    const d = dated ? parse(value) : null;
    // A chosen date (or N/A) shows as a filled pill; tap it to change, × to clear.
    if ((dated && !editing) || none) {
        return (_jsxs("span", { className: "expiry-input", children: [_jsx("span", { className: "ing-label", children: label }), _jsxs("span", { className: "date-pill", style: { height: h }, children: [_jsx("button", { className: "date-pill-main", onClick: () => { if (dated)
                                setEditing(true); }, disabled: none, title: dated ? 'Change date' : undefined, "aria-label": dated ? label + ' ' + value + ', change' : 'No expiry', children: none ? 'No expiry' : DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] }), _jsx("button", { className: "date-pill-x", "aria-label": 'Clear ' + label.toLowerCase(), onClick: () => onChange(''), children: "\u00D7" })] })] }));
    }
    return (_jsxs("span", { className: "expiry-input", children: [_jsx("span", { className: "ing-label", children: label }), _jsx("input", { type: "date", className: 'field-sm' + (compact ? ' compact' : ''), style: { fontSize: 13 }, value: value, autoFocus: editing, "aria-label": label, onChange: e => { onChange(e.target.value); if (e.target.value)
                    setEditing(false); }, onBlur: () => setEditing(false) }), _jsx("button", { className: "filter", "aria-pressed": false, title: "Doesn\u2019t expire", onClick: () => { setEditing(false); onChange(NO_EXPIRY); }, style: { height: h, fontSize: 12, padding: '0 12px', borderColor: '#DDD8CC', background: '#fff', color: '#23221F' }, children: "N/A" })] }));
}
/**
 * A pantry item's purchase price, shared with recipes and the shopping list.
 * Once set it shows as a soft chip (like the use-by date); tap it to change.
 */
function PriceField({ name, update, price }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(price ? String(price.price) : '');
    const pack = price && price.qty && !(price.qty === 1 && price.unit === 'each') ? fmtQty(price.qty, price.unit) : '';
    const save = () => {
        const v = parseFloat(text);
        if (!isNaN(v) && v !== price?.price)
            update(x => setPrice(x, name, v));
        if (isNaN(v))
            setText(price ? String(price.price) : '');
        setEditing(false);
    };
    if (price && !editing) {
        return (_jsxs("span", { className: "expiry-input", children: [_jsx("span", { className: "ing-label", children: "Price" }), _jsx("span", { className: "set-pill", children: _jsxs("button", { className: "set-pill-main", onClick: () => { setText(String(price.price)); setEditing(true); }, title: "Change price", "aria-label": 'Price of ' + name + ', change', children: [_jsx("strong", { children: money(price.price) }), pack && _jsxs("span", { children: ["/ ", pack] })] }) })] }));
    }
    return (_jsxs("span", { className: "expiry-input", children: [_jsx("span", { className: "ing-label", children: "Price" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", value: text, placeholder: "$0.00", autoFocus: editing, "aria-label": 'Price of ' + name, onChange: e => setText(e.target.value), onBlur: save, onKeyDown: e => { if (e.key === 'Enter')
                    e.target.blur(); if (e.key === 'Escape') {
                    setText(price ? String(price.price) : '');
                    setEditing(false);
                } } })] }));
}
