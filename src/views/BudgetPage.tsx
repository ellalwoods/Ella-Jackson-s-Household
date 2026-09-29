import { useState } from 'react';
import { budget, Category, HouseholdData, Income, isShare, money, num, otherPerson, PEOPLE, PersonId, setShare, toggleShare, uid } from '../lib/model';
import { confirmRemove } from './confirm';
import { AddRow, SetField } from './SetField';
import type { Update } from '../Household';
import { Donut } from './BudgetCard';

export default function BudgetPage({ D, update }: { D: HouseholdData; update: Update }) {
  const b = budget(D);
  const [incName, setIncName] = useState('');
  const [incAmt, setIncAmt] = useState('');
  const [incPerson, setIncPerson] = useState<PersonId>('ella');
  const [catName, setCatName] = useState('');
  const [catTotal, setCatTotal] = useState('');

  const [adding, setAdding] = useState<'income' | 'category' | null>(null);
  /** Saved names stay non-empty; saved amounts are stored as numbers. */
  const amountOf = (v: string) => num(v);
  const setCat = (id: string, f: 'name' | 'ella' | 'jackson') => (v: string) => {
    if (f === 'name' && !v.trim()) return;
    update(x => { const c = x.cats.find(c => c.id === id); if (c) if (f === 'name') c.name = v.trim(); else c[f] = amountOf(v); });
  };
  const setInc = (id: string, f: 'name' | 'amount') => (v: string) => {
    if (f === 'name' && !v.trim()) return;
    update(x => { const z = x.incomes.find(z => z.id === id); if (z) if (f === 'name') z.name = v.trim(); else z.amount = amountOf(v); });
  };
  const addIncome = () => {
    const n = incName.trim();
    if (!n) return;
    const inc: Income = { id: uid(), name: n, person: incPerson, amount: parseFloat(incAmt) || 0 };
    update(x => { x.incomes.push(inc); });
    setIncName(''); setIncAmt(''); setAdding(null);
  };
  const addCat = () => {
    const n = catName.trim();
    if (!n) return;
    const half = Math.round((parseFloat(catTotal) || 0) * 50) / 100;
    const cat: Category = { id: uid(), name: n, ella: half, jackson: half };
    update(x => { x.cats.push(cat); });
    setCatName(''); setCatTotal(''); setAdding(null);
  };
  const draftP = PEOPLE[incPerson];

  return (
    <div className="flow">
      <section className="card" style={{ flex: '2 1 460px', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span className="eyebrow">Income sources · per week</span><span style={{ fontSize: 14, fontWeight: 600 }}>{money(b.income)}</span>
        </div>
        {D.incomes.map(i => {
          const p = PEOPLE[i.person];
          return (
            <div key={i.id} className="income-grid" style={{ marginBottom: 4 }}>
              <button className="person-tag" title="Switch person" style={{ height: 'var(--h-sm)', background: p.tint, color: p.ink }}
                onClick={() => update(x => { const z = x.incomes.find(z => z.id === i.id); if (z) z.person = otherPerson(z.person); })}>{p.name}</button>
              <SetField value={i.name} onCommit={setInc(i.id, 'name')} label="Income name" />
              <SetField value={String(num(i.amount))} display={money(num(i.amount))} onCommit={setInc(i.id, 'amount')} label={i.name + ' per week'} numeric align="right" />
              <button className="x-btn" aria-label={'Remove ' + i.name} onClick={() => { if (confirmRemove('this income')) update(x => { x.incomes = x.incomes.filter(z => z.id !== i.id); }); }}>×</button>
            </div>
          );
        })}
        {!D.incomes.length && <p style={{ fontSize: 13, margin: '0 0 8px' }} className="muted">No income logged yet.</p>}
        <div style={{ margin: '8px 0 6px' }}>
          <AddRow label="Add income" open={adding === 'income'} onOpen={() => setAdding('income')}>
            <div className="add-open-row">
              <button className="person-tag" title="Switch person" style={{ height: 'var(--h-sm)', minWidth: 76, background: draftP.tint, color: draftP.ink }}
                onClick={() => setIncPerson(otherPerson(incPerson))}>{draftP.name}</button>
              <input className="field-sm compact" style={{ flex: '1 1 120px' }} autoFocus value={incName} onChange={e => setIncName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIncome(); }} placeholder="e.g. Salary" aria-label="Income name" />
              <input className="field-sm compact" style={{ width: 90 }} value={incAmt} onChange={e => setIncAmt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIncome(); }} placeholder="$ a week" inputMode="decimal" aria-label="Amount per week" />
              <button className="pill-sm dark" onClick={addIncome}>Add</button>
              <button className="link-btn" onClick={() => setAdding(null)}>Cancel</button>
            </div>
          </AddRow>
        </div>
        <p className="note" style={{ margin: '0 0 22px' }}>Tap a name or amount to change it; tap Ella or Jackson to switch.</p>

        <div className="budget-grid eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>
          <span>Category</span><span style={{ color: '#A9477B', textAlign: 'right', paddingRight: 9 }}>Ella $</span><span style={{ color: '#1B6B56', textAlign: 'right', paddingRight: 9 }}>Jackson $</span><span />
        </div>
        {b.cats.map((c, i) => (
          <div key={c.id} className="budget-grid" style={{ padding: '10px 0 6px', borderTop: i ? '1px solid #F0ECE4' : 'none' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              <span className="dot8" style={{ background: c.color, flex: 'none' }} />
              <SetField value={c.name} onCommit={setCat(c.id, 'name')} label="Category name" />
            </div>
            {c.pct !== null ? (
              <div className="share-cell">
                {b.cats.filter(z => z.pct !== null).length > 1
                  ? <span style={{ width: 70 }}><SetField value={String(Math.round(c.pct * 10) / 10)} display={Math.round(c.pct * 10) / 10 + '%'} numeric align="right"
                      label={c.name + ' percentage of what’s left'} onCommit={v => { const n = parseFloat(v); if (!isNaN(n)) update(x => setShare(x.cats, c.id, n)); }} /></span>
                  : <span style={{ fontSize: 13, fontWeight: 600 }}>100%</span>}
                <span className="note" style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#A9477B' }}>{money(c.e)}</span> · <span style={{ color: '#1B6B56' }}>{money(c.j)}</span>
                </span>
              </div>
            ) : <>
              <SetField value={String(num(c.ella))} display={money(num(c.ella))} onCommit={setCat(c.id, 'ella')} label={'Ella, ' + c.name} numeric align="right" />
              <SetField value={String(num(c.jackson))} display={money(num(c.jackson))} onCommit={setCat(c.id, 'jackson')} label={'Jackson, ' + c.name} numeric align="right" />
            </>}
            <button className="x-btn" aria-label={'Remove ' + c.name} onClick={() => { if (confirmRemove('the “' + c.name + '” category')) update(x => { x.cats = x.cats.filter(z => z.id !== c.id); }); }}>×</button>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '0 0 4px 14px' }}>
              <button className="filter" aria-pressed={!!c.fixed} onClick={() => update(x => {
                const z = x.cats.find(z => z.id === c.id);
                if (!z) return;
                if (isShare(z)) toggleShare(x.cats, z.id, c);
                z.fixed = !z.fixed;
              })} style={toggleStyle(!!c.fixed)}>Fixed</button>
              {!/grocer/i.test(c.name) && (
                <button className="filter" aria-pressed={c.pct !== null} onClick={() => update(x => toggleShare(x.cats, c.id, c))}
                  style={toggleStyle(c.pct !== null)}>Share of what’s left</button>
              )}
              <span className="note">{c.fixed ? 'Always full, like rent.'
                : c.pct !== null ? Math.round(c.pct) + '% of what’s left. The others shift to fit.'
                : /grocer/i.test(c.name) ? 'Fills from planned meals and spends.' : 'Fills as you log spends.'}</span>
            </div>
          </div>
        ))}
        <div style={{ margin: '8px 0 12px' }}>
          <AddRow label="Add category" open={adding === 'category'} onOpen={() => setAdding('category')}>
            <div className="add-open-row">
              <input className="field-sm compact" style={{ flex: '1 1 140px' }} autoFocus value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCat(); }} placeholder="e.g. Internet" aria-label="Category name" />
              <input className="field-sm compact" style={{ width: 110 }} value={catTotal} onChange={e => setCatTotal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCat(); }} placeholder="$ a week, total" inputMode="decimal" aria-label="Total per week" />
              <button className="pill-sm dark" onClick={addCat}>Add</button>
              <button className="link-btn" onClick={() => setAdding(null)}>Cancel</button>
            </div>
            <span className="note">Split 50/50 between you; change it after.</span>
          </AddRow>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, padding: '10px 0', borderTop: '1px solid #23221F', marginTop: 6 }}>
          <span>Committed</span><span>{money(b.spend)}</span>
        </div>
        {/* Left over as a sum: each person's amount, a rule, then the total. */}
        <div style={{ marginLeft: 'auto', width: 'min(100%, 260px)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          <div className="kv"><span style={{ color: '#A9477B' }}>Ella has left</span><span style={{ color: '#A9477B', fontWeight: 600 }}>{money(b.ellaLeft)}</span></div>
          <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson has left</span><span style={{ color: '#1B6B56', fontWeight: 600 }}>{money(b.jacksonLeft)}</span></div>
          <div className="kv" style={{ borderTop: '1px solid #23221F', paddingTop: 6, marginTop: 2, fontWeight: 600 }}><span>Left</span><span>{money(b.left)}</span></div>
          {b.splits && <span className="note">
            {money(b.income)} income − {b.cats.filter(c => c.pct === null).map(c => c.name + ' ' + money(c.total)).join(' − ')} = <strong>{money(b.left)}</strong>,
            shared between {listOf(b.cats.filter(c => c.pct !== null).map(c => c.name))}. Each week follows what’s actually left.
          </span>}
        </div>
      </section>
      <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
          <Donut slices={b.slices} size={110} hole={18} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <span>Ella pays <strong>{money(b.ella)}</strong></span>
            <span>Jackson pays <strong>{money(b.jackson)}</strong></span>
            <span style={{ color: '#A9477B' }}>Ella has left <strong>{money(b.ellaLeft)}</strong></span>
            <span style={{ color: '#1B6B56' }}>Jackson has left <strong>{money(b.jacksonLeft)}</strong></span>
            <span className="muted">of {money(b.income)} income</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

const toggleStyle = (on: boolean): React.CSSProperties => ({
  height: 'var(--h-sm)', fontSize: 12, borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F',
});

const listOf = (names: string[]) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
