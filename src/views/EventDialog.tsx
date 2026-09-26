import { useEffect, useState } from 'react';
import { parse, MON } from '../lib/dates';
import { CalEvent, CHORE_OWNERS, ChoreOwner, HouseholdData, norm, OWNERS, soft, Tag, TAG_COLORS, uid } from '../lib/model';
import type { Update } from '../Household';

interface Props { D: HouseholdData; update: Update; date: string; event: CalEvent | null; onClose: () => void }

const longDate = (k: string) => { const d = parse(k); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };

/** Add or edit a calendar event. New tags typed here are saved with the next colour in the palette. */
export default function EventDialog({ D, update, date: initialDate, event, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? initialDate);
  const [time, setTime] = useState(event?.time ?? '');
  const [place, setPlace] = useState(event?.place ?? '');
  const [who, setWho] = useState<ChoreOwner>(event?.who ?? 'both');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [tags, setTags] = useState<string[]>(event?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  /** Tags created in this dialog, saved along with the event. */
  const [created, setCreated] = useState<Tag[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const allTags = [...D.tags, ...created];
  const tagColor = (n: string) => allTags.find(t => norm(t.name) === norm(n))?.color ?? '#BFB8AA';
  const has = (n: string) => tags.some(t => norm(t) === norm(n));
  const toggle = (n: string) => setTags(ts => (ts.some(t => norm(t) === norm(n)) ? ts.filter(t => norm(t) !== norm(n)) : [...ts, n]));
  const addTag = () => {
    const n = newTag.trim();
    if (!n) return;
    const existing = allTags.find(t => norm(t.name) === norm(n));
    if (!existing) setCreated(c => [...c, { name: n, color: TAG_COLORS[(D.tags.length + c.length) % TAG_COLORS.length] }]);
    if (!has(existing?.name ?? n)) setTags(ts => [...ts, existing?.name ?? n]);
    setNewTag('');
  };

  const save = () => {
    const t = title.trim();
    if (!t || !date) return;
    const ev: CalEvent = { id: event?.id ?? uid(), date, title: t, who, tags };
    if (time) ev.time = time;
    if (place.trim()) ev.place = place.trim();
    if (notes.trim()) ev.notes = notes;
    update(x => {
      for (const c of created) if (!x.tags.some(z => norm(z.name) === norm(c.name))) x.tags.push(c);
      const i = x.events.findIndex(z => z.id === ev.id);
      if (i >= 0) x.events[i] = ev; else x.events.push(ev);
    });
    onClose();
  };
  const remove = () => {
    if (event) update(x => { x.events = x.events.filter(z => z.id !== event.id); });
    onClose();
  };

  const accent = tags.length ? tagColor(tags[0]) : OWNERS[who].color;

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={event ? 'Edit event' : 'New event'} onClick={e => e.stopPropagation()}
        style={{ borderTop: '6px solid ' + soft(accent, 0.35) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{event ? 'Edit event' : 'New event'}</div>
          <span className="note">{longDate(date)}</span>
        </div>
        <input className="field" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
          onKeyDown={e => { if (e.key === 'Enter') save(); }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input className="field" type="date" style={{ flex: '1 1 140px' }} value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
          <input className="field" type="time" style={{ flex: '1 1 110px' }} value={time} onChange={e => setTime(e.target.value)} aria-label="Time" />
        </div>
        <input className="field" value={place} onChange={e => setPlace(e.target.value)} placeholder="Place" />
        <div style={{ display: 'flex', gap: 6 }}>
          {CHORE_OWNERS.map(o => {
            const on = who === o, c = OWNERS[o];
            return (
              <button key={o} onClick={() => setWho(o)}
                style={{ flex: 1, height: 38, borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 600, border: '1.5px solid ' + c.color, background: on ? c.color : '#fff', color: on ? '#fff' : c.ink }}>
                {c.name}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 11 }}>Tags</span>
          <div className="row" style={{ alignItems: 'center' }}>
            {allTags.map(t => {
              const on = has(t.name);
              return (
                <button key={t.name} className="tag-chip" aria-pressed={on} onClick={() => toggle(t.name)}
                  style={{ background: on ? soft(t.color) : '#fff', borderColor: on ? t.color : '#DDD8CC' }}>
                  <span className="dot8" style={{ background: t.color }} />{t.name}
                </button>
              );
            })}
            <input className="field-sm" style={{ height: 30, width: 130, fontSize: 13 }} value={newTag} onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="+ New tag" aria-label="New tag" />
            {newTag.trim() && <button className="pill-sm" style={{ height: 30 }} onClick={addTag}>Add</button>}
          </div>
          {tags.length > 1 && <span className="note">The first tag ({tags[0]}) colours the event.</span>}
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={3}
          style={{ padding: '10px 12px', border: '1px solid #DDD8CC', borderRadius: 10, background: '#fff', fontSize: 14, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="pill dark" style={{ padding: '0 18px' }} onClick={save}>{event ? 'Save' : 'Add event'}</button>
          <button className="pill plain" onClick={onClose}>Cancel</button>
          {event && <button className="link-btn" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={remove}>Delete</button>}
        </div>
      </div>
    </div>
  );
}
