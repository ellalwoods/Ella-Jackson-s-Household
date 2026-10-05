import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { norm, removeTag, renameTag, tagUses } from '../lib/model';
import { TagEdit } from './RecipeEditor';
import { confirmRemove } from './confirm';
/**
 * The "Tags" filter row on the Recipes and Places pages. "Edit tags" turns
 * every tag into a box to rename (or × to remove), applied everywhere.
 */
export default function TagFilter({ D, update, kind, active, onPick, count }) {
    const [editing, setEditing] = useState(false);
    const all = kind === 'recipe' ? D.recipeTags : D.placeTags;
    const used = all.filter(t => tagUses(D, kind, t) > 0);
    if (!all.length)
        return null;
    const what = kind === 'recipe' ? 'recipe' : 'place';
    const rename = (from, to) => {
        if (!to.trim() || norm(to) === norm(from))
            return;
        update(x => renameTag(x, kind, from, to));
        if (norm(active) === norm(from))
            onPick(to.trim());
    };
    const remove = (t) => {
        if (tagUses(D, kind, t) && !confirmRemove('the “' + t + '” tag from every ' + what))
            return;
        update(x => removeTag(x, kind, t));
        if (norm(active) === norm(t))
            onPick('');
    };
    return (_jsxs("div", { className: "filter-row", children: [_jsx("span", { className: "filter-label", children: "Tags" }), _jsxs("div", { className: "row", style: { gap: 4, alignItems: 'center' }, children: [editing
                        ? all.map(t => _jsx(TagEdit, { tag: t, onRename: n => rename(t, n), onDelete: () => remove(t) }, t))
                        : ['', ...used].map(t => (_jsxs("button", { className: 'mini-tag' + (active === t ? ' on' : ''), "aria-pressed": active === t, onClick: () => onPick(t), children: [t || 'Any', t && count ? ' · ' + count(t) : ''] }, t || 'any'))), _jsx("button", { className: "link-btn", style: { marginLeft: 6 }, onClick: () => setEditing(v => !v), children: editing ? 'Done' : 'Edit tags' })] })] }));
}
