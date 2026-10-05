import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { MEAL_LABEL, mealRecipes, MEALS, miniRecipes, money, norm, STATE_COLORS } from '../lib/model';
import { bucketAverage, fmtQty, isStocked, itemCost, costContext, miniCost, miniOf, recipeCost, searchRecipes } from '../lib/food';
import RecipeEditor, { safeLink } from './RecipeEditor';
import { confirmRemove } from './confirm';
import TagFilter from './TagFilter';
export default function RecipesPage({ D, update, mon }) {
    const [q, setQ] = useState('');
    /** null = closed, 'new' / 'mini:new' / 'bucket:new' = adding, 'bucket:<id>' or a recipe id = editing. */
    const [editing, setEditing] = useState(null);
    const [openMethod, setOpenMethod] = useState({});
    const [mealFilter, setMealFilter] = useState('all');
    const [tagFilter, setTagFilter] = useState('');
    /** Tag filter per bucket card ('' = all). */
    const [bucketTag, setBucketTag] = useState({});
    const pantry = new Map(D.pantry.map(c => [norm(c.name), c]));
    const prices = costContext(D);
    const weekKeys = DOW.map((_, i) => key(addDays(mon, i)));
    const mains = mealRecipes(D);
    const minis = searchRecipes(miniRecipes(D), q).sort((a, b) => a.name.localeCompare(b.name));
    const recipes = searchRecipes(mains, q).filter(r => mealFilter === 'all' || r.meals.includes(mealFilter))
        .filter(r => !tagFilter || (r.tags ?? []).some(x => norm(x) === norm(tagFilter))).sort((a, b) => a.name.localeCompare(b.name));
    const editingBucket = editing?.startsWith('bucket:');
    const editingRecipe = editing && editing !== 'new' && editing !== 'mini:new' && !editingBucket ? D.recipes.find(r => r.id === editing) ?? null : null;
    const editKind = editingBucket ? 'bucket' : editing === 'mini:new' || editingRecipe?.mini ? 'mini' : 'recipe';
    const bucketBeingEdited = editingBucket ? D.buckets.find(b => 'bucket:' + b.id === editing) ?? null : null;
    const removeBucket = (id) => update(x => {
        x.buckets = x.buckets.filter(b => b.id !== id);
        for (const r of x.recipes)
            if (r.buckets) {
                r.buckets = r.buckets.filter(u => u.bucket !== id);
                if (!r.buckets.length)
                    delete r.buckets;
            }
        for (const k of Object.keys(x.picks)) {
            delete x.picks[k][id];
            if (!Object.keys(x.picks[k]).length)
                delete x.picks[k];
        }
    });
    const edit = (id) => { setEditing(id); try {
        window.scrollTo(0, 0);
    }
    catch { /* not available */ } };
    const remove = (id) => update(x => {
        x.recipes = x.recipes.filter(z => z.id !== id);
        // A mini recipe also leaves its buckets, and any meals it was picked for.
        for (const b of x.buckets) {
            const gone = b.items.filter(g => g.recipe === id).map(g => norm(g.name));
            if (!gone.length)
                continue;
            b.items = b.items.filter(g => g.recipe !== id);
            for (const slot of Object.values(x.picks))
                if (slot[b.id])
                    slot[b.id] = slot[b.id].filter(n => !gone.includes(norm(n)));
        }
        Object.keys(x.plan).forEach(k => {
            const p = x.plan[k];
            for (const m of MEALS)
                if (p[m] === id)
                    delete p[m];
            if (!Object.keys(p).length)
                delete x.plan[k];
        });
    });
    /** A recipe card: name, a summary line, ingredients, link and method. */
    const card = (r, sub, cls = '') => {
        const link = safeLink(r.link);
        const showMethod = !!openMethod[r.id];
        return (_jsxs("div", { className: 'card ' + cls, style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 600 }, children: r.name }), _jsx("div", { style: { fontSize: 13 }, className: "muted", children: sub }), r.meals.length > 0 && _jsx("div", { className: "note", style: { marginTop: 2 }, children: r.meals.map(m => MEAL_LABEL[m]).join(' · ') }), (r.tags ?? []).length > 0 && (_jsx("div", { className: "row", style: { gap: 4, marginTop: 4 }, children: r.tags.map(t => _jsx("button", { className: 'mini-tag dense' + (norm(tagFilter) === norm(t) ? ' on' : ''), onClick: () => setTagFilter(norm(tagFilter) === norm(t) ? '' : t), children: t }, t)) }))] }), _jsxs("span", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { className: "link-btn", onClick: () => edit(r.id), children: "Edit" }), _jsx("button", { className: "link-btn", onClick: () => { if (confirmRemove('“' + r.name + '”'))
                                        remove(r.id); }, children: "Remove" })] })] }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 5 }, children: [r.ingredients.map((g, i) => {
                            const c = pantry.get(norm(g.name));
                            const dot = !c ? '#BFB8AA' : isStocked(c) ? STATE_COLORS.Full : STATE_COLORS.Replace;
                            return (_jsxs("span", { className: "ing-tag", children: [_jsx("span", { className: "dot6", style: { background: dot } }), g.name, prices.staples.has(norm(g.name)) ? _jsx("span", { className: "muted", children: "\u00B7 staple" }) : g.qty && g.unit ? _jsxs("span", { className: "muted", children: ["\u00B7 ", fmtQty(g.qty, g.unit)] }) : null] }, i));
                        }), (r.buckets ?? []).map(u => {
                            const b = D.buckets.find(z => z.id === u.bucket);
                            return b ? _jsxs("span", { className: "ing-tag bucket-tag", children: ["\uD83E\uDEA3 ", b.name, _jsxs("span", { className: "muted", children: ["\u00B7 pick ", u.count] })] }, u.bucket) : null;
                        }), !r.ingredients.length && !r.buckets?.length && _jsx("span", { className: "note", children: "No ingredients yet \u2014 tap Edit to add them." })] }), (link || r.method) && (_jsxs("div", { style: { display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }, children: [link && _jsx("a", { href: link, target: "_blank", rel: "noopener noreferrer", children: "Open recipe \u2197" }), r.method && (_jsx("button", { className: "link-btn", style: { fontSize: 13 }, onClick: () => setOpenMethod(m => ({ ...m, [r.id]: !m[r.id] })), children: showMethod ? 'Hide method' : 'Show method' }))] })), showMethod && r.method && _jsx("div", { style: { fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', borderTop: '1px solid #F0ECE4', paddingTop: 10 }, children: r.method })] }, r.id));
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row8", style: { marginBottom: 14 }, children: [_jsx("input", { className: "search", style: { flex: '1 1 260px' }, value: q, onChange: e => setQ(e.target.value), placeholder: "Search by name or ingredient" }), editing ? _jsx("button", { className: "pill plain lg", onClick: () => setEditing(null), children: "Close editor" }) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "pill dark lg", onClick: () => setEditing('new'), children: "+ New recipe" }), _jsx("button", { className: "pill plain lg", onClick: () => setEditing('bucket:new'), children: "+ New bucket" }), _jsx("button", { className: "pill plain lg", onClick: () => setEditing('mini:new'), children: "+ New mini recipe" })] }))] }), _jsxs("div", { className: "filter-rows", children: [_jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Meal" }), _jsx("div", { className: "seg", role: "group", "aria-label": "Filter by meal", children: ['all', ...MEALS].map(m => {
                                    const on = mealFilter === m;
                                    const cnt = m === 'all' ? mains.length : mains.filter(r => r.meals.includes(m)).length;
                                    return (_jsxs("button", { className: on ? 'on' : '', "aria-pressed": on, onClick: () => setMealFilter(m), children: [m === 'all' ? 'All' : MEAL_LABEL[m], " ", _jsx("span", { className: "seg-count", children: cnt })] }, m));
                                }) })] }), _jsx(TagFilter, { D: D, update: update, kind: "recipe", active: tagFilter, onPick: setTagFilter, count: t => mains.filter(r => (r.tags ?? []).some(x => norm(x) === norm(t))).length })] }), editing && _jsx(RecipeEditor, { D: D, update: update, recipe: editingRecipe, kind: editKind, bucket: bucketBeingEdited, onDone: () => setEditing(null) }, editing), _jsx("div", { className: "auto-grid", style: { gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }, children: recipes.map(r => {
                    const planned = weekKeys.flatMap((k, i) => MEALS.filter(m => D.plan[k]?.[m] === r.id).map(m => DOW[i] + ' ' + MEAL_LABEL[m].toLowerCase()));
                    return card(r, money(recipeCost(r, prices)) + ' · ' + (planned.length ? 'On ' + planned.join(', ') : 'Not this week'));
                }) }), !recipes.length && _jsx("p", { className: "empty", children: q ? _jsxs(_Fragment, { children: ["No recipes match \u201C", q, "\u201D."] }) : 'No recipes here yet.' }), _jsxs("div", { className: "note", style: { marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap' }, children: [_jsxs("span", { className: "legend", style: { gap: 5 }, children: [_jsx("span", { className: "dot6", style: { background: STATE_COLORS.Full } }), "In stock"] }), _jsxs("span", { className: "legend", style: { gap: 5 }, children: [_jsx("span", { className: "dot6", style: { background: STATE_COLORS.Replace } }), "Low / replace"] }), _jsxs("span", { className: "legend", style: { gap: 5 }, children: [_jsx("span", { className: "dot6", style: { background: '#BFB8AA' } }), "Not stocked"] })] }), _jsxs("div", { className: "bucket-head", children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, fontSize: 17 }, children: "Buckets" }), _jsx("div", { className: "note", children: "Interchangeable items, like Vegetables, picked when you plan a meal." })] }), !editing && _jsx("button", { className: "pill plain", onClick: () => edit('bucket:new'), children: "+ New bucket" })] }), _jsx("div", { className: "auto-grid", style: { gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }, children: D.buckets.slice().sort((a, b) => a.name.localeCompare(b.name)).map(b => {
                    const usedBy = mains.filter(r => r.buckets?.some(u => u.bucket === b.id)).length;
                    return (_jsxs("div", { className: "card bucket-card", style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsxs("div", { style: { fontSize: 16, fontWeight: 600 }, children: ["\uD83E\uDEA3 ", b.name] }), _jsxs("div", { style: { fontSize: 13 }, className: "muted", children: [b.items.length, " item", b.items.length === 1 ? '' : 's', " \u00B7 ", b.perMeal ?? 1, " per meal \u00B7 ", bucketAverage(b, prices) ? 'avg ' + money(bucketAverage(b, prices)) + ' each' : 'no prices yet', usedBy ? ' · in ' + usedBy + ' recipe' + (usedBy > 1 ? 's' : '') : ''] })] }), _jsxs("span", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { className: "link-btn", onClick: () => edit('bucket:' + b.id), children: "Edit" }), _jsx("button", { className: "link-btn", onClick: () => { if (confirmRemove('the “' + b.name + '” bucket'))
                                                    removeBucket(b.id); }, children: "Remove" })] })] }), (b.tags ?? []).length > 0 && (_jsx("div", { className: "row", style: { gap: 4 }, children: ['', ...b.tags].map(t => {
                                    const on = (bucketTag[b.id] ?? '') === t;
                                    return _jsx("button", { className: 'mini-tag dense' + (on ? ' on' : ''), "aria-pressed": on, onClick: () => setBucketTag(f => ({ ...f, [b.id]: t })), children: t || 'All' }, t || 'all');
                                }) })), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 5 }, children: [b.items.filter(g => !bucketTag[b.id] || (g.tags ?? []).some(t => norm(t) === norm(bucketTag[b.id]))).map((g, i) => {
                                        const c = itemCost(g, prices);
                                        return _jsxs("span", { className: 'ing-tag' + (miniOf(g, prices) ? ' mini-item' : ''), children: [g.name, miniOf(g, prices) ? _jsxs("span", { className: "muted", children: ["\u00B7 mini", c !== null ? ' · ' + money(c) : ''] }) : prices.staples.has(norm(g.name)) ? _jsx("span", { className: "muted", children: "\u00B7 staple" }) : c !== null ? _jsxs("span", { className: "muted", children: ["\u00B7 ", money(c)] }) : g.qty && g.unit ? _jsxs("span", { className: "muted", children: ["\u00B7 ", fmtQty(g.qty, g.unit)] }) : null] }, i);
                                    }), !b.items.length && _jsx("span", { className: "note", children: "Empty \u2014 tap Edit to add items." })] })] }, b.id));
                }) }), !D.buckets.length && _jsx("p", { className: "note", style: { margin: '4px 0 0' }, children: "No buckets yet." }), _jsxs("div", { className: "bucket-head", children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, fontSize: 17 }, children: "Mini recipes" }), _jsx("div", { className: "note", children: "Garnishes, sauces and dressings, used as one item in a bucket." })] }), !editing && _jsx("button", { className: "pill plain", onClick: () => edit('mini:new'), children: "+ New mini recipe" })] }), _jsx("div", { className: "auto-grid", style: { gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }, children: minis.map(r => {
                    const inBuckets = D.buckets.filter(b => b.items.some(g => g.recipe === r.id)).map(b => b.name);
                    const c = miniCost(r, prices);
                    return card(r, (c !== null ? money(c) + ' per batch · ' : '') + (inBuckets.length ? 'In ' + inBuckets.join(', ') : 'Not in a bucket yet'), 'mini-card');
                }) }), !minis.length && _jsx("p", { className: "note", style: { margin: '4px 0 0' }, children: q && miniRecipes(D).length ? _jsxs(_Fragment, { children: ["No mini recipes match \u201C", q, "\u201D."] }) : 'No mini recipes yet.' })] }));
}
