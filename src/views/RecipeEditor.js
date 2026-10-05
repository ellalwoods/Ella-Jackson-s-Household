import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { removeTag, renameTag, swapTag, tagUses, MEAL_LABEL, MEALS, miniRecipes, money, norm, STAPLE_COST, uid } from '../lib/model';
import { bucketAverage, costContext, itemCost, priceMap, stapleSet, useCost } from '../lib/food';
import { UnitSelect } from './PantryPage';
import { confirmRemove } from './confirm';
const blankRow = () => ({ key: uid(), name: '', qty: '', unit: 'g', buyQty: '', buyUnit: 'g', price: '', auto: false, staple: false, tags: [] });
const numOr = (s) => (s.trim() === '' ? undefined : parseFloat(s));
function fromPrice(row, pr) {
    return pr
        ? { ...row, buyQty: String(pr.qty), buyUnit: pr.unit, price: String(pr.price), auto: true }
        : { ...row, buyQty: '', buyUnit: row.unit, price: '', auto: false };
}
/** Safe outbound link: only http(s), adding https:// when left off. */
export function safeLink(s) {
    const t = (s ?? '').trim();
    if (!t)
        return '';
    return /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? '' : 'https://' + t;
}
export default function RecipeEditor({ D, update, recipe, bucket = null, kind = 'recipe', onDone }) {
    const isBucket = kind === 'bucket', isMini = kind === 'mini';
    const minis = miniRecipes(D);
    const prices = priceMap(D), staples = stapleSet(D), ctx = costContext(D);
    const [name, setName] = useState((isBucket ? bucket?.name : recipe?.name) ?? '');
    const [uses, setUses] = useState(recipe?.buckets ?? []);
    const [choosing, setChoosing] = useState(false);
    const [perMeal, setPerMeal] = useState(bucket?.perMeal ?? 1);
    const [bucketTags, setBucketTags] = useState(bucket?.tags ?? []);
    const [tags, setTags] = useState(recipe?.tags ?? []);
    const [newTag, setNewTag] = useState('');
    const allRecipeTags = Array.from(new Set([...D.recipeTags, ...tags])).sort((a, b) => a.localeCompare(b));
    const addTag = () => {
        const t = newTag.trim();
        if (!t)
            return;
        if (isBucket) {
            if (!bucketTags.some(x => norm(x) === norm(t)))
                setBucketTags(ts => [...ts, t]);
        }
        else {
            const existing = allRecipeTags.find(x => norm(x) === norm(t)) ?? t;
            if (!tags.some(x => norm(x) === norm(existing)))
                setTags(ts => [...ts, existing]);
        }
        setNewTag('');
    };
    const [link, setLink] = useState(recipe?.link ?? '');
    const [method, setMethod] = useState(recipe?.method ?? '');
    const [meals, setMeals] = useState(recipe?.meals ?? ['dinner']);
    const [rows, setRows] = useState(() => {
        const rs = ((isBucket ? bucket?.items : recipe?.ingredients) ?? []).map(g => fromPrice({ ...blankRow(), name: g.name, qty: g.qty != null ? String(g.qty) : '', unit: g.unit ?? 'g', staple: staples.has(norm(g.name)), tags: g.tags ?? [], recipe: g.recipe }, prices.get(norm(g.name))));
        return rs.length ? rs : [blankRow()];
    });
    const knownMinis = isBucket ? minis.map(r => r.name).sort() : [];
    const known = Array.from(new Set([...D.prices.map(p => p.name), ...D.pantry.map(p => p.name), ...D.recipes.flatMap(r => r.ingredients.map(g => g.name))])).sort();
    const setRow = (k, patch) => setRows(rs => rs.map(r => {
        if (r.key !== k)
            return r;
        const next = { ...r, ...patch };
        // In a bucket, typing a mini recipe's name makes the item that mini recipe.
        if ('name' in patch && isBucket)
            next.recipe = minis.find(m => norm(m.name) === norm(next.name))?.id;
        if (next.recipe)
            return next;
        if ('name' in patch && staples.has(norm(next.name)))
            next.staple = true;
        if ('name' in patch && (r.auto || (!r.buyQty && !r.price)))
            return fromPrice(next, prices.get(norm(next.name)));
        if ('buyQty' in patch || 'buyUnit' in patch || 'price' in patch)
            next.auto = false;
        return next;
    }));
    const rowCost = (r) => {
        if (r.recipe)
            return itemCost({ name: r.name, recipe: r.recipe }, ctx);
        if (r.staple)
            return r.name.trim() ? STAPLE_COST : null;
        const bq = numOr(r.buyQty), pr = numOr(r.price);
        return bq && pr != null ? useCost({ qty: numOr(r.qty), unit: r.unit }, { name: r.name, qty: bq, unit: r.buyUnit, price: pr }) : null;
    };
    const priced = rows.map(rowCost).filter((c) => c !== null);
    const bucketTotal = uses.reduce((a, u) => a + u.count * bucketAverage(D.buckets.find(b => b.id === u.bucket), ctx), 0);
    const total = priced.reduce((a, c) => a + c, 0) + bucketTotal;
    const average = priced.length ? priced.reduce((a, c) => a + c, 0) / priced.length : 0;
    const save = () => {
        const n = name.trim();
        if (!n)
            return;
        const used = rows.filter(r => r.name.trim());
        const ingredients = used.map(r => {
            if (r.staple || r.recipe)
                return { name: r.name.trim() };
            const q = numOr(r.qty);
            return q ? { name: r.name.trim(), qty: q, unit: r.unit } : { name: r.name.trim() };
        });
        const newPrices = used.filter(r => !r.recipe).flatMap(r => {
            const bq = numOr(r.buyQty), pr = numOr(r.price);
            if (pr == null || isNaN(pr))
                return [];
            // A staple only needs its purchase price; keep any pack size already known.
            if (r.staple) {
                const had = prices.get(norm(r.name));
                return [{ name: r.name.trim(), qty: had?.qty ?? 1, unit: had?.unit ?? 'each', price: pr }];
            }
            return bq ? [{ name: r.name.trim(), qty: bq, unit: r.buyUnit, price: pr }] : [];
        });
        const out = { id: recipe?.id ?? uid(), name: n, meals: isMini ? [] : MEALS.filter(m => meals.includes(m)), ingredients };
        if (isMini)
            out.mini = true;
        const keptUses = uses.filter(u => u.count > 0);
        if (keptUses.length)
            out.buckets = keptUses;
        if (safeLink(link))
            out.link = safeLink(link);
        if (method.trim())
            out.method = method;
        if (!priced.length && !keptUses.length && recipe?.cost)
            out.cost = recipe.cost;
        if (tags.length)
            out.tags = tags;
        const items = ingredients.map((g, i) => {
            const t = used[i].tags.filter(x => bucketTags.some(b => norm(b) === norm(x)));
            const item = used[i].recipe ? { ...g, recipe: used[i].recipe } : g;
            return t.length ? { ...item, tags: t } : item;
        });
        const outBucket = { id: bucket?.id ?? uid(), name: n, items, perMeal: Math.max(1, perMeal) };
        if (bucketTags.length)
            outBucket.tags = bucketTags;
        update(x => {
            if (isBucket) {
                const i = x.buckets.findIndex(z => z.id === outBucket.id);
                if (i >= 0)
                    x.buckets[i] = outBucket;
                else
                    x.buckets.push(outBucket);
            }
            else {
                const i = x.recipes.findIndex(z => z.id === out.id);
                if (i >= 0)
                    x.recipes[i] = out;
                else
                    x.recipes.push(out);
                // A renamed mini recipe keeps its place in buckets and in picks already made.
                if (isMini && recipe && norm(recipe.name) !== norm(n)) {
                    for (const b of x.buckets)
                        for (const g of b.items)
                            if (g.recipe === out.id)
                                g.name = n;
                    for (const slot of Object.values(x.picks))
                        for (const k of Object.keys(slot))
                            slot[k] = slot[k].map(p => (norm(p) === norm(recipe.name) ? n : p));
                }
                for (const t of tags)
                    if (!x.recipeTags.some(z => norm(z) === norm(t)))
                        x.recipeTags.push(t);
            }
            // Staple status is shared: marking or unmarking it here applies to every recipe.
            const plain = used.filter(r => !r.recipe);
            const staples = x.staples.filter(n => !plain.some(r => !r.staple && norm(r.name) === norm(n)));
            for (const r of plain)
                if (r.staple && !staples.some(n => norm(n) === norm(r.name)))
                    staples.push(r.name.trim());
            x.staples = staples;
            for (const p of newPrices) {
                const j = x.prices.findIndex(z => norm(z.name) === norm(p.name));
                if (j >= 0)
                    x.prices[j] = p;
                else
                    x.prices.push(p);
            }
        });
        onDone();
    };
    const renameRecipeTag = (from, to) => {
        const t = to.trim();
        if (!t || norm(t) === norm(from))
            return;
        const swap = (ts) => ts.map(x => (norm(x) === norm(from) ? t : x));
        if (isBucket) {
            setBucketTags(swap);
            setRows(rs => rs.map(r => ({ ...r, tags: swap(r.tags) })));
        }
        else {
            // Recipe tags are shared, so a rename applies to every recipe.
            setTags(ts => swapTag(ts, from, t));
            update(x => renameTag(x, 'recipe', from, t));
        }
    };
    const deleteRecipeTag = (t) => {
        const drop = (ts) => ts.filter(x => norm(x) !== norm(t));
        if (isBucket) {
            setBucketTags(drop);
            setRows(rs => rs.map(r => ({ ...r, tags: drop(r.tags) })));
            return;
        }
        // Only ask when other recipes would lose it too.
        if (tagUses(D, 'recipe', t, recipe?.id) && !confirmRemove('the “' + t + '” tag from every recipe'))
            return;
        setTags(drop);
        update(x => removeTag(x, 'recipe', t));
    };
    const summary = isBucket ? (priced.length ? 'Average ' + money(average) + ' per item' : 'Add prices to work out the average')
        : isMini ? (priced.length ? 'Costs ' + money(total) + ' per batch' : 'Add prices to work out the cost')
            : (priced.length || uses.length) ? 'Meal cost ' + money(total) + ' · ' + money(total / 2) + ' each'
                : recipe?.cost ? 'Meal cost ' + money(recipe.cost) + ' (add prices to work it out)' : 'Add prices to work out the cost';
    const thing = isBucket ? 'bucket' : isMini ? 'mini recipe' : 'recipe';
    // Each part of the form is its own numbered step, so it's clear what's asked for.
    const steps = [];
    steps.push({
        title: 'Name',
        hint: isBucket ? 'Interchangeable items, like Vegetables.' : isMini ? 'A garnish, sauce or dressing, used in buckets.' : undefined,
        body: _jsx("input", { className: "field-sm compact", value: name, onChange: e => setName(e.target.value), "aria-label": "Name", placeholder: isBucket ? 'e.g. Vegetables' : isMini ? 'e.g. Salsa verde' : 'e.g. Spaghetti bolognese' }),
    });
    if (isBucket)
        steps.push({
            title: 'Per meal',
            hint: 'Items one meal uses. Recipes can change it.',
            body: (_jsxs("div", { className: "stepper-panel", children: [_jsx("span", { className: "field-label", style: { fontSize: 14 }, children: "Items per meal" }), _jsx(Stepper, { value: perMeal, min: 1, onChange: setPerMeal, label: "Items per meal" })] })),
        });
    if (!isMini)
        steps.push({
            title: 'Tags', optional: true,
            hint: isBucket ? 'Group items, e.g. Greens.' : 'Which meal it’s for, plus your own tags.',
            body: (_jsxs(_Fragment, { children: [!isBucket && (_jsxs("div", { className: "row", style: { alignItems: 'center' }, children: [_jsx("span", { className: "field-label", style: { width: 40 }, children: "For" }), MEALS.map(m => {
                                const on = meals.includes(m);
                                return (_jsx("button", { className: "filter", "aria-pressed": on, onClick: () => setMeals(on ? meals.filter(z => z !== m) : [...meals, m]), style: { borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }, children: MEAL_LABEL[m] }, m));
                            })] })), _jsx(TagRow, { label: isBucket ? '' : 'Tags', tags: isBucket ? bucketTags : allRecipeTags, selected: isBucket ? bucketTags : tags, selectable: !isBucket, onToggle: t => setTags(ts => ts.some(x => norm(x) === norm(t)) ? ts.filter(x => norm(x) !== norm(t)) : [...ts, t]), onRename: renameRecipeTag, onDelete: deleteRecipeTag, value: newTag, onValue: setNewTag, onAdd: addTag, placeholder: isBucket ? '+ New tag, e.g. Greens' : '+ New tag, e.g. Quick' })] })),
        });
    steps.push({
        title: isBucket ? 'Items' : 'Ingredients',
        hint: 'What it uses and what you pay. Staples cost ' + money(STAPLE_COST) + '.' + (isBucket ? ' Type a mini recipe’s name to add it.' : (!isMini ? ' Buckets are picked when you plan the meal.' : '')),
        body: (_jsxs(_Fragment, { children: [_jsx("datalist", { id: "known-ingredients", children: [...knownMinis, ...known.filter(k => !knownMinis.includes(k))].map(k => _jsx("option", { value: k }, k)) }), _jsx("div", { children: rows.map(r => {
                        const c = rowCost(r);
                        const mismatch = !r.staple && c === null && !!numOr(r.qty) && !!numOr(r.buyQty) && numOr(r.price) != null;
                        return (_jsxs("div", { className: "ing-row", children: [_jsx("input", { className: "field-sm compact ing-name", list: "known-ingredients", value: r.name, placeholder: isBucket ? 'Item, e.g. Broccoli' : 'Ingredient', "aria-label": isBucket ? 'Item' : 'Ingredient', onChange: e => setRow(r.key, { name: e.target.value }) }), r.recipe ? (_jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "mini-tag dense on", children: "Mini recipe" }), _jsx("span", { className: "ing-label", children: (() => { const m = minis.find(z => z.id === r.recipe); return m ? m.ingredients.map(g => g.name).join(', ') || 'no ingredients yet' : ''; })() })] })) : r.staple ? (_jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Buy for $" }), _jsx("input", { className: 'field-sm compact ing-num' + (r.name.trim() && !r.price.trim() ? ' needs' : ''), inputMode: "decimal", value: r.price, placeholder: "0.00", "aria-label": 'Purchase price of ' + (r.name || 'staple'), onChange: e => setRow(r.key, { price: e.target.value }) }), _jsx("span", { className: "ing-label", children: r.name.trim() && !r.price.trim() ? 'add the price you pay' : 'staple · ' + money(STAPLE_COST) + ' a meal' })] })) : (_jsxs(_Fragment, { children: [_jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Uses" }), _jsx("input", { className: "field-sm compact ing-num", inputMode: "decimal", value: r.qty, placeholder: "qty", "aria-label": "Amount used", onChange: e => setRow(r.key, { qty: e.target.value }) }), _jsx(UnitSelect, { value: r.unit, onChange: u => setRow(r.key, { unit: u }), compact: true })] }), _jsxs("span", { className: "ing-group", children: [_jsx("span", { className: "ing-label", children: "Buy" }), _jsx("input", { className: "field-sm compact ing-num", inputMode: "decimal", value: r.buyQty, placeholder: "qty", "aria-label": "Amount you buy", onChange: e => setRow(r.key, { buyQty: e.target.value }) }), _jsx(UnitSelect, { value: r.buyUnit, onChange: u => setRow(r.key, { buyUnit: u }), compact: true }), _jsx("span", { className: "ing-label", children: "for $" }), _jsx("input", { className: "field-sm compact ing-num", inputMode: "decimal", value: r.price, placeholder: "0.00", "aria-label": "Price", onChange: e => setRow(r.key, { price: e.target.value }) })] })] })), isBucket && bucketTags.length > 0 && (_jsx("span", { className: "ing-group row-tags", children: bucketTags.map(t => {
                                        const on = r.tags.some(x => norm(x) === norm(t));
                                        return _jsx("button", { className: 'mini-tag' + (on ? ' on' : ''), "aria-pressed": on, onClick: () => setRow(r.key, { tags: on ? r.tags.filter(x => norm(x) !== norm(t)) : [...r.tags, t] }), children: t }, t);
                                    }) })), !r.recipe && _jsx("button", { className: 'pill-sm ing-staple' + (r.staple ? ' dark' : ''), "aria-pressed": r.staple, onClick: () => setRow(r.key, { staple: !r.staple }), children: "Staple" }), _jsx("span", { className: "ing-cost", title: mismatch ? 'Units don’t match (e.g. g vs ml)' : undefined, children: c !== null ? money(c) : mismatch ? 'units?' : '' }), _jsx("button", { className: "x-btn", "aria-label": "Remove ingredient", onClick: () => setRows(rs => (rs.length > 1 ? rs.filter(z => z.key !== r.key) : [blankRow()])), children: "\u00D7" })] }, r.key));
                    }) }), !isBucket && !isMini && uses.length > 0 && _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: uses.map(u => {
                        const b = D.buckets.find(z => z.id === u.bucket), avg = bucketAverage(b, ctx);
                        return (_jsxs("div", { className: "stepper-panel", children: [_jsxs("span", { className: "bucket-name", style: { minHeight: 0, flex: '1 1 140px' }, children: ["\uD83E\uDEA3 ", b?.name ?? 'Missing bucket'] }), _jsxs("span", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { className: "field-label", children: "Picks" }), _jsx(Stepper, { value: u.count, min: 1, small: true, label: 'Items from ' + (b?.name ?? 'bucket'), onChange: c => setUses(us => us.map(z => (z.bucket === u.bucket ? { ...z, count: c } : z))) })] }), _jsx("span", { className: "note", children: avg ? 'avg ' + money(avg) + ' each' : 'no prices yet' }), _jsx("span", { className: "ing-cost", children: money(u.count * avg) }), _jsx("button", { className: "x-btn", "aria-label": 'Remove ' + (b?.name ?? 'bucket'), onClick: () => setUses(us => us.filter(z => z.bucket !== u.bucket)), children: "\u00D7" })] }, u.bucket));
                    }) }), isBucket && choosing && (_jsxs("div", { className: "row", style: { alignItems: 'center' }, children: [minis.filter(m => !rows.some(r => r.recipe === m.id)).map(m => (_jsx("button", { className: "filter", onClick: () => {
                                // Fill an empty row if there is one, otherwise add a row for it.
                                setRows(rs => {
                                    const row = { ...blankRow(), name: m.name, recipe: m.id };
                                    const i = rs.findIndex(r => !r.name.trim());
                                    return i >= 0 ? rs.map((r, j) => (j === i ? { ...row, key: r.key } : r)) : [...rs, row];
                                });
                                setChoosing(false);
                            }, children: m.name }, m.id))), !minis.length && _jsx("span", { className: "note", children: "No mini recipes yet. Make one with + New mini recipe on the Recipes page." }), minis.length > 0 && minis.every(m => rows.some(r => r.recipe === m.id)) && _jsx("span", { className: "note", children: "All your mini recipes are already in this bucket." }), _jsx("button", { className: "link-btn", onClick: () => setChoosing(false), children: "Cancel" })] })), !isBucket && !isMini && choosing && (_jsxs("div", { className: "row", style: { alignItems: 'center' }, children: [D.buckets.filter(b => !uses.some(u => u.bucket === b.id)).map(b => (_jsxs("button", { className: "filter", onClick: () => { setUses(us => [...us, { bucket: b.id, count: b.perMeal ?? 1 }]); setChoosing(false); }, children: ["\uD83E\uDEA3 ", b.name, " \u00B7 ", b.items.length] }, b.id))), !D.buckets.length && _jsx("span", { className: "note", children: "No buckets yet. Add one on the Recipes page first (e.g. Vegetables)." }), D.buckets.length > 0 && D.buckets.every(b => uses.some(u => u.bucket === b.id)) && _jsx("span", { className: "note", children: "All your buckets are already in this recipe." }), _jsx("button", { className: "link-btn", onClick: () => setChoosing(false), children: "Cancel" })] })), _jsxs("div", { className: "row8", children: [_jsx("button", { className: "pill-sm", onClick: () => setRows(rs => [...rs, blankRow()]), children: isBucket ? '+ Add item' : '+ Add ingredient' }), isBucket && !choosing && _jsx("button", { className: "pill-sm", onClick: () => setChoosing(true), children: "+ Add mini recipe" }), !isBucket && !isMini && !choosing && _jsx("button", { className: "pill-sm", onClick: () => setChoosing(true), children: "+ Add bucket" })] })] })),
    });
    if (!isBucket)
        steps.push({
            title: 'Instructions', optional: true,
            body: (_jsxs(_Fragment, { children: [_jsx("textarea", { value: method, onChange: e => setMethod(e.target.value), placeholder: "Steps to make it", rows: 5, className: "textarea", "aria-label": "Instructions" }), _jsx("input", { className: "field-sm compact", value: link, onChange: e => setLink(e.target.value), placeholder: "Link, e.g. www.recipetineats.com/\u2026", "aria-label": "Link to recipe", inputMode: "url", autoCapitalize: "off" })] })),
        });
    return (_jsxs("div", { className: "editor", children: [_jsx("div", { className: "editor-title", children: (isBucket ? bucket : recipe) ? 'Edit ' + thing : 'New ' + thing }), steps.map((st, i) => (_jsxs("section", { className: "editor-step", style: i === 0 ? { borderTop: 'none', paddingTop: 0 } : undefined, children: [_jsxs("div", { className: "step-head", children: [_jsx("span", { className: "step-num", "aria-hidden": true, children: i + 1 }), _jsxs("div", { children: [_jsxs("div", { className: "step-title", children: [st.title, st.optional && _jsx("span", { className: "opt", children: " \u00B7 optional" })] }), st.hint && _jsx("div", { className: "step-hint", children: st.hint })] })] }), _jsx("div", { className: "step-body", children: st.body })] }, st.title))), _jsxs("div", { className: "editor-foot", children: [_jsxs("span", { className: "row8", children: [_jsxs("button", { className: "pill dark", style: { padding: '0 18px' }, onClick: save, children: ["Save ", thing] }), _jsx("button", { className: "pill plain", onClick: onDone, children: "Cancel" })] }), _jsx("span", { style: { fontSize: 14, fontWeight: 600 }, children: summary })] })] }));
}
/** A whole number set with − and + buttons. */
function Stepper({ value, min = 0, onChange, label, small = false }) {
    return (_jsxs("span", { className: 'stepper' + (small ? ' small' : ''), role: "group", "aria-label": label, children: [_jsx("button", { "aria-label": 'Fewer: ' + label, disabled: value <= min, onClick: () => onChange(Math.max(min, value - 1)), children: "\u2212" }), _jsx("output", { "aria-live": "polite", children: value }), _jsx("button", { "aria-label": 'More: ' + label, onClick: () => onChange(value + 1), children: "+" })] }));
}
/**
 * Tag chips plus a box to add a new one. Recipe tags toggle on and off for the
 * recipe; "Edit tags" lets you rename or remove any tag.
 */
