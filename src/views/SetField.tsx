import { useState } from 'react';

/**
 * A saved value shown as plain text, so it reads as set. Tap it to change it:
 * it becomes a box, and Enter (or tapping away) saves; Escape cancels.
 */
export function SetField({ value, display, onCommit, label, numeric = false, align = 'left', placeholder }: {
  value: string; display?: string; onCommit: (v: string) => void; label: string;
  numeric?: boolean; align?: 'left' | 'right'; placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <button className="set-field" style={{ textAlign: align }} onClick={() => setDraft(value)} aria-label={label + ': ' + (display ?? value) + ', change'} title="Tap to change">
        {(display ?? value) || <span className="muted">{placeholder ?? 'Add'}</span>}
      </button>
    );
  }
  const commit = () => { if (draft !== value) onCommit(draft); setDraft(null); };
  return (
    <input className="field-sm compact" autoFocus value={draft} aria-label={label} inputMode={numeric ? 'decimal' : undefined}
      style={{ width: '100%', textAlign: align }} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDraft(null); }} />
  );
}

/** A greyed "+ Add …" row that opens into its form only when tapped. */
export function AddRow({ label, open, onOpen, children }: { label: string; open: boolean; onOpen: () => void; children: React.ReactNode }) {
  return open ? <div className="add-open">{children}</div> : <button className="add-row" onClick={onOpen}>+ {label}</button>;
}
