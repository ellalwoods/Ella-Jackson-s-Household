import { useState } from 'react';
import { MON, parse } from '../lib/dates';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { HouseholdData, INCLUDE_LOW, money, NO_EXPIRY, norm, PantryItem, Price, STATE_COLORS, STATES, StockState, Unit, UNIT_LABEL, UNITS } from '../lib/model';
import { addToPantry, expiry, fmtQty, priceMap, setPrice } from '../lib/food';
import type { Update } from '../Household';

export const stockRule = (INCLUDE_LOW
  ? 'Low and Replace go on the shopping list; Full and Half don’t.'
  : 'Only Replace goes on the shopping list.') +
  ' Tracked amounts are used before buying more.';

export default function PantryPage({ D, update }: { D: HouseholdData; update: Update }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'All' | StockState | 'Expiring'>('All');
  const prices = priceMap(D);

  const cq = norm(q);
  const levelOf = (c: PantryItem) => (c.qty != null ? null : c.state);
  const expiring = (c: PantryItem) => { const e = expiry(c.expires); return !!e && (e.soon || e.expired); };
  const matches = (c: PantryItem, f: typeof filter) => f === 'All' || (f === 'Expiring' ? expiring(c) : levelOf(c) === f);
  const items = D.pantry
    .filter(c => (!cq || norm(c.name).includes(cq)) && matches(c, filter))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Items are keyed by name so edits still land correctly after a sync.
  const edit = (name: string, f: (c: PantryItem) => void) => update(x => { const c = x.pantry.find(c => c.name === name); if (c) f(c); });
  const remove = (name: string) => update(x => { x.pantry = x.pantry.filter(c => c.name !== name); });

  return (
    <>
      <AddToPantry D={D} update={update} />
      <div className="row8" style={{ marginBottom: 10 }}>
        <input className="search" style={{ flex: '1 1 260px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search the pantry" />
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        {(['All', ...STATES, 'Expiring'] as const).map(f => {
          const on = filter === f;
          const cnt = D.pantry.filter(c => matches(c, f)).length;
          return (
            <button key={f} className="filter" onClick={() => setFilter(f)}
              style={{ borderColor: on ? '#23221F' : '#DDD8CC', background: on ? '#23221F' : '#fff', color: on ? '#fff' : '#23221F' }}>{f} · {cnt}</button>
          );
        })}
      </div>
      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 10 }}>
        {items.map(c => {
          const n = D.recipes.filter(r => r.ingredients.some(g => norm(g.name) === norm(c.name))).length;
          const pr = prices.get(norm(c.name));
          return (
            <div key={c.name} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {c.name} <span style={{ fontWeight: 400, fontSize: 12 }} className="muted">{n ? '· in ' + n + ' recipe' + (n > 1 ? 's' : '') : ''}</span>
                </span>
                <span style={{ display: 'flex', gap: 12, flex: 'none' }}>
                  <button className="link-btn" onClick={() => edit(c.name, z => {
                    if (z.qty != null) { delete z.qty; delete z.unit; delete z.forWeek; z.state = 'Full'; }
                    else { z.qty = 0; z.unit = pr?.unit ?? 'g'; }
                  })}>{c.qty != null ? 'Track by level' : 'Track amount'}</button>
                  <button className="link-btn" onClick={() => remove(c.name)}>Remove</button>
                </span>
              </div>
              {c.qty != null ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="field-sm compact num" inputMode="decimal" value={String(c.qty)} aria-label="Amount left"
                    onChange={e => { const v = e.target.value; edit(c.name, z => { z.qty = parseFloat(v) || 0; }); }} />
                  <UnitSelect value={c.unit ?? 'g'} onChange={u => edit(c.name, z => { z.unit = u; })} compact />
                  <span style={{ fontSize: 12 }} className="muted">left</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                  {STATES.map(st => {
                    const on = c.state === st;
                    return (
                      <button key={st} className="state-btn" onClick={() => edit(c.name, z => { z.state = st; })}
                        style={{ background: on ? STATE_COLORS[st] : '#fff', borderColor: on ? STATE_COLORS[st] : '#DDD8CC' }}>{st}</button>
                    );
                  })}
                </div>
              )}
              {/* Use by and price: label, then the value (a box until it's set, then a soft pill). */}
              <div className="card-fields">
                <ExpiryInput label="Use by" compact value={c.expires ?? ''}
                  onChange={v => edit(c.name, z => { if (v) z.expires = v; else delete z.expires; })} />
                <PriceField key={String(pr?.price)} name={c.name} update={update} price={pr} />
                {(() => { const e = expiry(c.expires); return e && (e.soon || e.expired) ? <span className={'exp-chip ' + (e.expired ? 'expired' : 'soon')}>{e.label}</span> : null; })()}
              </div>
            </div>
          );
        })}
      </div>
      {!items.length && <p className="empty">Nothing here. Add what you have so the shopping list can skip it.</p>}
      <p className="note" style={{ marginTop: 14 }}>{stockRule} Expired items go back on the list.</p>
    </>
  );
}