function TagRow({ label, tags, selected, selectable, onToggle, onRename, onDelete, value, onValue, onAdd, placeholder }) {
    const [editing, setEditing] = useState(false);
    return (_jsxs("div", { className: "row", style: { alignItems: 'center' }, children: [label && _jsx("span", { className: "field-label", style: { width: 40 }, children: label }), editing ? tags.map(t => _jsx(TagEdit, { tag: t, onRename: n => onRename(t, n), onDelete: () => onDelete(t) }, t))
                : tags.map(t => {
                    const on = selected.some(x => norm(x) === norm(t));
                    return selectable
                        ? _jsx("button", { className: 'mini-tag' + (on ? ' on' : ''), "aria-pressed": on, onClick: () => onToggle(t), children: t }, t)
                        : _jsx("span", { className: "mini-tag on", children: t }, t);
                }), !editing && _jsxs(_Fragment, { children: [_jsx("input", { className: "field-sm compact", style: { width: 170 }, value: value, placeholder: placeholder, "aria-label": "New tag", onChange: e => onValue(e.target.value), onKeyDown: e => { if (e.key === 'Enter') {
                            e.preventDefault();
                            onAdd();
                        } } }), value.trim() && _jsx("button", { className: "pill-sm", onClick: onAdd, children: "Add" })] }), tags.length > 0 && _jsx("button", { className: "link-btn", style: { marginLeft: 4 }, onClick: () => setEditing(v => !v), children: editing ? 'Done' : 'Edit tags' })] }));
}
/** One tag in edit mode: rename it in place, or × to remove it. */
export function TagEdit({ tag, onRename, onDelete }) {
    const [text, setText] = useState(tag);
    const commit = () => { if (text.trim() && text.trim() !== tag)
        onRename(text);
    else
        setText(tag); };
    return (_jsxs("span", { className: "tag-edit", children: [_jsx("input", { className: "field-sm compact", value: text, "aria-label": 'Rename ' + tag, onChange: e => setText(e.target.value), onBlur: commit, onKeyDown: e => { if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                } } }), _jsx("button", { className: "x-btn", "aria-label": 'Remove tag ' + tag, title: "Remove tag", onClick: onDelete, children: "\u00D7" })] }));
}
