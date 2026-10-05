import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { BLANK_PICK, money, norm } from '../lib/model';
import { costContext, fmtQty, itemCost, miniOf } from '../lib/food';
/** "Select 3 items from your Vegetables bucket": choose the actual items for a planned meal. */
export default function BucketPickDialog({ D, recipe, label, picks, onSave, onClose }) {
    const ctx = costContext(D);
    const uses = (recipe.buckets ?? []).map(u => ({ u, b: D.buckets.find(b => b.id === u.bucket) })).filter(x => x.b);
    const [chosen, setChosen] = useState(() => Object.fromEntries(uses.map(({ u }) => [u.bucket, (picks[u.bucket] ?? []).slice(0, u.count)])));
    /** With more than one bucket, they're shown one at a time, like steps. */
    const [step, setStep] = useState(0);
    const last = step >= uses.length - 1;
    /** Tag filter per bucket ('' = all items). */
    const [filter, setFilter] = useState({});
    const addBlank = (bucket, max) => setChosen(c => {
        const list = c[bucket] ?? [];
        return { ...c, [bucket]: [...(list.length >= max ? list.slice(1) : list), BLANK_PICK] };
    });
    const removeBlank = (bucket) => setChosen(c => {
        const list = c[bucket] ?? [], i = list.lastIndexOf(BLANK_PICK);
        return i < 0 ? c : { ...c, [bucket]: [...list.slice(0, i), ...list.slice(i + 1)] };
    });
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const toggle = (bucket, name, max) => setChosen(c => {
        const list = c[bucket] ?? [];
        const has = list.some(n => norm(n) === norm(name));
        if (has)
            return { ...c, [bucket]: list.filter(n => norm(n) !== norm(name)) };
        // At the limit, a new pick replaces the oldest, so one tap always does something.
        return { ...c, [bucket]: [...(list.length >= max ? list.slice(1) : list), name] };
    });
    return (_jsx("div", { className: "dialog-scrim", onClick: onClose, children: _jsxs("div", { className: "dialog", role: "dialog", "aria-modal": "true", "aria-label": 'Pick items for ' + recipe.name, onClick: e => e.stopPropagation(), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: 16 }, children: recipe.name }), _jsx("span", { className: "note", children: label })] }), uses.length > 1 && (_jsx("div", { className: "pick-steps", "aria-label": 'Bucket ' + (step + 1) + ' of ' + uses.length, children: uses.map(({ u, b }, i) => {
                        const done = (chosen[u.bucket] ?? []).length >= u.count;
                        return (_jsxs("button", { className: 'pick-step' + (i === step ? ' on' : '') + (done ? ' done' : ''), onClick: () => setStep(i), "aria-current": i === step ? 'step' : undefined, children: [_jsx("span", { className: "pick-step-num", children: done ? '✓' : i + 1 }), b.name] }, u.bucket));
                    }) })), uses.filter((_, i) => i === step).map(({ u, b }) => {
                    const list = chosen[u.bucket] ?? [];
                    const blanks = list.filter(n => n === BLANK_PICK).length;
                    const tag = filter[u.bucket] ?? '';
                    const items = b.items.filter(g => !tag || (g.tags ?? []).some(t => norm(t) === norm(tag)));
                    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsxs("span", { style: { fontSize: 14 }, children: ["Select ", u.count, " item", u.count === 1 ? '' : 's', " from your ", _jsx("strong", { children: b.name }), " bucket"] }), _jsxs("span", { className: "note", style: { color: list.length === u.count ? '#1B6B56' : undefined }, children: [list.length, " of ", u.count] })] }), (b.tags ?? []).length > 0 && (_jsx("div", { className: "row", style: { gap: 4 }, children: ['', ...b.tags].map(t => (_jsx("button", { className: 'mini-tag' + (tag === t ? ' on' : ''), "aria-pressed": tag === t, onClick: () => setFilter(f => ({ ...f, [u.bucket]: t })), children: t || 'All' }, t || 'all'))) })), _jsxs("div", { className: "pick-grid", children: [items.map(g => {
                                        const on = list.some(n => norm(n) === norm(g.name)), c = itemCost(g, ctx), mini = miniOf(g, ctx);
                                        return (_jsxs("button", { title: g.name, className: 'pick-item' + (on ? ' on' : ''), "aria-pressed": on, onClick: () => toggle(u.bucket, g.name, u.count), children: [_jsx("span", { className: "box-check", style: { width: 18, height: 18, borderRadius: 5, fontSize: 11, background: on ? '#23221F' : 'transparent' }, children: on ? '✓' : '' }), _jsxs("span", { className: "pick-name", children: [g.name, mini ? _jsx("span", { className: "muted", style: { fontSize: 11 }, children: " \u00B7 mini recipe" })
                                                            : ctx.staples.has(norm(g.name)) ? _jsx("span", { className: "muted", style: { fontSize: 11 }, children: " \u00B7 staple" })
                                                                : g.qty && g.unit && _jsxs("span", { className: "muted", style: { fontSize: 11 }, children: [" \u00B7 ", fmtQty(g.qty, g.unit)] })] }), c !== null && !ctx.staples.has(norm(g.name)) && _jsx("span", { className: "pick-price", children: money(c) })] }, g.name));
                                    }), !b.items.length && _jsx("span", { className: "note", children: "This bucket is empty. Add items to it on the Recipes page." }), b.items.length > 0 && !items.length && _jsxs("span", { className: "note", children: ["No items tagged ", tag, "."] })] }), _jsxs("div", { className: "row", style: { alignItems: 'center', gap: 6 }, children: [_jsx("button", { className: "mini-tag", onClick: () => addBlank(u.bucket, u.count), title: "Leave a spot empty: nothing bought, costs nothing", children: "+ Blank" }), blanks > 0 && (_jsxs("span", { className: "mini-tag on", children: [blanks, " blank", blanks > 1 ? 's' : '', _jsx("button", { className: "mini-tag-x", "aria-label": "Remove a blank", onClick: () => removeBlank(u.bucket), children: "\u00D7" })] })), _jsx("span", { className: "note", children: "Blanks leave a spot empty." })] })] }, u.bucket));
                }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }, children: [step > 0 && _jsx("button", { className: "pill plain", onClick: () => setStep(s => s - 1), children: "Back" }), last
                            ? _jsx("button", { className: "pill dark", style: { padding: '0 18px' }, onClick: () => { onSave(chosen); onClose(); }, children: "Done" })
                            : _jsx("button", { className: "pill dark", style: { padding: '0 18px' }, onClick: () => setStep(s => s + 1), children: "Next" }), _jsx("button", { className: "link-btn", onClick: onClose, children: "Later" }), _jsx("span", { className: "note", children: "Picked items go on the shopping list." })] })] }) }));
}
