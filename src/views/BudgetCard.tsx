import { budget, HouseholdData, money } from '../lib/model';
import { GroceryEstimate, groceryEstimate, PLAN_SLOTS } from '../lib/food';

export function Donut({ bg, size, hole, children }: { bg: string; size: number; hole: number; children?: React.ReactNode }) {
  return (
    <div className="donut" style={{ width: size, height: size, background: bg }}>
      <div className="donut-hole" style={{ inset: hole }}>{children}</div>
    </div>
  );
}

export default function BudgetCard({ D, mon, onEdit }: { D: HouseholdData; mon: Date; onEdit: () => void }) {
  const g = groceryEstimate(D, mon);
  const b = budget(D, g);

  return (
    <section className="card" style={{ flex: '1 1 300px', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Budget <span style={{ fontWeight: 400, fontSize: 13 }} className="muted">per week</span></h2>
        <button className="link-btn" style={{ fontSize: 13 }} onClick={onEdit}>Edit</button>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Donut bg={b.donut} size={140} hole={22}>
          <span style={{ fontSize: 11 }} className="muted">Left over</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{money(b.left)}</span>
        </Donut>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, flex: 1, minWidth: 140 }}>
          <div className="kv"><span className="muted">Income</span><span style={{ fontWeight: 600 }}>{money(b.income)}</span></div>
          <div className="kv"><span className="muted">Committed</span><span style={{ fontWeight: 600 }}>{money(b.spend)}</span></div>
          <div className="kv"><span style={{ color: '#A9477B' }}>Ella pays</span><span>{money(b.ella)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson pays</span><span>{money(b.jackson)}</span></div>
          <div className="kv" style={{ borderTop: '1px solid #F0ECE4', paddingTop: 6 }}><span style={{ color: '#A9477B' }}>Ella has left</span><span style={{ fontWeight: 600 }}>{money(b.ellaLeft)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson has left</span><span style={{ fontWeight: 600 }}>{money(b.jacksonLeft)}</span></div>
        </div>
      </div>
      {b.cats.map(c => (
        <div key={c.id} className="cat-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="swatch" style={{ background: c.color }} />{c.name}</span>
            <span style={{ fontWeight: 600 }}>{money(c.total)}</span>
          </div>
          {g && g.id === c.id && <GroceryTag g={g} />}
          <div className="split-bar">
            <div style={{ background: '#E886B8', width: c.total ? (c.e / c.total * 100) + '%' : '50%' }} />
            <div style={{ background: '#2A9E80', width: c.total ? (c.j / c.total * 100) + '%' : '50%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#A9477B' }}>{money(c.e)}</span><span style={{ color: '#1B6B56' }}>{money(c.j)}</span>
          </div>
        </div>
      ))}
      {!b.cats.length && <p style={{ fontSize: 13, margin: 0 }} className="muted">No categories yet.</p>}
    </section>
  );
}

/** Marks the Groceries amount as a placeholder, part placeholder, or taken from the meal plan. */
export function GroceryTag({ g }: { g: GroceryEstimate }) {
  const tone = g.status === 'planned' ? { background: '#DAEFE7', color: '#1B6B56' } : { background: '#F2EEE6', color: '#6D675C' };
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
      <span style={{ ...tone, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{g.status === 'placeholder' ? 'Placeholder' : g.status === 'partial' ? 'Part placeholder' : 'Meal plan'}</span>
      <span className="muted">
        {g.status === 'placeholder' ? money(g.placeholder) + ' until you plan meals'
          : g.status === 'partial' ? money(g.mealCost) + ' planned + placeholder for ' + (PLAN_SLOTS - g.filled) + ' empty meals'
          : money(g.mealCost) + ' across this week’s meals'}
      </span>
    </span>
  );
}
