import { useState } from 'react';
import { budget, Category, HouseholdData, Income, isShare, money, num, otherPerson, PEOPLE, PersonId, setShare, toggleShare, uid } from '../lib/model';
import { confirmRemove } from './confirm';
import { AddRow, SetField } from './SetField';
import type { Update } from '../Household';
import { Donut } from './BudgetCard';

type Mode = 'spent' | 'fixed' | 'share';
const MODES: [Mode, string][] = [['spent', 'As spent'], ['fixed', 'Fixed'], ['share', 'Share of left']];

export default function BudgetPage({ D, update }: { D: HouseholdData; update: Update }) {
  const b = budget(D);
  const [adding, setAdding] = useState<'income' | 'category' | null>(null);
  const [incName, setIncName] = useState('');
  const [incAmt, setIncAmt] = useState('');
  const [incPerson, setIncPerson] = useState<PersonId>('ella');
  const [catName, setCatName] = useState('');
  const [catTotal, setCatTotal] = useState('');

  const setCat = (id: string, f: 'name' | 'ella' | 'jackson') => (v: string) => {
    if (f === 'name' && !v.trim()) return;
    update(x => { const c = x.cats.find(c => c.id === id); if (c) { if (f === 'name') c.name = v.trim(); else c[f] = num(v); } });
  };
  const setInc = (id: string, f: 'name' | 'amount') => (v: string) => {
    if (f === 'name' && !v.trim()) return;
    update(x => { const z = x.incomes.find(z => z.id === id); if (z) { if (f === 'name') z.name = v.trim(); else z.amount = num(v); } });
  };
  /** Each category fills one of three ways: as you log spends, always full, or from what's left. */
  const setMode = (c: { id: string; e: number; j: number }, m: Mode) => update(x => {
    const z = x.cats.find(z => z.id === c.id);
    if (!z) return;
    if (m === 'share') { if (!isShare(z)) toggleShare(x.cats, z.id); return; }
    if (isShare(z)) toggleShare(x.cats, z.id, c);
    z.fixed = m === 'fixed';
  });
  const addIncome = () => {
    const n = incName.trim();
    if (!n) return;
    const inc: Income = { id: uid(), name: n, person: incPerson, amount: num(incAmt) };
    update(x => { x.incomes.push(inc); });
    setIncName(''); setIncAmt(''); setAdding(null);
  };
  const addCat = () => {
    const n = catName.trim();
    if (!n) return;
    const half = Math.round(num(catTotal) * 50) / 100;
    const cat: Category = { id: uid(), name: n, ella: half, jackson: half };
    update(x => { x.cats.push(cat); });
    setCatName(''); setCatTotal(''); setAdding(null);
  };
  const draftP = PEOPLE[incPerson];
  const shares = b.cats.filter(c => c.pct !== null);

  return (
    <div className="budget-layout">
      <section className="card" style={{ padding: 18 }}>
        <div className="card-title">Income <span className="sub">per week</span><span className="card-title-end">{money(b.income)}</span></div>
        <div className="list">
          {D.incomes.map(i => {
            const p = PEOPLE[i.person];
            return (
              <div key={i.id} className="budget-row income-row">
                <button className="person-tag" title="Switch person" style={{ height: 'var(--h-xs)', background: p.tint, color: p.ink }}
                  onClick={() => update(x => { const z = x.incomes.find(z => z.id === i.id); if (z) z.person = otherPerson(z.person); })}>{p.name}</button>
                <SetField value={i.name} onCommit={setInc(i.id, 'name')} label="Income name" />
                <SetField value={String(num(i.amount))} display={money(num(i.amount))} onCommit={setInc(i.id, 'amount')} label={i.name + ' per week'} numeric align="right" />
                <button className="link-btn" onClick={() => { if (confirmRemove('this income')) update(x => { x.incomes = x.incomes.filter(z => z.id !== i.id); }); }}>Remove</button>
              </div>
            );
          })}
          {!D.incomes.length && <p className="empty" style={{ margin: '4px 0' }}>No income yet.</p>}
        </div>
        <AddRow label="Add income" open={adding === 'income'} onOpen={() => setAdding('income')}>
          <div className="add-open-row">
            <button className="person-tag" title="Switch person" style={{ height: 'var(--h-sm)', minWidth: 76, background: draftP.tint, color: draftP.ink }}
              onClick={() => setIncPerson(otherPerson(incPerson))}>{draftP.name}</button>
            <input className="field-sm compact" style={{ flex: '1 1 120px' }} autoFocus value={incName} onChange={e => setIncName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIncome(); }} placeholder="e.g. Salary" aria-label="Income name" />
            <input className="field-sm compact money" value={incAmt} onChange={e => setIncAmt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIncome(); }} placeholder="$ a week" inputMode="decimal" aria-label="Amount per week" />
            <button className="pill-sm dark" onClick={addIncome}>Add</button>
            <button className="link-btn" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        </AddRow>

        <div className="card-title" style={{ marginTop: 26 }}>Spending <span className="sub">per week</span></div>
        <div className="budget-row budget-head">
          <span>Category</span><span style={{ color: '#A9477B' }}>Ella</span><span style={{ color: '#1B6B56' }}>Jackson</span><span />
        </div>
        <div className="list">
          {b.cats.map(c => {
            const mode: Mode = c.fixed ? 'fixed' : c.pct !== null ? 'share' : 'spent';
            const grocery = /grocer/i.test(c.name);
            return (
              <div key={c.id} className="budget-cat">
                <div className="budget-row">
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                    <span className="dot8" style={{ background: c.color, flex: 'none' }} />
                    <SetField value={c.name} onCommit={setCat(c.id, 'name')} label="Category name" />
                  </span>
                  {c.pct !== null ? (<>
                    <span className="budget-calc">{money(c.e)}</span>
                    <span className="budget-calc">{money(c.j)}</span>
                  </>) : (<>
                    <SetField value={String(num(c.ella))} display={money(num(c.ella))} onCommit={setCat(c.id, 'ella')} label={'Ella, ' + c.name} numeric align="right" />
                    <SetField value={String(num(c.jackson))} display={money(num(c.jackson))} onCommit={setCat(c.id, 'jackson')} label={'Jackson, ' + c.name} numeric align="right" />
                  </>)}
                  <button className="link-btn" onClick={() => { if (confirmRemove('the “' + c.name + '” category')) update(x => { x.cats = x.cats.filter(z => z.id !== c.id); }); }}>Remove</button>
                </div>
                <div className="budget-mode">
                  <div className="seg" role="group" aria-label={'How ' + c.name + ' fills'}>
                    {MODES.filter(([m]) => m !== 'share' || !grocery).map(([m, l]) => (
                      <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(c, m)}>{l}</button>
                    ))}
                  </div>
                  {mode === 'share' && shares.length > 1 && (
                    <span className="note" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ width: 60 }}>
                        <SetField value={String(Math.round(c.pct! * 10) / 10)} display={Math.round(c.pct! * 10) / 10 + '%'} numeric align="right"
                          label={c.name + ' percentage of what’s left'} onCommit={v => { const n = parseFloat(v); if (!isNaN(n)) update(x => setShare(x.cats, c.id, n)); }} />
                      </span>
                      of what’s left
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <AddRow label="Add category" open={adding === 'category'} onOpen={() => setAdding('category')}>
          <div className="add-open-row">
            <input className="field-sm compact" style={{ flex: '1 1 140px' }} autoFocus value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCat(); }} placeholder="e.g. Internet" aria-label="Category name" />
            <input className="field-sm compact money" value={catTotal} onChange={e => setCatTotal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCat(); }} placeholder="$ total" inputMode="decimal" aria-label="Total per week" />
            <button className="pill-sm dark" onClick={addCat}>Add</button>
            <button className="link-btn" onClick={() => setAdding(null)}>Cancel</button>
          </div>
          <span className="note">Split 50/50 between you; change it after.</span>
        </AddRow>
        <p className="note" style={{ margin: '16px 0 0' }}>Tap anything underlined to change it. <strong>As spent</strong> fills as you log spends (groceries also from planned meals), <strong>Fixed</strong> is always full, and <strong>Share of left</strong> splits what’s left over.</p>
      </section>

      {/* Summary, laid out like the week page's budget card. */}
      <aside className="card" style={{ padding: 18 }}>
        <div className="card-title">Each week</div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Donut slices={b.slices} size={130} hole={20}>
            <span style={{ fontSize: 11 }} className="muted">Left</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{money(b.left)}</span>
          </Donut>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, flex: 1, minWidth: 150 }}>
            <div className="kv"><span className="muted">Income</span><span style={{ fontWeight: 600 }}>{money(b.income)}</span></div>
            <div className="kv"><span className="muted">Committed</span><span style={{ fontWeight: 600 }}>{money(b.spend)}</span></div>
            <div className="kv"><span style={{ color: '#A9477B' }}>Ella pays</span><span>{money(b.ella)}</span></div>
            <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson pays</span><span>{money(b.jackson)}</span></div>
            <div className="kv" style={{ borderTop: '1px solid #F0ECE4', paddingTop: 6 }}><span style={{ color: '#A9477B' }}>Ella has left</span><span style={{ fontWeight: 600 }}>{money(b.ellaLeft)}</span></div>
            <div className="kv"><span style={{ color: '#1B6B56' }}>Jackson has left</span><span style={{ fontWeight: 600 }}>{money(b.jacksonLeft)}</span></div>
          </div>
        </div>
        {b.splits && <p className="note" style={{ margin: '12px 0 0' }}>
          The {money(b.left)} left is shared between {listOf(shares.map(c => c.name))}. Each week follows what’s actually left.
        </p>}
      </aside>
    </div>
  );
}

const listOf = (names: string[]) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
