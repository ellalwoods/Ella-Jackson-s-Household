import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { BLANK_PICK, EAT_OUT, eatOutName, MEAL_LABEL, MEALS, money, norm, occurs, OWNERS, PLACE_KIND_LABEL, uid, mealRecipes } from '../lib/model';
import { costContext, recipeCost, searchRecipes } from '../lib/food';
import BucketPickDialog from './BucketPickDialog';
import { PlaceDialog } from './PlacesPage';
export default function WeekTable({ D, update, mon }) {
    /** Open slot as `${dateKey}|${meal}`. */
    const [picker, setPicker] = useState(null);
    const [query, setQuery] = useState('');
    const [idx, setIdx] = useState(0);
    /** Slot whose bucket items are being picked. */
    const [picking, setPicking] = useState(null);
    /** Saving a typed "where" as a new place, for this slot. */
    const [newPlace, setNewPlace] = useState(null);
    const tk = key(new Date());
    const rBy = new Map(D.recipes.map(r => [r.id, r]));
    const prices = costContext(D);
    const cost = (r, slot) => recipeCost(r, prices, slot ? D.picks[slot] : undefined);
    const days = DOW.map((dow, i) => {
        const d = addDays(mon, i), k = key(d);
        const meals = MEALS.map(meal => ({ meal, slot: k + '|' + meal, r: rBy.get(D.plan[k]?.[meal] ?? ''), out: D.plan[k]?.[meal] === EAT_OUT }));
        const chores = D.chores.filter(c => occurs(c, d)).map(c => {
            const dk = k + '|' + c.id;
            return { c, dk, done: !!D.done[dk], p: OWNERS[c.person] };
        });
        return { k, dow, dateNum: d.getDate(), meals, isToday: k === tk, chores };
    });
    const planned = days.flatMap(d => d.meals.filter(m => m.r));
    const eatingOut = days.reduce((a, d) => a + d.meals.filter(m => m.out).length, 0);
    const mealTotal = planned.reduce((a, m) => a + cost(m.r, m.slot), 0);
    const allChores = days.flatMap(d => d.chores);
    // Picker: recipes tagged for this meal first (only those until you search), then name matches, then alphabetical.
    const pickMeal = (picker?.split('|')[1] ?? 'dinner');
    const pq = norm(query);
    const tagged = (r) => r.meals.includes(pickMeal);
    const meals = mealRecipes(D);
    const anyTagged = meals.some(tagged);
    const matches = searchRecipes(meals, query)
        .filter(r => pq || !anyTagged || tagged(r))
        .sort((a, b) => (+tagged(b) - +tagged(a)) || (norm(b.name).startsWith(pq) ? 1 : 0) - (norm(a.name).startsWith(pq) ? 1 : 0) || a.name.localeCompare(b.name));
    const pIdx = Math.min(idx, Math.max(0, matches.length - 1));
    const canCreate = !!pq && !meals.some(r => norm(r.name) === pq);
    const close = () => { setPicker(null); setQuery(''); };
    const setMeal = (slot, rid) => {
        const [k, meal] = slot.split('|');
        const changed = (D.plan[k]?.[meal] ?? null) !== rid;
        update(x => {
            const p = { ...(x.plan[k] ?? {}) };
            if (rid)
                p[meal] = rid;
            else
                delete p[meal];
            if (Object.keys(p).length)
                x.plan[k] = p;
            else
                delete x.plan[k];
            // Picks belong to the recipe that was there.
            if (changed) {
                delete x.picks[slot];
                delete x.eatOut[slot];
                delete x.eatOutPlace[slot];
            }
        });
        close();
        // A recipe with buckets asks straight away which items to use.
        const r = rid ? D.recipes.find(z => z.id === rid) : null;
        if (r?.buckets?.length && changed)
            setPicking(slot);
    };
    /** Plan a meal out at a saved place. */
    const choosePlace = (slot, p) => {
        const [k, meal] = slot.split('|');
        update(x => {
            x.plan[k] = { ...(x.plan[k] ?? {}), [meal]: EAT_OUT };
            delete x.picks[slot];
            x.eatOut[slot] = p.name;
            x.eatOutPlace[slot] = p.id;
        });
        close();
    };
    const placeLine = (p) => [PLACE_KIND_LABEL[p.kind], p.suburb, p.cost ? money(p.cost) + ' pp' : ''].filter(Boolean).join(' · ');
    const createFromPick = () => {
        const n = query.trim(), slot = picker;
        if (!n || !slot)
            return;
        const id = uid(), meal = slot.split('|')[1];
        update(x => { x.recipes.push({ id, name: n, meals: [meal], ingredients: [] }); });
        setMeal(slot, id);
    };
    const onKey = (e) => {
        if (e.key === 'Escape')
            close();
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIdx(Math.min(pIdx + 1, matches.length - 1));
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIdx(Math.max(pIdx - 1, 0));
        }
        else if (e.key === 'Enter') {
            if (matches[pIdx])
                setMeal(picker, matches[pIdx].id);
            else
                createFromPick();
        }
    };
    return (_jsxs("section", { className: "card", style: { flex: '2 1 560px' }, children: [_jsxs("div", { className: "week-grid meals-row week-colhead", children: [_jsx("span", { style: { display: 'block' }, children: "Day" }), MEALS.map(m => _jsx("span", { className: "col-meal", children: MEAL_LABEL[m] }, m)), _jsx("span", { className: "col-meals", children: _jsx("span", { children: "Meals & chores" }) }), _jsxs("span", { children: [_jsx("span", { className: "col-meal", children: "Chores" }), _jsxs("span", { className: "meta", children: [allChores.filter(c => c.done).length, "/", allChores.length, " done"] })] })] }), days.map(d => (_jsxs("div", { className: "week-grid meals-row week-row", style: { background: d.isToday ? '#FCFBF7' : '#fff' }, children: [_jsxs("div", { className: "day", style: { color: d.isToday ? '#23221F' : '#8A857A' }, children: [_jsx("span", { className: "day-dow", children: d.dow }), _jsx("span", { className: "day-num", children: d.dateNum })] }), _jsx("div", { className: "meal-slots", children: d.meals.map(({ meal, slot, r, out }, mi) => (_jsxs("div", { style: { position: 'relative', minWidth: 0 }, children: [_jsxs("button", { className: "slot-btn", onClick: () => { setPicker(slot); setQuery(''); setIdx(0); }, style: { borderColor: r || out ? '#E8E4DB' : '#EFEBE3', background: out ? '#F6F1EA' : r ? '#FBFAF7' : 'transparent' }, children: [_jsx("span", { className: "slot-label", children: MEAL_LABEL[meal] }), out ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "slot-name", style: { fontWeight: 500, color: '#23221F' }, children: ["\uD83C\uDF7D ", eatOutName(D, slot) || 'Eating out'] }), eatOutName(D, slot) && _jsxs("span", { className: "slot-cost", children: ["Eating out", (() => { const p = D.places.find(z => z.id === D.eatOutPlace[slot]); return p?.cost ? ' · ' + money(p.cost) + ' pp' : ''; })()] })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "slot-name", style: { fontWeight: r ? 500 : 400, color: r ? '#23221F' : '#A39D90' }, children: r ? r.name : '+' }), r && _jsx("span", { className: "slot-cost", children: money(cost(r, slot)) })] }))] }), r?.buckets?.length ? _jsx(BucketLine, { D: D, recipe: r, picks: D.picks[slot] ?? {}, onOpen: () => setPicking(slot) }) : null, picker === slot && (_jsxs(_Fragment, { children: [_jsx("div", { className: "scrim", onClick: close }), _jsxs("div", { className: 'picker' + (mi >= 2 ? ' picker-right' : ''), children: [_jsx("input", { className: "picker-input", autoFocus: true, value: query, placeholder: 'Search ' + MEAL_LABEL[meal].toLowerCase() + ' recipes or ingredients', onChange: e => { setQuery(e.target.value); setIdx(0); }, onKeyDown: onKey }), out && (() => {
                                                    const where = D.eatOut[slot] ?? '', wq = norm(where);
                                                    const atPlace = D.eatOutPlace[slot];
                                                    const ps = D.places.filter(p => p.id !== atPlace && (!wq || [p.name, p.suburb, ...(p.tags ?? [])].some(v => norm(v).includes(wq)))).slice(0, 6);
                                                    const known = D.places.some(p => norm(p.name) === wq);
                                                    return (_jsxs(_Fragment, { children: [_jsx("input", { className: "field-sm", placeholder: "Where? Type or pick a place", "aria-label": "Where you're eating out", value: where, onChange: e => { const v = e.target.value; update(x => { if (v.trim())
                                                                    x.eatOut[slot] = v;
                                                                else
                                                                    delete x.eatOut[slot]; delete x.eatOutPlace[slot]; }); }, onKeyDown: e => { if (e.key === 'Enter')
                                                                    close(); } }), ps.length > 0 && (_jsx("div", { className: "row", style: { gap: 4 }, children: ps.map(p => _jsx("button", { className: "mini-tag", onClick: () => choosePlace(slot, p), title: placeLine(p), children: p.name }, p.id)) })), where.trim() && !atPlace && !known && (_jsxs("button", { className: "link-btn", style: { alignSelf: 'flex-start' }, onClick: () => setNewPlace({ slot, name: where.trim() }), children: ["Save \u201C", where.trim(), "\u201D to Places"] }))] }));
                                                })(), _jsxs("div", { className: "picker-list", children: [matches.slice(0, 50).map((m, i) => (_jsxs("button", { className: "picker-item", onClick: () => setMeal(slot, m.id), style: { background: i === pIdx ? '#F5F2EC' : 'transparent' }, children: [_jsxs("span", { style: { display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }, children: [_jsx("span", { style: { fontSize: 14, fontWeight: 500 }, children: m.name }), _jsxs("span", { style: { fontSize: 12 }, className: "muted", children: [pq && !norm(m.name).includes(pq) ? 'Uses ' + m.ingredients.filter(g => norm(g.name).includes(pq)).map(g => g.name).join(', ') : m.ingredients.length + ' ingredients', !m.meals.includes(meal) && m.meals.length ? ' · ' + m.meals.map(x => MEAL_LABEL[x]).join(', ') : ''] })] }), _jsx("span", { style: { fontSize: 13 }, className: "muted", children: money(cost(m)) })] }, m.id))), !matches.length && !(pq && D.places.some(p => [p.name, p.suburb, ...(p.tags ?? [])].some(v => norm(v).includes(pq)))) && _jsx("span", { style: { fontSize: 13, padding: '8px 10px' }, className: "muted", children: "No recipes or places match." }), (() => {
                                                            // Typing a name also finds saved places, to plan a meal out there.
                                                            const ps = pq ? D.places.filter(p => [p.name, p.suburb, ...(p.tags ?? [])].some(v => norm(v).includes(pq))).slice(0, 8) : [];
                                                            return ps.length > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { className: "picker-group", children: "Places" }), ps.map(p => (_jsx("button", { className: "picker-item", onClick: () => choosePlace(slot, p), children: _jsxs("span", { style: { display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }, children: [_jsxs("span", { style: { fontSize: 14, fontWeight: 500 }, children: ["\uD83C\uDF7D ", p.name] }), _jsx("span", { style: { fontSize: 12 }, className: "muted", children: placeLine(p) })] }) }, p.id)))] }));
                                                        })()] }), _jsxs("div", { className: "picker-actions", children: [canCreate && _jsxs("button", { className: "pill-sm dark", onClick: createFromPick, children: ["+ New \u201C", query, "\u201D"] }), !out && _jsx("button", { className: "pill-sm", onClick: () => { setMeal(slot, EAT_OUT); setPicker(slot); }, children: "\uD83C\uDF7D Eat out" }), (r || out) && _jsx("button", { className: "pill-sm", onClick: () => setMeal(slot, null), children: "Clear" })] })] })] }))] }, meal))) }), _jsxs("div", { className: "chores-cell", children: [d.chores.map(({ c, dk, done, p }) => (_jsxs("button", { className: "chore-chip", style: { background: p.tint, color: p.ink, opacity: done ? 0.5 : 1 }, onClick: () => update(x => { if (x.done[dk])
                                    delete x.done[dk];
                                else
                                    x.done[dk] = 1; }), children: [_jsx("span", { className: "chore-check", style: { borderColor: p.color, background: done ? p.color : 'transparent' }, children: done ? '✓' : '' }), _jsx("span", { style: { textDecoration: done ? 'line-through' : 'none' }, children: c.name })] }, c.id))), !d.chores.length && _jsx("span", { style: { fontSize: 13, color: '#C2BCB0' }, children: "\u2014" })] })] }, d.k))), _jsxs("div", { className: "week-foot", children: [_jsxs("span", { children: [planned.length, " meal", planned.length === 1 ? '' : 's', " planned \u00B7 ", money(mealTotal), " \u00B7 ", money(mealTotal / 2), " each", eatingOut ? ' · ' + eatingOut + ' eating out' : ''] }), _jsxs("span", { style: { display: 'flex', gap: 12 }, children: [_jsxs("span", { className: "legend", children: [_jsx("span", { className: "dot8", style: { background: '#E886B8' } }), "Ella"] }), _jsxs("span", { className: "legend", children: [_jsx("span", { className: "dot8", style: { background: '#2A9E80' } }), "Jackson"] }), _jsxs("span", { className: "legend", children: [_jsx("span", { className: "dot8", style: { background: '#8FB0CF' } }), "Both"] })] })] }), picking && (() => {
                const [k, meal] = picking.split('|');
                const r = rBy.get(D.plan[k]?.[meal] ?? '');
                const day = days.find(d => d.k === k);
                return r ? (_jsx(BucketPickDialog, { D: D, recipe: r, label: (day?.dow ?? '') + ' ' + MEAL_LABEL[meal].toLowerCase(), picks: D.picks[picking] ?? {}, onSave: p => update(x => { x.picks[picking] = p; }), onClose: () => setPicking(null) })) : null;
            })(), newPlace && (_jsx(PlaceDialog, { D: D, update: update, place: null, initialName: newPlace.name, onClose: () => setNewPlace(null), onSaved: p => { update(x => { x.eatOutPlace[newPlace.slot] = p.id; x.eatOut[newPlace.slot] = p.name; }); close(); } }))] }));
}
/** Under a planned meal: what's been picked from each bucket, or how many are still to pick. */
function BucketLine({ D, recipe, picks, onOpen }) {
    const parts = (recipe.buckets ?? []).map(u => {
        const b = D.buckets.find(z => z.id === u.bucket), all = (picks[u.bucket] ?? []).slice(0, u.count);
        const got = all.filter(n => n !== BLANK_PICK);
        return b ? { name: b.name, got, blanks: all.length - got.length, missing: u.count - all.length } : null;
    }).filter((x) => !!x);
    if (!parts.length)
        return null;
    const todo = parts.some(p => p.missing > 0);
    return (_jsx("button", { className: 'bucket-line' + (todo ? ' todo' : ''), onClick: onOpen, title: "Choose bucket items", children: parts.map((p, i) => (_jsxs("span", { children: ["\uD83E\uDEA3 ", p.got.length ? p.name + ': ' + p.got.join(', ') : '', p.blanks ? (p.got.length ? ' + ' : p.name + ': ') + p.blanks + ' blank' + (p.blanks > 1 ? 's' : '') : '', p.missing > 0 ? (p.got.length || p.blanks ? ' · ' : '') + 'Pick ' + p.missing + (p.got.length || p.blanks ? ' more' : ' from ' + p.name) : ''] }, i))) }));
}
