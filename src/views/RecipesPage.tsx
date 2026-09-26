import { useState } from 'react';
import { addDays, DOW, key } from '../lib/dates';
import { HouseholdData, money, norm, searchRecipes, STATE_COLORS, uid } from '../lib/model';
import type { Update } from '../Household';

export default function RecipesPage({ D, update, mon }: { D: HouseholdData; update: Update; mon: Date }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [ings, setIngs] = useState('');

  const cup = new Map(D.cupboard.map(c => [norm(c.name), c]));
  const weekKeys = DOW.map((_, i) => key(addDays(mon, i)));
  const recipes = searchRecipes(D.recipes, q).slice().sort((a, b) => a.name.localeCompare(b.name));

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const r = { id: uid(), name: n, cost: parseFloat(cost) || 0, ingredients: ings.split(',').map(x => x.trim()).filter(Boolean) };
    update(x => { x.recipes.push(r); });
    setName(''); setCost(''); setIngs(''); setOpen(false);
  };
  const remove = (id: string) => update(x => {
    x.recipes = x.recipes.filter(z => z.id !== id);
    Object.keys(x.plan).forEach(k => { if (x.plan[k].r === id) delete x.plan[k]; });
  });

  return (
    <>
      <div className="row8" style={{ marginBottom: 14 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or ingredient" />
        <button className="pill dark" style={{ height: 44, padding: '0 18px' }} onClick={() => setOpen(o => !o)}>{open ? 'Close' : '+ New recipe'}</button>
      </div>
      {open && (
        <div style={{ background: '#fff', border: '1px solid #23221F', borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 8 }}>
            <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Recipe name" />
            <input className="field" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost $" inputMode="decimal" />
          </div>
          <textarea value={ings} onChange={e => setIngs(e.target.value)} placeholder="Ingredients, comma separated" rows={3}
            style={{ padding: '10px 12px', border: '1px solid #DDD8CC', borderRadius: 10, background: '#fff', fontSize: 14, resize: 'vertical' }} />
          <button className="pill dark" style={{ alignSelf: 'flex-start', padding: '0 18px' }} onClick={save}>Save recipe</button>
        </div>
      )}
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))' }}>
        {recipes.map(r => {
          const planned = weekKeys.map((k, i) => (D.plan[k]?.r === r.id ? DOW[i] : '')).filter(Boolean);
          return (
            <div key={r.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 13 }} className="muted">{money(r.cost)} · {planned.length ? 'On ' + planned.join(', ') : 'Not this week'}</div>
                </div>
                <button className="link-btn" onClick={() => remove(r.id)}>Remove</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {r.ingredients.map((n, i) => {
                  const c = cup.get(norm(n));
                  const dot = !c ? '#BFB8AA' : c.state === 'Full' || c.state === 'Half' ? STATE_COLORS.Full : STATE_COLORS.Replace;
                  return <span key={i} className="ing-tag"><span className="dot6" style={{ background: dot }} />{n}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!recipes.length && <p className="empty">No recipes match “{q}”.</p>}
      <div className="note" style={{ marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span className="legend" style={{ gap: 5 }}><span className="dot6" style={{ background: STATE_COLORS.Full }} />In stock</span>
        <span className="legend" style={{ gap: 5 }}><span className="dot6" style={{ background: STATE_COLORS.Replace }} />Low / replace</span>
        <span className="legend" style={{ gap: 5 }}><span className="dot6" style={{ background: '#BFB8AA' }} />Not stocked</span>
      </div>
    </>
  );
}
