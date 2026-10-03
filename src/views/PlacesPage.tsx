import { useEffect, useState } from 'react';
import { DOW, dowIndex, MON, parse, key } from '../lib/dates';
import { HouseholdData, MEAL_LABEL, Meal, money, norm, Place, PLACE_KIND_LABEL, PLACE_KINDS, PlaceKind, uid } from '../lib/model';
import type { Update } from '../Household';
import { safeLink, TagEdit } from './RecipeEditor';
import { confirmRemove } from './confirm';

type Show = 'all' | 'want' | 'been';

/** Restaurants, bars and cafés: a list you can plan meals out from. */
export default function PlacesPage({ D, update }: { D: HouseholdData; update: Update }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<PlaceKind | 'all'>('all');
  const [show, setShow] = useState<Show>('all');
  const [tag, setTag] = useState('');
  /** null = closed, 'new' = adding, or the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);

  const pq = norm(q);
  const visits = placeVisits(D);
  const usedTags = D.placeTags.filter(t => D.places.some(p => (p.tags ?? []).some(x => norm(x) === norm(t))));
  const list = D.places
    .filter(p => !pq || [p.name, p.suburb, ...(p.tags ?? []), p.notes].some(v => norm(v).includes(pq)))
    .filter(p => kind === 'all' || p.kind === kind)
    .filter(p => show === 'all' || (show === 'been') === p.been)
    .filter(p => !tag || (p.tags ?? []).some(x => norm(x) === norm(tag)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const remove = (p: Place) => {
    if (!confirmRemove('“' + p.name + '”')) return;
    update(x => {
      x.places = x.places.filter(z => z.id !== p.id);
      // Meals already planned there keep the name as plain text.
      for (const [slot, id] of Object.entries(x.eatOutPlace)) if (id === p.id) { x.eatOut[slot] = p.name; delete x.eatOutPlace[slot]; }
    });
  };

  return (
    <>
      <div className="row8" style={{ marginBottom: 14 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, suburb or tag" aria-label="Search places" />
        <button className="pill dark lg" onClick={() => setEditing('new')}>+ New place</button>
      </div>
      {D.places.length > 0 && (
        <div className="filter-rows">
          <div className="filter-row">
            <span className="filter-label">Type</span>
            <div className="seg" role="group" aria-label="Filter by type">
              {(['all', ...PLACE_KINDS] as const).map(k => {
                const n = k === 'all' ? D.places.length : D.places.filter(p => p.kind === k).length;
                if (k !== 'all' && !n) return null;
                return <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'All' : PLACE_KIND_LABEL[k]} <span className="seg-count">{n}</span></button>;
              })}
            </div>
          </div>
          <div className="filter-row">
            <span className="filter-label">Show</span>
            <div className="seg" role="group" aria-label="Been or want to try">
              {([['all', 'All'], ['want', 'Want to try'], ['been', 'Been']] as [Show, string][]).map(([k, l]) => (
                <button key={k} className={show === k ? 'on' : ''} aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>
              ))}
            </div>
          </div>
          {usedTags.length > 0 && (
            <div className="filter-row">
              <span className="filter-label">Tags</span>
              <div className="row" style={{ gap: 4 }}>
                {['', ...usedTags].map(t => (
                  <button key={t || 'any'} className={'mini-tag' + (tag === t ? ' on' : '')} aria-pressed={tag === t} onClick={() => setTag(t)}>{t || 'Any'}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,270px),1fr))' }}>
        {list.map(p => {
          const link = safeLink(p.link), v = visits.get(p.id);
          return (
            <div key={p.id} className="card place-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 13 }} className="muted">
                    {[PLACE_KIND_LABEL[p.kind], p.suburb, p.cost ? money(p.cost) + ' pp' : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span style={{ display: 'flex', gap: 10, flex: 'none' }}>
                  <button className="link-btn" onClick={() => setEditing(p.id)}>Edit</button>
                  <button className="link-btn" onClick={() => remove(p)}>Remove</button>
                </span>
              </div>
              {(p.tags ?? []).length > 0 && (
                <div className="row" style={{ gap: 4 }}>
                  {p.tags!.map(t => <button key={t} className={'mini-tag dense' + (norm(tag) === norm(t) ? ' on' : '')} onClick={() => setTag(norm(tag) === norm(t) ? '' : t)}>{t}</button>)}
                </div>
              )}
              {p.notes && <p className="place-notes">{p.notes}</p>}
              <div className="place-foot">
                <button className={'mini-tag' + (p.been ? ' been' : '')} aria-pressed={p.been} title="Tap to switch"
                  onClick={() => update(x => { const z = x.places.find(z => z.id === p.id); if (z) z.been = !z.been; })}>{p.been ? '✓ Been' : 'Want to try'}</button>
                {v?.next ? <span className="note">Planned {v.next}</span> : v?.last ? <span className="note">Last went {v.last}</span> : null}
                {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 13 }}>Open ↗</a>}
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && (
        <p className="empty">{D.places.length ? 'No places match.' : 'No places yet. Add the restaurants, bars and cafés you like, or want to try. You can then pick them when planning a meal out.'}</p>
      )}
      {editing && <PlaceDialog D={D} update={update} place={editing === 'new' ? null : D.places.find(p => p.id === editing) ?? null} onClose={() => setEditing(null)} />}
    </>
  );
}

/** When each place was last (or is next) planned as a meal out. */
function placeVisits(D: HouseholdData) {
  const today = key(new Date()), out = new Map<string, { last?: string; next?: string }>();
  const fmt = (k: string, meal: string) => { const d = parse(k); return DOW[dowIndex(d)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + MEAL_LABEL[meal as Meal].toLowerCase(); };
  const entries = Object.entries(D.eatOutPlace).map(([slot, id]) => ({ id, k: slot.split('|')[0], meal: slot.split('|')[1] })).sort((a, b) => a.k.localeCompare(b.k));
  for (const e of entries) {
    const v = out.get(e.id) ?? {};
    if (e.k < today) v.last = fmt(e.k, e.meal);
    else if (!v.next) v.next = fmt(e.k, e.meal);
    out.set(e.id, v);
  }
  return out;
}

/** Add or edit a place. */
export function PlaceDialog({ D, update, place, onClose, onSaved, initialName = '' }: {
  D: HouseholdData; update: Update; place: Place | null; onClose: () => void; onSaved?: (p: Place) => void; initialName?: string;
}) {
  const [name, setName] = useState(place?.name ?? initialName);
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? 'restaurant');
  const [suburb, setSuburb] = useState(place?.suburb ?? '');
  const [cost, setCost] = useState(place?.cost != null ? String(place.cost) : '');
  const [tags, setTags] = useState<string[]>(place?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [link, setLink] = useState(place?.link ?? '');
  const [notes, setNotes] = useState(place?.notes ?? '');
  const [been, setBeen] = useState(place?.been ?? false);
  const allTags = Array.from(new Set([...D.placeTags, ...tags])).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Place tags are shared, so renaming or removing one applies to every place.
  const renameTag = (from: string, to: string) => {
    const t = to.trim();
    if (!t || norm(t) === norm(from)) return;
    const swap = (ts: string[]) => ts.map(x => (norm(x) === norm(from) ? t : x)).filter((z, i, a) => a.findIndex(y => norm(y) === norm(z)) === i);
    setTags(swap);
    update(x => {
      x.placeTags = swap(x.placeTags);
      for (const p of x.places) if (p.tags) p.tags = swap(p.tags);
    });
  };
  const deleteTag = (t: string) => {
    const used = D.places.some(p => p.id !== place?.id && (p.tags ?? []).some(x => norm(x) === norm(t)));
    if (used && !confirmRemove('the “' + t + '” tag from every place')) return;
    const drop = (ts: string[]) => ts.filter(x => norm(x) !== norm(t));
    setTags(drop);
    update(x => {
      x.placeTags = drop(x.placeTags);
      for (const p of x.places) if (p.tags) { p.tags = drop(p.tags); if (!p.tags.length) delete p.tags; }
    });
  };
  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    const existing = allTags.find(x => norm(x) === norm(t)) ?? t;
    if (!tags.some(x => norm(x) === norm(existing))) setTags(ts => [...ts, existing]);
    setNewTag('');
  };
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const out: Place = { id: place?.id ?? uid(), name: n, kind, been };
    if (suburb.trim()) out.suburb = suburb.trim();
    const c = parseFloat(cost.replace(/[$,\s]/g, ''));
    if (!isNaN(c)) out.cost = c;
    if (tags.length) out.tags = tags;
    if (safeLink(link)) out.link = safeLink(link);
    if (notes.trim()) out.notes = notes.trim();
    update(x => {
      const i = x.places.findIndex(z => z.id === out.id);
      if (i >= 0) x.places[i] = out; else x.places.push(out);
      for (const t of tags) if (!x.placeTags.some(z => norm(z) === norm(t))) x.placeTags.push(t);
    });
    onSaved?.(out);
    onClose();
  };

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={place ? 'Edit place' : 'New place'} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{place ? 'Edit place' : 'New place'}</div>
        <input className="field" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Bella Brutta" aria-label="Name"
          onKeyDown={e => { if (e.key === 'Enter') save(); }} />
        <div className="seg" role="group" aria-label="Type" style={{ alignSelf: 'flex-start', flexWrap: 'wrap', borderRadius: 18 }}>
          {PLACE_KINDS.map(k => <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{PLACE_KIND_LABEL[k]}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-sm compact" style={{ flex: 1 }} value={suburb} onChange={e => setSuburb(e.target.value)} placeholder="Suburb (optional)" aria-label="Suburb" />
          <input className="field-sm compact" style={{ width: 120 }} value={cost} onChange={e => setCost(e.target.value)} placeholder="$ per person" inputMode="decimal" aria-label="Typical cost per person" />
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="field-label" style={{ width: 40 }}>Tags</span>
          {editingTags
            ? allTags.map(t => <TagEdit key={t} tag={t} onRename={n => renameTag(t, n)} onDelete={() => deleteTag(t)} />)
            : allTags.map(t => {
              const on = tags.some(x => norm(x) === norm(t));
              return <button key={t} className={'mini-tag' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setTags(ts => (on ? ts.filter(x => norm(x) !== norm(t)) : [...ts, t]))}>{t}</button>;
            })}
          {!editingTags && <>
            <input className="field-sm compact" style={{ width: 150 }} value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="+ New tag" aria-label="New tag"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            {newTag.trim() && <button className="pill-sm" onClick={addTag}>Add</button>}
          </>}
          {allTags.length > 0 && <button className="link-btn" style={{ marginLeft: 4 }} onClick={() => setEditingTags(v => !v)}>{editingTags ? 'Done' : 'Edit tags'}</button>}
        </div>
        <input className="field-sm compact" value={link} onChange={e => setLink(e.target.value)} placeholder="Link (website or booking)" aria-label="Link" inputMode="url" autoCapitalize="off" />
        <textarea className="textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes, e.g. book ahead, get the lamb" aria-label="Notes" />
        <div className="seg" role="group" aria-label="Been or want to try" style={{ alignSelf: 'flex-start' }}>
          <button className={!been ? 'on' : ''} aria-pressed={!been} onClick={() => setBeen(false)}>Want to try</button>
          <button className={been ? 'on' : ''} aria-pressed={been} onClick={() => setBeen(true)}>Been</button>
        </div>
        <div className="row8" style={{ marginTop: 4 }}>
          <button className="pill dark" style={{ padding: '0 18px' }} onClick={save}>{place ? 'Save' : 'Add place'}</button>
          <button className="pill plain" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
