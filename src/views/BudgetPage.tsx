import { useState } from 'react';
import { budget, Category, HouseholdData, Income, isShare, money, otherPerson, PEOPLE, PersonId, setShare, toggleShare, uid } from '../lib/model';
import type { Update } from '../Household';
import { Donut } from './BudgetCard';

export default function BudgetPage({ D, update }: { D: HouseholdData; update: Update }) {
  const b = budget(D);
  const [incName, setIncName] = useState('');
  const [incAmt, setIncAmt] = useState('');
  const [incPerson, setIncPerson] = useState<PersonId>('ella');
  const [catName, setCatName] = useState('');
  const [catTotal, setCatTotal] = useState('');

  const setCat = (id: string, f: 'name' | 'ella' | 'jackson') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    update(x => { const c = x.cats.find(c => c.id === id); if (c) (c as Category)[f] = val; });
  };
  const setInc = (id: string, f: 'name' | 'amount') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    update(x => { const z = x.incomes.find(z => z.id === id); if (z) (z as Income)[f] = val; });
  };
  const addIncome = () => {
    const n = incName.trim();
    if (!n) return;
    const inc: Income = { id: uid(), name: n, person: incPerson, amount: parseFloat(incAmt) || 0 };
    update(x => { x.incomes.push(inc); });
    setIncName(''); setIncAmt('');
  };
  const addCat = () => {
    const n = catName.trim();
    if (!n) return;
    const half = Math.round((parseFloat(catTotal) || 0) * 50) / 100;
    const cat: Category = { id: uid(), name: n, ella: half, jackson: half };
    update(x => { x.cats.push(cat); });
    setCatName(''); setCatTotal('');
  };
  const draftP = PEOPLE[incPerson];

  return (
    <div className="flow">
      <section className="card" style={{ flex: '2 1 460px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span className="eyebrow">Income sources · per week</span><span style={{ fontSize: 14, fontWeight: 600 }}>{money(b.income)}</span>
        </div>
        {D.incomes.map(i => {
          const p = PEOPLE[i.person];
          return (
            <div key={i.id} className="income-grid" style={{ marginBottom: 6 }}>
              <button className="person-tag" title="Switch person" style={{ height: 36, background: p.tint, color: p.ink }}
                onClick={() => update(x => { const z = x.incomes.find(z => z.id === i.id); if (z) z.person = otherPerson(z.person); })}>{p.name}</button>
              <input className="field-sm" value={i.name} onChange={setInc(i.id, 'name')} />
              <input className="field-sm" value={String(i.amount)} onChange={setInc(i.id, 'amount')} inputMode="decimal" />
              <button className="x-btn" aria-label="Remove" onClick={() => update(x => { x.incomes = x.incomes.filter(z => z.id !== i.id); })}>×</button>
            </div>
          );
        })}
        {!D.incomes.length && <p style={{ fontSize: 13, margin: '0 0 8px' }} className="muted">No income logged yet.</p>}
        <div className="income-grid" style={{ gridTemplateColumns: '84px minmax(0,1.4fr) minmax(0,1fr) auto', paddingTop: 10, margin: '4px 0 22px', borderTop: '1px dashed #DDD8CC' }}>
          <button className="person-tag" title="Switch person" style={{ height: 36, background: draftP.tint, color: draftP.ink }}
            onClick={() => setIncPerson(otherPerson(incPerson))}>{draftP.name}</button>
          <input className="field-sm" value={incName} onChange={e => setIncName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIncome(); }} placeholder="e.g. Salary, freelance" />
          <input className="field-sm" value={incAmt} onChange={e => setIncAmt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addIncome(); }} placeholder="$ / week" inputMode="decimal" />
          <button className="pill dark" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={addIncome}>Add</button>
        </div>

        <div className="budget-grid eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>
          <span>Category</span><span style={{ color: '#A9477B' }}>Ella $</span><span style={{ color: '#1B6B56' }}>Jackson $</span><span />
        </div>
        {b.cats.map(c => (
          <div key={c.id} className="budget-grid" style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              <span className="dot8" style={{ background: c.color, flex: 'none' }} />
              <input className="field-sm" style={{ width: '100%' }} value={c.name} onChange={setCat(c.id, 'name')} />
            </div>
            {c.pct !== null ? (
              <div className="share-cell">
                {b.cats.filter(z => z.pct !== null).length > 1
                  ? <ShareInput pct={c.pct} name={c.name} onChange={v => update(x => setShare(x.cats, c.id, v))} />
                  : <span style={{ fontSize: 13, fontWeight: 600 }}>100%</span>}
                <span className="note" style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#A9477B' }}>{money(c.e)}</span> · <span style={{ color: '#1B6B56' }}>{money(c.j)}</span>
                </span>
              </div>
            ) : <>
              <input className="field-sm" value={String(c.ella)} onChange={setCat(c.id, 'ella')} inputMode="decimal" />
              <input className="field-sm" value={String(c.jackson)} onChange={setCat(c.id, 'jackson')} inputMode="decimal" />
            </>}
            <button className="x-btn" aria-label="Remove" onClick={() => update(x => { x.cats = x.cats.filter(z => z.id !== c.id); })}>×</button>
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
              <span className="note">{c.fixed ? 'Always spent in full, like rent.'
                : c.pct !== null ? 'Gets ' + Math.round(c.pct) + '% of what’s left after everything else. Change one % and the others shift to fit.'
                : /grocer/i.test(c.name) ? 'Fills up from your planned meals and anything you log.' : 'Fills up as you log spends on the week page.'}</span>
            </div>
          </div>
        ))}
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
            shared between {listOf(b.cats.filter(c => c.pct !== null).map(c => c.name))}. Budgets count in full even before they’re spent.
            On the week page it follows what’s actually left that week (less if something goes over budget).
          </span>}
        </div>
      </section>
      <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>Add category</div>
          <div style={{ fontSize: 13 }} className="muted">Split 50/50 — adjust after.</div>
          <input className="field" value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Internet" />
          <input className="field" value={catTotal} onChange={e => setCatTotal(e.target.value)} placeholder="Total $ per week" inputMode="decimal" />
          <button className="pill dark" style={{ height: 42 }} onClick={addCat}>Add category</button>
        </div>
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
  height: 26, fontSize: 12, borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F',
});

const listOf = (names: string[]) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);

/** A category's % of what's left. Shows the saved value unless you're typing in it. */
function ShareInput({ pct, name, onChange }: { pct: number; name: string; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = String(Math.round(pct * 10) / 10);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input className="field-sm" style={{ width: 58 }} inputMode="decimal" aria-label={name + ' percentage of what’s left'}
        value={draft ?? shown} onFocus={() => setDraft(shown)} onBlur={() => setDraft(null)}
        onChange={e => { setDraft(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }} />
      <span style={{ fontSize: 13 }}>%</span>
    </span>
  );
}