export function UnitSelect({ value, onChange, compact = false }: { value: Unit; onChange: (u: Unit) => void; compact?: boolean }) {
  return (
    <select className={'field-sm unit' + (compact ? ' compact' : '')} value={value} onChange={e => onChange(e.target.value as Unit)} aria-label="Unit">
      {UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
    </select>
  );
}

/** Add something to the pantry by hand: a name and, optionally, how much and when it's used by. */
function AddToPantry({ D, update }: { D: HouseholdData; update: Update }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>('each');
  const [expires, setExpires] = useState('');
  const [price, setPrice_] = useState('');
  const existing = D.pantry.find(c => norm(c.name) === norm(name));
  const knownPrice = D.prices.find(p => norm(p.name) === norm(name));
  const known = Array.from(new Set([...D.prices.map(p => p.name), ...D.recipes.flatMap(r => r.ingredients.map(g => g.name))]))
    .filter(n => !D.pantry.some(c => norm(c.name) === norm(n))).sort();

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const q = parseFloat(qty), pr = parseFloat(price);
    update(x => {
      addToPantry(x, { name: n, ...(q > 0 ? { qty: q, unit } : {}), ...(expires ? { expires } : {}) });
      // The amount added is what you bought, so it doubles as the pack size for the price.
      if (!isNaN(pr)) setPrice(x, n, pr, q > 0 ? q : undefined, unit);
    });
    setName(''); setQty(''); setExpires(''); setPrice_('');
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') add(); };

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="shop-add" style={{ padding: 0 }}>
        <input className="field-sm compact" style={{ flex: '1 1 180px' }} list="pantry-known" value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
          placeholder="Add to pantry, e.g. Rice" aria-label="Item to add to pantry" />
        <datalist id="pantry-known">{known.map(k => <option key={k} value={k} />)}</datalist>
        <span className="ing-group">
          <span className="ing-label">Amount</span>
          <input className="field-sm compact num" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} onKeyDown={onKey} placeholder="qty" aria-label="Amount" />
          <UnitSelect value={unit} onChange={setUnit} compact />
        </span>
        <span className="ing-group">
          <span className="ing-label">Price $</span>
          <input className="field-sm compact num" inputMode="decimal" value={price} onChange={e => setPrice_(e.target.value)} onKeyDown={onKey}
            placeholder={knownPrice ? knownPrice.price.toFixed(2) : '0.00'} aria-label="Price" />
        </span>
        <span className="ing-group"><ExpiryInput label="Use by" compact value={expires} onChange={setExpires} /></span>
        <button className="pill-sm dark" style={{ padding: '0 16px' }} onClick={add}>Add</button>
      </div>
      <span className="note">
        {existing ? existing.name + ' is already here — an amount adds to it.' : 'Only the name is needed. Price is for the amount given.'}
      </span>
    </div>
  );
}

/**
 * A use-by date box with an "N/A" button for things that don't expire.
 * The value is a date key, NO_EXPIRY, or '' for not set.
 */
export function ExpiryInput({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const none = value === NO_EXPIRY, dated = !!value && !none;
  // The date box, its N/A button and the set-date pill all share one height.
  const h = compact ? 'var(--h-sm)' : 'var(--h-md)';
  const d = dated ? parse(value) : null;

  // A chosen date (or N/A) shows as a filled pill; tap it to change, × to clear.
  if ((dated && !editing) || none) {
    return (
      <span className="expiry-input">
        <span className="ing-label">{label}</span>
        <span className="date-pill" style={{ height: h }}>
          <button className="date-pill-main" onClick={() => { if (dated) setEditing(true); }} disabled={none}
            title={dated ? 'Change date' : undefined} aria-label={dated ? label + ' ' + value + ', change' : 'No expiry'}>
            {none ? 'No expiry' : DAYS[d!.getDay()] + ' ' + d!.getDate() + ' ' + MON[d!.getMonth()]}
          </button>
          <button className="date-pill-x" aria-label={'Clear ' + label.toLowerCase()} onClick={() => onChange('')}>×</button>
        </span>
      </span>
    );
  }
  return (
    <span className="expiry-input">
      <span className="ing-label">{label}</span>
      <input type="date" className={'field-sm' + (compact ? ' compact' : '')} style={{ fontSize: 13 }} value={value} autoFocus={editing} aria-label={label}
        onChange={e => { onChange(e.target.value); if (e.target.value) setEditing(false); }} onBlur={() => setEditing(false)} />
      <button className="filter" aria-pressed={false} title="Doesn’t expire" onClick={() => { setEditing(false); onChange(NO_EXPIRY); }}
        style={{ height: h, fontSize: 12, padding: '0 12px', borderColor: '#DDD8CC', background: '#fff', color: '#23221F' }}>N/A</button>
    </span>
  );
}

/**
 * A pantry item's purchase price, shared with recipes and the shopping list.
 * Once set it shows as a soft chip (like the use-by date); tap it to change.
 */
function PriceField({ name, update, price }: { name: string; update: Update; price: Price | undefined }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(price ? String(price.price) : '');
  const pack = price && price.qty && !(price.qty === 1 && price.unit === 'each') ? fmtQty(price.qty, price.unit) : '';
  const save = () => {
    const v = parseFloat(text);
    if (!isNaN(v) && v !== price?.price) update(x => setPrice(x, name, v));
    if (isNaN(v)) setText(price ? String(price.price) : '');
    setEditing(false);
  };
  if (price && !editing) {
    return (
      <span className="expiry-input">
        <span className="ing-label">Price</span>
        <span className="set-pill">
          <button className="set-pill-main" onClick={() => { setText(String(price.price)); setEditing(true); }} title="Change price" aria-label={'Price of ' + name + ', change'}>
            <strong>{money(price.price)}</strong>{pack && <span>/ {pack}</span>}
          </button>
        </span>
      </span>
    );
  }
  return (
    <span className="expiry-input">
      <span className="ing-label">Price</span>
      <input className="field-sm compact num" inputMode="decimal" value={text} placeholder="$0.00" autoFocus={editing}
        aria-label={'Price of ' + name} onChange={e => setText(e.target.value)} onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(price ? String(price.price) : ''); setEditing(false); } }} />
    </span>
  );
}
