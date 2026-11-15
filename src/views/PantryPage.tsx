import { useState } from 'react';
import { MON, parse } from '../lib/dates';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { HouseholdData, INCLUDE_LOW, money, NO_EXPIRY, norm, PantryItem, Price, STATE_COLORS, STATES, StockState, Unit, UNIT_LABEL, UNITS } from '../lib/model';
import { addToPantry, expiry, fmtQty, priceMap, setPrice } from '../lib/food';
import { SetField } from './SetField';
import Sheet from './Sheet';
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

  const [adding, setAdding] = useState(false);
  const [openName, setOpenName] = useState<string | null>(null);
  const stateLine = (c: PantryItem) => (c.qty != null ? fmtQty(c.qty, c.unit ?? 'g') + ' left' : c.state);

  return (
    <div className="list-page">
      <div className="list-tools">
        <input className="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search the pantry" aria-label="Search the pantry" />
        <button className="pill dark" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      <div className="filter-rows">
        <div className="filter-row">
          <span className="filter-label">Show</span>
          <div className="seg" role="group" aria-label="Filter by stock level">
            {(['All', ...STATES, 'Expiring'] as const).map(f => {
              const on = filter === f;
              const cnt = D.pantry.filter(c => matches(c, f)).length;
              return <button key={f} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setFilter(f)}>{f} <span className="seg-count">{cnt}</span></button>;
            })}
          </div>
        </div>
      </div>

      {/* One row per item; tap it for the level, amount, use-by date and price. */}
      <div className="item-list">
        {items.map(c => {
          const n = D.recipes.filter(r => r.ingredients.some(g => norm(g.name) === norm(c.name))).length;
          const pr = prices.get(norm(c.name));
          const e = expiry(c.expires);
          const on = openName === c.name;
          const sub = [n ? 'In ' + n + ' recipe' + (n > 1 ? 's' : '') : '', pr ? money(pr.price) : ''].filter(Boolean).join(' · ');
          return (
            <div key={c.name} className={'item-block' + (on ? ' open' : '')}>
              <button className="item-row" onClick={() => setOpenName(on ? null : c.name)} aria-expanded={on}>
                <span className="item-main">
                  <span className="item-name">{c.name}</span>
                  {(sub || (e && (e.soon || e.expired))) && (
                    <span className="item-sub">{sub}{e && (e.soon || e.expired) && <span className={'exp-chip ' + (e.expired ? 'expired' : 'soon')} style={{ marginLeft: sub ? 6 : 0 }}>{e.label}</span>}</span>
                  )}
                </span>
                <span className="state-tag">
                  {c.qty == null && <span className="dot8" style={{ background: STATE_COLORS[c.state] }} />}{stateLine(c)}
                </span>
              </button>
              {on && (
                <div className="item-more">
                  {c.qty != null ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ width: 'var(--w-num)' }}>
                        <SetField value={String(c.qty)} numeric align="right" label={'Amount of ' + c.name + ' left'}
                          onCommit={v => edit(c.name, z => { z.qty = parseFloat(v) || 0; })} />
                      </span>
                      <UnitSelect value={c.unit ?? 'g'} onChange={u => edit(c.name, z => { z.unit = u; })} compact />
                      <span style={{ fontSize: 12 }} className="muted">left</span>
                    </div>
                  ) : (
                    <div className="seg" role="group" aria-label={'How much ' + c.name + ' is left'}>
                      {STATES.map(st => (
                        <button key={st} className={c.state === st ? 'on' : ''} aria-pressed={c.state === st} onClick={() => edit(c.name, z => { z.state = st; })}>{st}</button>
                      ))}
                    </div>
                  )}
                  <div className="card-fields">
                    <ExpiryInput label="Use by" compact value={c.expires ?? ''}
                      onChange={v => edit(c.name, z => { if (v) z.expires = v; else delete z.expires; })} />
                    <PriceField key={String(pr?.price)} name={c.name} update={update} price={pr} />
                  </div>
                  <div className="row" style={{ gap: 14 }}>
                    <button className="link-btn" onClick={() => edit(c.name, z => {
                      if (z.qty != null) { delete z.qty; delete z.unit; delete z.forWeek; z.state = 'Full'; }
                      else { z.qty = 0; z.unit = pr?.unit ?? 'g'; }
                    })}>{c.qty != null ? 'Track by level instead' : 'Track an amount instead'}</button>
                    <button className="link-btn" onClick={() => remove(c.name)}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!items.length && <p className="empty">{q || filter !== 'All' ? 'Nothing matches.' : 'Nothing here yet. Add what you have so the shopping list can skip it.'}</p>}
      <p className="note" style={{ marginTop: 14 }}>{stockRule} Expired items go back on the list.</p>
      {adding && <Sheet title="Add to the pantry" onClose={() => setAdding(false)}><AddToPantry D={D} update={update} /></Sheet>}
    </div>
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
    <div className="sheet-form">
      <div className="shop-add" style={{ padding: 0 }}>
        <input className="field-sm compact" style={{ flex: '1 1 100%' }} autoFocus list="pantry-known" value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
          placeholder="Item, e.g. Rice" aria-label="Item to add to pantry" />
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
        style={{ height: h, fontSize: 12, padding: '0 12px', borderColor: 'var(--border)', background: '#fff', color: 'var(--ink)' }}>N/A</button>
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
