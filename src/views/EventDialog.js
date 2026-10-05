import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { parse, MON } from '../lib/dates';
import { CHORE_OWNERS, norm, OWNERS, soft, TAG_COLORS, uid } from '../lib/model';
const longDate = (k) => { const d = parse(k); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
/** Add or edit a calendar event. New tags typed here are saved with the next colour in the palette. */
export default function EventDialog({ D, update, date: initialDate, event, onClose }) {
    const [title, setTitle] = useState(event?.title ?? '');
    const [date, setDate] = useState(event?.date ?? initialDate);
    const [time, setTime] = useState(event?.time ?? '');
    const [place, setPlace] = useState(event?.place ?? '');
    const [who, setWho] = useState(event?.who ?? 'both');
    const [notes, setNotes] = useState(event?.notes ?? '');
    const [tags, setTags] = useState(event?.tags ?? []);
    const [newTag, setNewTag] = useState('');
    /** Tags created in this dialog, saved along with the event. */
    const [created, setCreated] = useState([]);
    const [editingTags, setEditingTags] = useState(false);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const allTags = [...D.tags, ...created];
    const tagColor = (n) => allTags.find(t => norm(t.name) === norm(n))?.color ?? '#BFB8AA';
    const has = (n) => tags.some(t => norm(t) === norm(n));
    const toggle = (n) => setTags(ts => (ts.some(t => norm(t) === norm(n)) ? ts.filter(t => norm(t) !== norm(n)) : [...ts, n]));
    const addTag = () => {
        const n = newTag.trim();
        if (!n)
            return;
        const existing = allTags.find(t => norm(t.name) === norm(n));
        if (!existing)
            setCreated(c => [...c, { name: n, color: TAG_COLORS[(D.tags.length + c.length) % TAG_COLORS.length] }]);
        if (!has(existing?.name ?? n))
            setTags(ts => [...ts, existing?.name ?? n]);
        setNewTag('');
    };
    // Tag edits apply straight away to saved tags (and every event using them), or to ones made in this dialog.
    const isSaved = (n) => D.tags.some(t => norm(t.name) === norm(n));
    const renameTag = (old, next) => {
        const n = next.trim();
        if (!n || n === old)
            return;
        // Don't merge into another existing tag.
        if (norm(n) !== norm(old) && allTags.some(t => norm(t.name) === norm(n)))
            return;
        const swap = (list) => list.map(t => (norm(t) === norm(old) ? n : t));
        if (isSaved(old))
            update(x => {
                const t = x.tags.find(z => norm(z.name) === norm(old));
                if (t)
                    t.name = n;
                for (const e of x.events)
                    e.tags = swap(e.tags);
            });
        else
            setCreated(c => c.map(t => (norm(t.name) === norm(old) ? { ...t, name: n } : t)));
        setTags(swap);
    };
    const recolourTag = (name, color) => {
        if (isSaved(name))
            update(x => { const t = x.tags.find(z => norm(z.name) === norm(name)); if (t)
                t.color = color; });
        else
            setCreated(c => c.map(t => (norm(t.name) === norm(name) ? { ...t, color } : t)));
    };
    const deleteTag = (name) => {
        if (isSaved(name))
            update(x => {
                x.tags = x.tags.filter(z => norm(z.name) !== norm(name));
                for (const e of x.events)
                    e.tags = e.tags.filter(t => norm(t) !== norm(name));
            });
        else
            setCreated(c => c.filter(t => norm(t.name) !== norm(name)));
        setTags(ts => ts.filter(t => norm(t) !== norm(name)));
    };
    const save = () => {
        const t = title.trim();
        if (!t || !date)
            return;
        const ev = { id: event?.id ?? uid(), date, title: t, who, tags };
        if (time)
            ev.time = time;
        if (place.trim())
            ev.place = place.trim();
        if (notes.trim())
            ev.notes = notes;
        update(x => {
            for (const c of created)
                if (!x.tags.some(z => norm(z.name) === norm(c.name)))
                    x.tags.push(c);
            const i = x.events.findIndex(z => z.id === ev.id);
            if (i >= 0)
                x.events[i] = ev;
            else
                x.events.push(ev);
        });
        onClose();
    };
    const remove = () => {
        if (event)
            update(x => { x.events = x.events.filter(z => z.id !== event.id); });
        onClose();
    };
    const accent = tags.length ? tagColor(tags[0]) : OWNERS[who].color;
    return (_jsx("div", { className: "dialog-scrim", onClick: onClose, children: _jsxs("div", { className: "dialog", role: "dialog", "aria-modal": "true", "aria-label": event ? 'Edit event' : 'New event', onClick: e => e.stopPropagation(), style: { background: 'linear-gradient(' + soft(accent, 0.35) + ' 0 6px, #fff 6px)', paddingTop: 22 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: 16 }, children: event ? 'Edit event' : 'New event' }), _jsx("span", { className: "note", children: longDate(date) })] }), _jsx("input", { className: "field", autoFocus: true, value: title, onChange: e => setTitle(e.target.value), placeholder: "What\u2019s on? e.g. Dinner with Sam", onKeyDown: e => { if (e.key === 'Enter')
                        save(); } }), _jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap' }, children: [_jsx("input", { className: "field", type: "date", style: { flex: '1 1 140px' }, value: date, onChange: e => setDate(e.target.value), "aria-label": "Date" }), _jsx("input", { className: "field", type: "time", style: { flex: '1 1 110px' }, value: time, onChange: e => setTime(e.target.value), "aria-label": "Time" })] }), _jsx("input", { className: "field", value: place, onChange: e => setPlace(e.target.value), placeholder: "Place (optional)", "aria-label": "Place" }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: CHORE_OWNERS.map(o => {
                        const on = who === o, c = OWNERS[o];
                        return (_jsx("button", { className: "owner-pick", "aria-pressed": on, onClick: () => setWho(o), style: { borderColor: c.color, background: on ? c.color : '#fff', color: on ? '#fff' : c.ink }, children: c.name }, o));
                    }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("span", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }, children: [_jsx("span", { className: "field-label", children: "Tags" }), allTags.length > 0 && _jsx("button", { className: "link-btn", onClick: () => setEditingTags(v => !v), children: editingTags ? 'Done' : 'Edit tags' })] }), editingTags ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [allTags.map(t => _jsx(TagEditor, { tag: t, onRename: n => renameTag(t.name, n), onColour: c => recolourTag(t.name, c), onDelete: () => deleteTag(t.name) }, t.name)), _jsx("span", { className: "note", children: "Changes apply to every event with that tag." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row", style: { alignItems: 'center' }, children: [allTags.map(t => {
                                            const on = has(t.name);
                                            return (_jsxs("button", { className: "tag-chip", "aria-pressed": on, onClick: () => toggle(t.name), style: { background: on ? soft(t.color) : '#fff', borderColor: on ? t.color : '#DDD8CC' }, children: [_jsx("span", { className: "dot8", style: { background: t.color } }), t.name] }, t.name));
                                        }), _jsx("input", { className: "field-sm compact", style: { width: 130 }, value: newTag, onChange: e => setNewTag(e.target.value), onKeyDown: e => { if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addTag();
                                            } }, placeholder: "+ New tag", "aria-label": "New tag" }), newTag.trim() && _jsx("button", { className: "pill-sm", onClick: addTag, children: "Add" })] }), tags.length > 1 && _jsxs("span", { className: "note", children: ["The first tag (", tags[0], ") colours the event."] })] }))] }), _jsx("textarea", { value: notes, onChange: e => setNotes(e.target.value), placeholder: "Notes (optional)", "aria-label": "Notes", rows: 3, className: "textarea" }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { className: "pill dark", style: { padding: '0 18px' }, onClick: save, children: event ? 'Save' : 'Add event' }), _jsx("button", { className: "pill plain", onClick: onClose, children: "Cancel" }), event && _jsx("button", { className: "link-btn", style: { marginLeft: 'auto', fontSize: 13 }, onClick: remove, children: "Delete" })] })] }) }));
}
/** One tag in edit mode: rename (saved on Enter or leaving the box), pick a colour, or delete. */
function TagEditor({ tag, onRename, onColour, onDelete }) {
    const [name, setName] = useState(tag.name);
    useEffect(() => setName(tag.name), [tag.name]);
    const commit = () => { if (name.trim() && name.trim() !== tag.name)
        onRename(name);
    else
        setName(tag.name); };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 10, background: soft(tag.color, 0.85) }, children: [_jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center' }, children: [_jsx("span", { className: "dot8", style: { background: tag.color, flex: 'none' } }), _jsx("input", { className: "field-sm compact", style: { flex: 1 }, value: name, "aria-label": 'Rename ' + tag.name, onChange: e => setName(e.target.value), onBlur: commit, onKeyDown: e => { if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        } } }), _jsx("button", { className: "x-btn", "aria-label": 'Delete tag ' + tag.name, title: "Delete tag", onClick: onDelete, children: "\u00D7" })] }), _jsx("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 14 }, children: TAG_COLORS.map(c => (_jsx("button", { "aria-label": 'Colour ' + c, "aria-pressed": c === tag.color, onClick: () => onColour(c), style: { width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0, border: c === tag.color ? '2px solid #23221F' : '2px solid #fff', boxShadow: '0 0 0 1px ' + (c === tag.color ? '#fff' : '#DDD8CC') } }, c))) })] }));
}
