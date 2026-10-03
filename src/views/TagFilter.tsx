import { useState } from 'react';
import { HouseholdData, norm, removeTag, renameTag, tagUses } from '../lib/model';
import type { Update } from '../Household';
import { TagEdit } from './RecipeEditor';
import { confirmRemove } from './confirm';

/**
 * The "Tags" filter row on the Recipes and Places pages. "Edit tags" turns
 * every tag into a box to rename (or × to remove), applied everywhere.
 */
export default function TagFilter({ D, update, kind, active, onPick, count }: {
  D: HouseholdData; update: Update; kind: 'recipe' | 'place'; active: string; onPick: (t: string) => void; count?: (t: string) => number;
}) {
  const [editing, setEditing] = useState(false);
  const all = kind === 'recipe' ? D.recipeTags : D.placeTags;
  const used = all.filter(t => tagUses(D, kind, t) > 0);
  if (!all.length) return null;
  const what = kind === 'recipe' ? 'recipe' : 'place';

  const rename = (from: string, to: string) => {
    if (!to.trim() || norm(to) === norm(from)) return;
    update(x => renameTag(x, kind, from, to));
    if (norm(active) === norm(from)) onPick(to.trim());
  };
  const remove = (t: string) => {
    if (tagUses(D, kind, t) && !confirmRemove('the “' + t + '” tag from every ' + what)) return;
    update(x => removeTag(x, kind, t));
    if (norm(active) === norm(t)) onPick('');
  };

  return (
    <div className="filter-row">
      <span className="filter-label">Tags</span>
      <div className="row" style={{ gap: 4, alignItems: 'center' }}>
        {editing
          ? all.map(t => <TagEdit key={t} tag={t} onRename={n => rename(t, n)} onDelete={() => remove(t)} />)
          : ['', ...used].map(t => (
            <button key={t || 'any'} className={'mini-tag' + (active === t ? ' on' : '')} aria-pressed={active === t} onClick={() => onPick(t)}>
              {t || 'Any'}{t && count ? ' · ' + count(t) : ''}
            </button>
          ))}
        <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Edit tags'}</button>
      </div>
    </div>
  );
}
