import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { addDays, key } from '../lib/dates';
import { money, norm, SHOP_SECTION_LABEL, SHOP_SECTIONS, uid } from '../lib/model';
import { buyText, fmtAmount, guessSection, shoppingText, stockUp } from '../lib/food';
import { ExpiryInput, stockRule, UnitSelect } from './PantryPage';
const TICKS_KEY = 'hh-shop-ticks';
const EXPIRY_KEY = 'hh-shop-expiry';
const VIEW_KEY = 'hh-shop-view';
const SORTS = [['type', 'By type'], ['day', 'By day'], ['az', 'A–Z']];
/** Ticks and expiry dates are per device (whoever is at the shops), remembered across reloads. */
function useStored(storageKey) {
    const [v, setV] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '{}');
        }
        catch {
            return {};
        }
    });
    useEffect(() => { try {
        localStorage.setItem(storageKey, JSON.stringify(v));
    }
    catch { /* blocked */ } }, [storageKey, v]);
    return [v, setV];
}
export default function ShopPage({ update, mon, label, items, skipped, pending = [] }) {
    const [ticks, setTicks] = useStored(TICKS_KEY);
    const [dates, setDates] = useStored(EXPIRY_KEY);
    const [view, setView] = useStored(VIEW_KEY);
    const sortBy = view.sort || 'type';
    const only = view.only || 'all';
    const [copied, setCopied] = useState(false);
    const wk = key(mon);
    const tick = (i) => wk + '|' + i.id;
    const isTicked = (i) => !!ticks[tick(i)];
    const total = items.reduce((a, i) => a + (i.cost ?? 0), 0);
    const text = () => shoppingText(label + ' ' + addDays(mon, 6).getFullYear(), items, skipped);
    const copy = () => {
        const txt = text();
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = txt;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
            }
            catch { /* ignore */ }
            ta.remove();
            setCopied(true);
        };
        if (navigator.clipboard)
            navigator.clipboard.writeText(txt).then(() => setCopied(true), fallback);
        else
            fallback();
    };
    const print = () => {
        const w = window.open('', '_blank');
        if (!w)
            return;
        w.document.write('<pre style="font:16px/1.7 Figtree,system-ui,sans-serif;padding:32px;white-space:pre-wrap">' + text().replace(/</g, '&lt;') + '</pre>');
        w.document.close();
        w.focus();
        w.print();
    };
    const stockTicked = () => {
        const got = items.filter(isTicked);
        const exp = {};
        got.forEach(i => { const d = dates[tick(i)]; if (d)
            exp[i.id] = d; });
        update(x => stockUp(x, got, wk, exp));
        setDates(ds => { const n = { ...ds }; got.forEach(i => delete n[tick(i)]); return n; });
        // Hand-added items leave the list once they're in the pantry.
        setTicks(t => { const n = { ...t }; got.filter(i => i.manual).forEach(i => delete n[tick(i)]); return n; });
    };
    const removeManual = (id) => update(x => {
        const left = (x.shopExtras[wk] ?? []).filter(m => m.id !== id);
        if (left.length)
            x.shopExtras[wk] = left;
        else
            delete x.shopExtras[wk];
    });
    const addManual = (m, section) => update(x => {
        x.shopExtras[wk] = [...(x.shopExtras[wk] ?? []), m];
        x.shopSections[norm(m.name)] = section;
    });
    const setSection = (i, section) => update(x => { x.shopSections[i.lk] = section; });
    // Type filter, then either grouped by type or one list in day or A–Z order.
    const shown = items.filter(i => only === 'all' || i.section === only);
    const groups = sortBy === 'type'
        ? SHOP_SECTIONS.map(sec => ({ sec, list: shown.filter(i => i.section === sec) })).filter(g => g.list.length)
        : [{ sec: null, list: sortBy === 'az' ? shown.slice().sort((a, b) => a.name.localeCompare(b.name)) : shown }];
    return (_jsxs("div", { className: "two-col", children: [_jsxs("div", { children: [_jsx(AddItem, { onAdd: addManual }), _jsxs("section", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { className: "card-title", children: ["To buy ", _jsxs("span", { className: "sub", children: [items.length, " item", items.length === 1 ? '' : 's'] }), _jsxs("span", { className: "card-title-end row8", children: [_jsx("button", { className: "pill-sm", onClick: copy, children: copied ? 'Copied ✓' : 'Copy' }), _jsx("button", { className: "pill-sm", onClick: print, children: "Print" })] })] }), pending.length > 0 && (_jsxs("div", { className: "pending-picks", children: [_jsx("strong", { children: "Still to pick from buckets" }), " \u2014 tap the meal on the week page to choose:", _jsx("ul", { children: pending.map(p => _jsx("li", { children: p }, p)) })] })), items.length > 0 && (_jsxs("div", { className: "filter-rows", children: [_jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Sort" }), _jsx("div", { className: "seg", role: "group", "aria-label": "Sort", children: SORTS.map(([k, l]) => (_jsx("button", { "aria-pressed": sortBy === k, className: sortBy === k ? 'on' : '', onClick: () => setView(v => ({ ...v, sort: k })), children: l }, k))) })] }), _jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Show" }), _jsx("div", { className: "seg", role: "group", "aria-label": "Show section", children: ['all', ...SHOP_SECTIONS].map(f => {
                                                    const on = only === f, n = f === 'all' ? items.length : items.filter(i => i.section === f).length;
                                                    if (f !== 'all' && !n)
                                                        return null;
                                                    return (_jsxs("button", { className: on ? 'on' : '', "aria-pressed": on, onClick: () => setView(v => ({ ...v, only: f })), children: [f === 'all' ? 'All' : SHOP_SECTION_LABEL[f], " ", _jsx("span", { className: "seg-count", children: n })] }, f));
                                                }) })] })] })), groups.map(({ sec, list }) => (_jsxs("div", { className: "shop-group", children: [sec && (_jsxs("div", { className: "shop-group-head", children: [_jsx("span", { children: SHOP_SECTION_LABEL[sec] }), _jsx("span", { className: "muted", children: list.length })] })), list.map(i => {
                                        const ck = isTicked(i);
                                        return (_jsxs("div", { className: "shop-row", children: [_jsxs("button", { className: "shop-item", style: { opacity: ck ? 0.55 : 1 }, onClick: () => setTicks(t => ({ ...t, [tick(i)]: !t[tick(i)] })), children: [_jsx("span", { className: "box-check", style: { background: ck ? '#23221F' : 'transparent' }, children: ck ? '✓' : '' }), _jsxs("span", { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }, children: [_jsx("span", { style: { fontSize: 15, textDecoration: ck ? 'line-through' : 'none' }, children: i.name }), _jsxs("span", { style: { fontSize: 12 }, className: "muted", children: [i.manual ? 'Added by you' : 'For ' + i.days.join(', '), i.staple ? ' · staple' : '', i.need ? ' · uses ' + fmtAmount(i.need) : '', i.buy ? ' · buy ' + buyText(i) : '', i.status !== 'Not stocked' && _jsxs("span", { className: "phone-inline", children: [" \u00B7 ", i.status] })] })] })] }), _jsxs("span", { className: "shop-side", children: [_jsxs("span", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { className: "chip wide-inline", style: { fontSize: 11, padding: '3px 8px' }, children: i.status }), i.cost !== null && _jsx("span", { style: { fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: 'right' }, children: money(i.cost) })] }), _jsxs("span", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("select", { className: "section-select", value: i.section, onChange: e => setSection(i, e.target.value), "aria-label": 'Section for ' + i.name, children: SHOP_SECTIONS.map(x => _jsx("option", { value: x, children: SHOP_SECTION_LABEL[x] }, x)) }), i.manual && _jsx("button", { className: "link-btn", style: { fontSize: 12 }, "aria-label": 'Remove ' + i.name, onClick: () => removeManual(i.manual), children: "Remove" })] })] }), ck && (_jsxs("div", { className: "shop-expiry", children: [_jsx(ExpiryInput, { label: "Use by", compact: true, value: dates[tick(i)] ?? '', onChange: v => setDates(ds => ({ ...ds, [tick(i)]: v })) }), !dates[tick(i)] && _jsx("span", { className: "note", children: "optional" })] }))] }, i.id));
                                    })] }, sec ?? 'all'))), total > 0 && (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, padding: '12px 0 0', borderTop: '1px solid #23221F' }, children: [_jsx("span", { children: "Estimated total" }), _jsx("span", { children: money(total) })] })), items.length > 0 && !shown.length && _jsx("p", { className: "empty", style: { padding: '12px 0', margin: 0 }, children: "Nothing in this section." }), !items.length && _jsx("p", { className: "empty", style: { padding: '16px 0', margin: 0 }, children: "Nothing to buy \u2014 plan some meals, add an item above, or everything's already in the pantry." }), items.some(isTicked) && (_jsx("button", { className: "pill dark", style: { marginTop: 12 }, onClick: stockTicked, children: "Add ticked items to pantry" }))] })] }), _jsxs("aside", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { className: "card-title", children: ["Already in the pantry ", _jsx("span", { className: "sub", children: "skipped" })] }), _jsx("div", { className: "row", children: skipped.map(s => _jsxs("span", { className: "chip", children: [s.name, " \u00B7 ", s.note] }, s.name)) }), !skipped.length && _jsx("p", { style: { fontSize: 13, margin: 0 }, className: "muted", children: "Nothing skipped this week." }), _jsx("p", { className: "note", style: { margin: '14px 0 0' }, children: stockRule })] })] }));
}
/** Add something that isn't part of a recipe: a name, and optionally how much and what it costs. */
function AddItem({ onAdd }) {
    const [name, setName] = useState('');
    const [qty, setQty] = useState('');
    const [unit, setUnit] = useState('each');
    const [price, setPrice] = useState('');
    /** Picked by hand; otherwise follows a guess from the name. */
    const [picked, setPicked] = useState(null);
    const section = picked ?? guessSection(name);
    const add = () => {
        const n = name.trim();
        if (!n)
            return;
        const m = { id: uid(), name: n };
        const q = parseFloat(qty), pr = parseFloat(price);
        if (q > 0) {
            m.qty = q;
            m.unit = unit;
        }
        if (!isNaN(pr))
            m.price = pr;
        onAdd(m, section);
        setName('');
        setQty('');
        setPrice('');
        setPicked(null);
    };
    const onKey = (e) => { if (e.key === 'Enter')
        add(); };
    return (_jsxs("div", { className: "add-panel", children: [_jsx("div", { className: "add-panel-title", children: "+ Add to the list" }), _jsxs("div", { className: "shop-add", style: { padding: 0 }, children: [_jsx("input", { className: "field-sm compact", style: { flex: '1 1 160px' }, value: name, onChange: e => setName(e.target.value), onKeyDown: onKey, placeholder: "Item, e.g. Milk", "aria-label": "Item to add" }), _jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Amount" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", value: qty, onChange: e => setQty(e.target.value), onKeyDown: onKey, placeholder: "qty", "aria-label": "Amount" }), _jsx(UnitSelect, { value: unit, onChange: setUnit, compact: true })] }), _jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Price $" }), _jsx("input", { className: "field-sm compact num", inputMode: "decimal", value: price, onChange: e => setPrice(e.target.value), onKeyDown: onKey, placeholder: "0.00", "aria-label": "Price" })] }), _jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label phone-only", children: "Section" }), _jsx("select", { className: "field-sm compact", style: { width: 104 }, value: section, onChange: e => setPicked(e.target.value), "aria-label": "Section", children: SHOP_SECTIONS.map(x => _jsx("option", { value: x, children: SHOP_SECTION_LABEL[x] }, x)) })] }), _jsx("button", { className: "pill-sm dark", style: { padding: '0 16px' }, onClick: add, children: "Add" })] })] }));
}
