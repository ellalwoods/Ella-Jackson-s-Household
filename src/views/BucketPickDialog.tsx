import { useEffect, useState } from 'react';
import { BLANK_PICK, HouseholdData, money, norm, Recipe } from '../lib/model';
import { costContext, fmtQty, itemCost, miniOf } from '../lib/food';

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

  /** With more than one bucket, they're shown one at a time, like steps. */
  const [step, setStep] = useState(0);
  const last = step >= uses.length - 1;
  /** Tag filter per bucket ('' = all items). */
  const [filter, setFilter] = useState<Record<string, string>>({});
  const addBlank = (bucket: string, max: number) => setChosen(c => {
    const list = c[bucket] ?? [];
    return { ...c, [bucket]: [...(list.length >= max ? list.slice(1) : list), BLANK_PICK] };
  });
  const removeBlank = (bucket: string) => setChosen(c => {
    const list = c[bucket] ?? [], i = list.lastIndexOf(BLANK_PICK);
    return i < 0 ? c : { ...c, [bucket]: [...list.slice(0, i), ...list.slice(i + 1)] };
  });

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
        {uses.length > 1 && (
          <div className="pick-steps" aria-label={'Bucket ' + (step + 1) + ' of ' + uses.length}>
            {uses.map(({ u, b }, i) => {
              const done = (chosen[u.bucket] ?? []).length >= u.count;
              return (
                <button key={u.bucket} className={'pick-step' + (i === step ? ' on' : '') + (done ? ' done' : '')} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                  <span className="pick-step-num">{done ? '✓' : i + 1}</span>{b!.name}
                </button>
              );
            })}
          </div>
        )}
        {uses.filter((_, i) => i === step).map(({ u, b }) => {
          const list = chosen[u.bucket] ?? [];
          const blanks = list.filter(n => n === BLANK_PICK).length;
          const tag = filter[u.bucket] ?? '';
          const items = b!.items.filter(g => !tag || (g.tags ?? []).some(t => norm(t) === norm(tag)));
          return (
            <div key={u.bucket} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14 }}>Select {u.count} item{u.count === 1 ? '' : 's'} from your <strong>{b!.name}</strong> bucket</span>
                <span className="note" style={{ color: list.length === u.count ? '#1B6B56' : undefined }}>{list.length} of {u.count}</span>
              </div>
              {(b!.tags ?? []).length > 0 && (
                <div className="row" style={{ gap: 4 }}>
                  {['', ...b!.tags!].map(t => (
                    <button key={t || 'all'} className={'mini-tag' + (tag === t ? ' on' : '')} aria-pressed={tag === t}
                      onClick={() => setFilter(f => ({ ...f, [u.bucket]: t }))}>{t || 'All'}</button>
                  ))}
                </div>
              )}
              <div className="pick-grid">
                {items.map(g => {
                  const on = list.some(n => norm(n) === norm(g.name)), c = itemCost(g, ctx), mini = miniOf(g, ctx);
                  return (
                    <button key={g.name} title={g.name} className={'pick-item' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(u.bucket, g.name, u.count)}>
                      <span className="box-check" style={{ width: 18, height: 18, borderRadius: 5, fontSize: 11, background: on ? '#23221F' : 'transparent' }}>{on ? '✓' : ''}</span>
                      <span className="pick-name">
                        {g.name}
                        {mini ? <span className="muted" style={{ fontSize: 11 }}> · mini recipe</span>
                          : ctx.staples.has(norm(g.name)) ? <span className="muted" style={{ fontSize: 11 }}> · staple</span>
                          : g.qty && g.unit && <span className="muted" style={{ fontSize: 11 }}> · {fmtQty(g.qty, g.unit)}</span>}
                      </span>
                      {c !== null && <span className="pick-price">{money(c)}</span>}
                    </button>
                  );
                })}
                {!b!.items.length && <span className="note">This bucket is empty. Add items to it on the Recipes page.</span>}
                {b!.items.length > 0 && !items.length && <span className="note">No items tagged {tag}.</span>}
              </div>
              <div className="row" style={{ alignItems: 'center', gap: 6 }}>
                <button className="mini-tag" onClick={() => addBlank(u.bucket, u.count)} title="Leave a spot empty: nothing bought, costs nothing">+ Blank</button>
                {blanks > 0 && (
                  <span className="mini-tag on">{blanks} blank{blanks > 1 ? 's' : ''}
                    <button className="mini-tag-x" aria-label="Remove a blank" onClick={() => removeBlank(u.bucket)}>×</button>
                  </span>
                )}
                <span className="note">Blanks leave a spot empty.</span>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          {step > 0 && <button className="pill plain" onClick={() => setStep(s => s - 1)}>Back</button>}
          {last
            ? <button className="pill dark" style={{ padding: '0 18px' }} onClick={() => { onSave(chosen); onClose(); }}>Done</button>
            : <button className="pill dark" style={{ padding: '0 18px' }} onClick={() => setStep(s => s + 1)}>Next</button>}
          <button className="link-btn" onClick={onClose}>Later</button>
          <span className="note">Picked items go on the shopping list.</span>
        </div>
      </div>
    </div>
  );
}
