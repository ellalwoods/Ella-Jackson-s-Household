import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { DOW, dowIndex, MON, parse, key } from '../lib/dates';
import { dropTag, MEAL_LABEL, removeTag, renameTag, swapTag, tagUses, money, norm, PLACE_KIND_LABEL, PLACE_KINDS, uid } from '../lib/model';
import { safeLink, TagEdit } from './RecipeEditor';
import { confirmRemove } from './confirm';
import TagFilter from './TagFilter';
/** Restaurants, bars and cafés: a list you can plan meals out from. */
export default function PlacesPage({ D, update }) {
    const [q, setQ] = useState('');
    const [kind, setKind] = useState('all');
    const [show, setShow] = useState('all');
    const [tag, setTag] = useState('');
    /** null = closed, 'new' = adding, or the id being edited. */
    const [editing, setEditing] = useState(null);
    const pq = norm(q);
    const visits = placeVisits(D);
    const list = D.places
        .filter(p => !pq || [p.name, p.suburb, ...(p.tags ?? []), p.notes].some(v => norm(v).includes(pq)))
        .filter(p => kind === 'all' || p.kind === kind)
        .filter(p => show === 'all' || (show === 'been') === p.been)
        .filter(p => !tag || (p.tags ?? []).some(x => norm(x) === norm(tag)))
        .sort((a, b) => a.name.localeCompare(b.name));
    const remove = (p) => {
        if (!confirmRemove('“' + p.name + '”'))
            return;
        update(x => {
            x.places = x.places.filter(z => z.id !== p.id);
            // Meals already planned there keep the name as plain text.
            for (const [slot, id] of Object.entries(x.eatOutPlace))
                if (id === p.id) {
                    x.eatOut[slot] = p.name;
                    delete x.eatOutPlace[slot];
                }
        });
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row8", style: { marginBottom: 14 }, children: [_jsx("input", { className: "search", style: { flex: '1 1 260px' }, value: q, onChange: e => setQ(e.target.value), placeholder: "Search by name, suburb or tag", "aria-label": "Search places" }), _jsx("button", { className: "pill dark lg", onClick: () => setEditing('new'), children: "+ New place" })] }), D.places.length > 0 && (_jsxs("div", { className: "filter-rows", children: [_jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Type" }), _jsx("div", { className: "seg", role: "group", "aria-label": "Filter by type", children: ['all', ...PLACE_KINDS].map(k => {
                                    const n = k === 'all' ? D.places.length : D.places.filter(p => p.kind === k).length;
                                    if (k !== 'all' && !n)
                                        return null;
                                    return _jsxs("button", { className: kind === k ? 'on' : '', "aria-pressed": kind === k, onClick: () => setKind(k), children: [k === 'all' ? 'All' : PLACE_KIND_LABEL[k], " ", _jsx("span", { className: "seg-count", children: n })] }, k);
                                }) })] }), _jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Show" }), _jsx("div", { className: "seg", role: "group", "aria-label": "Been or want to try", children: [['all', 'All'], ['want', 'Want to try'], ['been', 'Been']].map(([k, l]) => (_jsx("button", { className: show === k ? 'on' : '', "aria-pressed": show === k, onClick: () => setShow(k), children: l }, k))) })] }), _jsx(TagFilter, { D: D, update: update, kind: "place", active: tag, onPick: setTag })] })), _jsx("div", { className: "auto-grid", style: { gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,270px),1fr))' }, children: list.map(p => {
                    const link = safeLink(p.link), v = visits.get(p.id);
                    return (_jsxs("div", { className: "card place-card", children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 600 }, children: p.name }), _jsx("div", { style: { fontSize: 13 }, className: "muted", children: [PLACE_KIND_LABEL[p.kind], p.suburb, p.cost ? money(p.cost) + ' pp' : ''].filter(Boolean).join(' · ') })] }), _jsxs("span", { style: { display: 'flex', gap: 10, flex: 'none' }, children: [_jsx("button", { className: "link-btn", onClick: () => setEditing(p.id), children: "Edit" }), _jsx("button", { className: "link-btn", onClick: () => remove(p), children: "Remove" })] })] }), (p.tags ?? []).length > 0 && (_jsx("div", { className: "row", style: { gap: 4 }, children: p.tags.map(t => _jsx("button", { className: 'mini-tag dense' + (norm(tag) === norm(t) ? ' on' : ''), onClick: () => setTag(norm(tag) === norm(t) ? '' : t), children: t }, t)) })), p.notes && _jsx("p", { className: "place-notes", children: p.notes }), _jsxs("div", { className: "place-foot", children: [_jsx("button", { className: 'mini-tag' + (p.been ? ' been' : ''), "aria-pressed": p.been, title: "Tap to switch", onClick: () => update(x => { const z = x.places.find(z => z.id === p.id); if (z)
                                            z.been = !z.been; }), children: p.been ? '✓ Been' : 'Want to try' }), v?.next ? _jsxs("span", { className: "note", children: ["Planned ", v.next] }) : v?.last ? _jsxs("span", { className: "note", children: ["Last went ", v.last] }) : null, link && _jsx("a", { href: link, target: "_blank", rel: "noopener noreferrer", style: { marginLeft: 'auto', fontSize: 13 }, children: "Open \u2197" })] })] }, p.id));
                }) }), !list.length && (_jsx("p", { className: "empty", children: D.places.length ? 'No places match.' : 'No places yet. Add the restaurants, bars and cafés you like, or want to try. You can then pick them when planning a meal out.' })), editing && _jsx(PlaceDialog, { D: D, update: update, place: editing === 'new' ? null : D.places.find(p => p.id === editing) ?? null, onClose: () => setEditing(null) })] }));
}
/** When each place was last (or is next) planned as a meal out. */
function placeVisits(D) {
    const today = key(new Date()), out = new Map();
    const fmt = (k, meal) => { const d = parse(k); return DOW[dowIndex(d)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + MEAL_LABEL[meal].toLowerCase(); };
    const entries = Object.entries(D.eatOutPlace).map(([slot, id]) => ({ id, k: slot.split('|')[0], meal: slot.split('|')[1] })).sort((a, b) => a.k.localeCompare(b.k));
    for (const e of entries) {
        const v = out.get(e.id) ?? {};
        if (e.k < today)
            v.last = fmt(e.k, e.meal);
        else if (!v.next)
            v.next = fmt(e.k, e.meal);
        out.set(e.id, v);
    }
    return out;
}
/** Add or edit a place. */
export function PlaceDialog({ D, update, place, onClose, onSaved, initialName = '' }) {
    const [name, setName] = useState(place?.name ?? initialName);
    const [kind, setKind] = useState(place?.kind ?? 'restaurant');
    const [suburb, setSuburb] = useState(place?.suburb ?? '');
    const [cost, setCost] = useState(place?.cost != null ? String(place.cost) : '');
    const [tags, setTags] = useState(place?.tags ?? []);
    const [newTag, setNewTag] = useState('');
    const [editingTags, setEditingTags] = useState(false);
    const [link, setLink] = useState(place?.link ?? '');
    const [notes, setNotes] = useState(place?.notes ?? '');
    const [been, setBeen] = useState(place?.been ?? false);
    const allTags = Array.from(new Set([...D.placeTags, ...tags])).sort((a, b) => a.localeCompare(b));
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    // Place tags are shared, so renaming or removing one applies to every place.
    const renamePlaceTag = (from, to) => {
        if (!to.trim() || norm(to) === norm(from))
            return;
        setTags(ts => swapTag(ts, from, to));
        update(x => renameTag(x, 'place', from, to));
    };
    const deletePlaceTag = (t) => {
        if (tagUses(D, 'place', t, place?.id) && !confirmRemove('the “' + t + '” tag from every place'))
            return;
        setTags(ts => dropTag(ts, t));
        update(x => removeTag(x, 'place', t));
    };
    const addTag = () => {
        const t = newTag.trim();
        if (!t)
            return;
        const existing = allTags.find(x => norm(x) === norm(t)) ?? t;
        if (!tags.some(x => norm(x) === norm(existing)))
            setTags(ts => [...ts, existing]);
        setNewTag('');
    };
    const save = () => {
        const n = name.trim();
        if (!n)
            return;
        const out = { id: place?.id ?? uid(), name: n, kind, been };
        if (suburb.trim())
            out.suburb = suburb.trim();
        const c = parseFloat(cost.replace(/[$,\s]/g, ''));
        if (!isNaN(c))
            out.cost = c;
        if (tags.length)
            out.tags = tags;
        if (safeLink(link))
            out.link = safeLink(link);
        if (notes.trim())
            out.notes = notes.trim();
        update(x => {
            const i = x.places.findIndex(z => z.id === out.id);
            if (i >= 0)
                x.places[i] = out;
            else
                x.places.push(out);
            for (const t of tags)
                if (!x.placeTags.some(z => norm(z) === norm(t)))
                    x.placeTags.push(t);
        });
        onSaved?.(out);
        onClose();
    };
    return (_jsx("div", { className: "dialog-scrim", onClick: onClose, children: _jsxs("div", { className: "dialog", role: "dialog", "aria-modal": "true", "aria-label": place ? 'Edit place' : 'New place', onClick: e => e.stopPropagation(), children: [_jsx("div", { style: { fontWeight: 600, fontSize: 16 }, children: place ? 'Edit place' : 'New place' }), _jsx("input", { className: "field", autoFocus: true, value: name, onChange: e => setName(e.target.value), placeholder: "Name, e.g. Bella Brutta", "aria-label": "Name", onKeyDown: e => { if (e.key === 'Enter')
                        save(); } }), _jsx("div", { className: "seg", role: "group", "aria-label": "Type", style: { alignSelf: 'flex-start', flexWrap: 'wrap', borderRadius: 18 }, children: PLACE_KINDS.map(k => _jsx("button", { className: kind === k ? 'on' : '', "aria-pressed": kind === k, onClick: () => setKind(k), children: PLACE_KIND_LABEL[k] }, k)) }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { className: "field-sm compact", style: { flex: 1 }, value: suburb, onChange: e => setSuburb(e.target.value), placeholder: "Suburb (optional)", "aria-label": "Suburb" }), _jsx("input", { className: "field-sm compact", style: { width: 120 }, value: cost, onChange: e => setCost(e.target.value), placeholder: "$ per person", inputMode: "decimal", "aria-label": "Typical cost per person" })] }), _jsxs("div", { className: "row", style: { alignItems: 'center' }, children: [_jsx("span", { className: "field-label", style: { width: 40 }, children: "Tags" }), editingTags
                            ? allTags.map(t => _jsx(TagEdit, { tag: t, onRename: n => renamePlaceTag(t, n), onDelete: () => deletePlaceTag(t) }, t))
                            : allTags.map(t => {
                                const on = tags.some(x => norm(x) === norm(t));
                                return _jsx("button", { className: 'mini-tag' + (on ? ' on' : ''), "aria-pressed": on, onClick: () => setTags(ts => (on ? ts.filter(x => norm(x) !== norm(t)) : [...ts, t])), children: t }, t);
                            }), !editingTags && _jsxs(_Fragment, { children: [_jsx("input", { className: "field-sm compact", style: { width: 150 }, value: newTag, onChange: e => setNewTag(e.target.value), placeholder: "+ New tag", "aria-label": "New tag", onKeyDown: e => { if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag();
                                    } } }), newTag.trim() && _jsx("button", { className: "pill-sm", onClick: addTag, children: "Add" })] }), allTags.length > 0 && _jsx("button", { className: "link-btn", style: { marginLeft: 4 }, onClick: () => setEditingTags(v => !v), children: editingTags ? 'Done' : 'Edit tags' })] }), _jsx("input", { className: "field-sm compact", value: link, onChange: e => setLink(e.target.value), placeholder: "Link (website or booking)", "aria-label": "Link", inputMode: "url", autoCapitalize: "off" }), _jsx("textarea", { className: "textarea", rows: 3, value: notes, onChange: e => setNotes(e.target.value), placeholder: "Notes, e.g. book ahead, get the lamb", "aria-label": "Notes" }), _jsxs("div", { className: "seg", role: "group", "aria-label": "Been or want to try", style: { alignSelf: 'flex-start' }, children: [_jsx("button", { className: !been ? 'on' : '', "aria-pressed": !been, onClick: () => setBeen(false), children: "Want to try" }), _jsx("button", { className: been ? 'on' : '', "aria-pressed": been, onClick: () => setBeen(true), children: "Been" })] }), _jsxs("div", { className: "row8", style: { marginTop: 4 }, children: [_jsx("button", { className: "pill dark", style: { padding: '0 18px' }, onClick: save, children: place ? 'Save' : 'Add place' }), _jsx("button", { className: "pill plain", onClick: onClose, children: "Cancel" })] })] }) }));
}
