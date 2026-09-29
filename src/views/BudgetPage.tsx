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
  const ELLA = '#A9477B', JACKSON = '#1B6B56';

  return (
    <div className="budget-page">
      {/* 1. The overall position first: what's left, then income and what's committed. */}
      <section className="card budget-hero">
        <div className="hero-main">
          <span className="hero-label">Left each week</span>
          <span className="hero-big">{money(b.left)}</span>
          <span className="hero-people"><span style={{ color: ELLA }}>Ella {money(b.ellaLeft)}</span> · <span style={{ color: JACKSON }}>Jackson {money(b.jacksonLeft)}</span></span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Income</span>
          <span className="hero-mid">{money(b.income)}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Committed</span>
          <span className="hero-mid">{money(b.spend)}</span>
          <span className="hero-people"><span style={{ color: ELLA }}>Ella {money(b.ella)}</span> · <span style={{ color: JACKSON }}>Jackson {money(b.jackson)}</span></span>
        </div>
        <div className="hero-donut"><Donut slices={b.slices} size={96} hole={16} /></div>
      </section>

      {/* 2. Income: one row per source — who, name, amount. */}
      <section className="card" style={{ padding: 18 }}>
        <div className="card-title">Income <span className="sub">per week</span><span className="card-title-end">{money(b.income)}</span></div>
        <div className="list">
          {D.incomes.map(i => {
            const p = PEOPLE[i.person];
            return (
              <div key={i.id} className="income-line">
                <button className="person-tag" title="Tap to switch person" style={{ height: 'var(--h-xs)', background: p.tint, color: p.ink }}
                  onClick={() => update(x => { const z = x.incomes.find(z => z.id === i.id); if (z) z.person = otherPerson(z.person); })}>{p.name}</button>
                <SetField value={i.name} onCommit={setInc(i.id, 'name')} label="Income name" />
                <SetField value={String(num(i.amount))} display={money(num(i.amount))} onCommit={setInc(i.id, 'amount')} label={i.name + ' per week'} numeric align="right" strong />
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
      </section>

      {/* 3. Spending: one row per category — name, how it fills, each person's part, total. */}
      <section className="card" style={{ padding: 18 }}>
        <div className="card-title">Spending <span className="sub">per week</span><span className="card-title-end">{money(b.spend)}</span></div>
        <div className="cat-line cat-head">
          <span className="c-name">Category</span><span className="c-mode">Fills</span>
          <span className="c-ella" style={{ color: ELLA }}>Ella</span><span className="c-jack" style={{ color: JACKSON }}>Jackson</span>
          <span className="c-total">Total</span><span className="c-remove" />
        </div>
        <div className="list">
          {b.cats.map(c => {
            const mode: Mode = c.fixed ? 'fixed' : c.pct !== null ? 'share' : 'spent';
            const grocery = /grocer/i.test(c.name);
            return (
              <div key={c.id} className="cat-line">
                <span className="c-name">
                  <span className="dot8" style={{ background: c.color, flex: 'none' }} />
                  <SetField value={c.name} onCommit={setCat(c.id, 'name')} label="Category name" strong />
                </span>
                <span className="c-mode">
                  <select className="section-select" value={mode} aria-label={'How ' + c.name + ' fills'} onChange={e => setMode(c, e.target.value as Mode)}>
                    {MODES.filter(([m]) => m !== 'share' || !grocery).map(([m, l]) => <option key={m} value={m}>{l}</option>)}
                  </select>
                  {mode === 'share' && shares.length > 1 && (
                    <span style={{ width: 52, flex: 'none' }}>
                      <SetField value={String(Math.round(c.pct! * 10) / 10)} display={Math.round(c.pct! * 10) / 10 + '%'} numeric align="right"
                        label={c.name + ' percentage of what’s left'} onCommit={v => { const n = parseFloat(v); if (!isNaN(n)) update(x => setShare(x.cats, c.id, n)); }} />
                    </span>
                  )}
                </span>
                {c.pct !== null ? (<>
                  <span className="c-ella budget-calc" style={{ color: ELLA }}>{money(c.e)}</span>
                  <span className="c-jack budget-calc" style={{ color: JACKSON }}>{money(c.j)}</span>
                </>) : (<>
                  <span className="c-ella"><SetField value={String(num(c.ella))} display={money(num(c.ella))} onCommit={setCat(c.id, 'ella')} label={'Ella, ' + c.name} numeric align="right" color={ELLA} /></span>
                  <span className="c-jack"><SetField value={String(num(c.jackson))} display={money(num(c.jackson))} onCommit={setCat(c.id, 'jackson')} label={'Jackson, ' + c.name} numeric align="right" color={JACKSON} /></span>
                </>)}
                <span className="c-total">{money(c.total)}</span>
                <span className="c-remove"><button className="link-btn" onClick={() => { if (confirmRemove('the “' + c.name + '” category')) update(x => { x.cats = x.cats.filter(z => z.id !== c.id); }); }}>Remove</button></span>
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
        <p className="note" style={{ margin: '14px 0 0' }}>
          Tap anything underlined to change it. <strong>As spent</strong> fills as you log spends, <strong>Fixed</strong> is always full,
          and <strong>Share of left</strong> splits what’s left{shares.length ? ' (' + listOf(shares.map(c => c.name)) + ')' : ''}.
        </p>
      </section>
    </div>
  );
}

const listOf = (names: string[]) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
