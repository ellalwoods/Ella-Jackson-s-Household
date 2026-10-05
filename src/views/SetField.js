import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
/**
 * A saved value shown as plain text, so it reads as set. Tap it to change it:
 * it becomes a box, and Enter (or tapping away) saves; Escape cancels.
 */
export function SetField({ value, display, onCommit, label, numeric = false, align = 'left', placeholder, color, strong = false }) {
    const [draft, setDraft] = useState(null);
    if (draft === null) {
        return (_jsx("button", { className: "set-field", style: { textAlign: align, color, fontWeight: strong ? 600 : undefined }, onClick: () => setDraft(value), "aria-label": label + ': ' + (display ?? value) + ', change', title: "Tap to change", children: (display ?? value) || _jsx("span", { className: "muted", children: placeholder ?? 'Add' }) }));
    }
    const commit = () => { if (draft !== value)
        onCommit(draft); setDraft(null); };
    return (_jsx("input", { className: "field-sm compact", autoFocus: true, value: draft, "aria-label": label, inputMode: numeric ? 'decimal' : undefined, style: { width: '100%', textAlign: align }, onChange: e => setDraft(e.target.value), onBlur: commit, onKeyDown: e => { if (e.key === 'Enter')
            e.target.blur(); if (e.key === 'Escape')
            setDraft(null); } }));
}
/** A greyed "+ Add …" row that opens into its form only when tapped. */
export function AddRow({ label, open, onOpen, children }) {
    return open ? _jsx("div", { className: "add-open", children: children }) : _jsxs("button", { className: "add-row", onClick: onOpen, children: ["+ ", label] });
}
