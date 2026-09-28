import { useEffect, useState } from 'react';
import { HouseholdData, money, norm, Recipe } from '../lib/model';
import { costContext, fmtQty, ingredientCost } from '../lib/food';

interface Props {
  D: HouseholdData;
  recipe: Recipe;
  /** e.g. "Mon dinner" */
  label: string;
  picks: Record<string, string[]>;
  onSave: (picks: Record<string, string[]>) => void;
  onClose: () => void;
}

/** "Select 3 items from your Vegetables bucket": choose the actual items for a planned meal. */
export default function BucketPickDialog({ D, recipe, label, picks, onSave, onClose }: Props) {
  const ctx = costContext(D);
  const uses = (recipe.buckets ?? []).map(u => ({ u, b: D.buckets.find(b => b.id === u.bucket) })).filter(x => x.b);
  const [chosen, setChosen] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(uses.map(({ u }) => [u.bucket, (picks[u.bucket] ?? []).slice(0, u.count)])));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (bucket: string, name: string, max: number) => setChosen(c => {
    const list = c[bucket] ?? [];
    const has = list.some(n => norm(n) === norm(name));
    if (has) return { ...c, [bucket]: list.filter(n => norm(n) !== norm(name)) };
    // At the limit, a new pick replaces the oldest, so one tap always does something.
    return { ...c, [bucket]: [...(list.length >= max ? list.slice(1) : list), name] };
  });

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={'Pick items for ' + recipe.name} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{recipe.name}</div>
          <span className="note">{label}</span>
        </div>
        {uses.map(({ u, b }) => {
          const list = chosen[u.bucket] ?? [];
          return (
            <div key={u.bucket} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14 }}>Select {u.count} item{u.count === 1 ? '' : 's'} from your <strong>{b!.name}</strong> bucket</span>
                <span className="note" style={{ color: list.length === u.count ? '#1B6B56' : undefined }}>{list.length} of {u.count}</span>
              </div>
              <div className="pick-grid">
                {b!.items.map(g => {
                  const on = list.some(n => norm(n) === norm(g.name)), c = ingredientCost(g, ctx);
                  return (
                    <button key={g.name} className={'pick-item' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(u.bucket, g.name, u.count)}>
                      <span className="box-check" style={{ width: 18, height: 18, borderRadius: 5, fontSize: 11, background: on ? '#23221F' : 'transparent' }}>{on ? '✓' : ''}</span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        {g.name}
                        {g.qty && g.unit && <span className="muted" style={{ fontSize: 11 }}> · {fmtQty(g.qty, g.unit)}</span>}
                      </span>
                      {c !== null && <span className="muted" style={{ fontSize: 12 }}>{money(c)}</span>}
                    </button>
                  );
                })}
                {!b!.items.length && <span className="note">This bucket is empty. Add items to it on the Recipes page.</span>}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <button className="pill dark" style={{ padding: '0 18px' }} onClick={() => { onSave(chosen); onClose(); }}>Done</button>
          <button className="pill plain" onClick={onClose}>Later</button>
          <span className="note">Picked items go on the shopping list.</span>
        </div>
      </div>
    </div>
  );
}
