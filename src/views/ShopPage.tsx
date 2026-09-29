import { useEffect, useState } from 'react';
import { addDays, key } from '../lib/dates';
import { ManualShopItem, money, norm, SHOP_SECTION_LABEL, SHOP_SECTIONS, ShopSection, Unit, uid } from '../lib/model';
import { buyText, fmtAmount, guessSection, ShopItem, shoppingText, Skipped, stockUp } from '../lib/food';
import type { Update } from '../Household';
import { ExpiryInput, stockRule, UnitSelect } from './PantryPage';

const TICKS_KEY = 'hh-shop-ticks';

const EXPIRY_KEY = 'hh-shop-expiry';
const VIEW_KEY = 'hh-shop-view';

type SortBy = 'type' | 'day' | 'az';
const SORTS: [SortBy, string][] = [['type', 'By type'], ['day', 'By day'], ['az', 'A–Z']];

/** Ticks and expiry dates are per device (whoever is at the shops), remembered across reloads. */
function useStored<T>(storageKey: string) {
  const [v, setV] = useState<Record<string, T>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* blocked */ } }, [storageKey, v]);
  return [v, setV] as const;
}

interface Props { update: Update; mon: Date; label: string; items: ShopItem[]; skipped: Skipped[]; pending?: string[] }

export default function ShopPage({ update, mon, label, items, skipped, pending = [] }: Props) {
  const [ticks, setTicks] = useStored<boolean>(TICKS_KEY);
  const [dates, setDates] = useStored<string>(EXPIRY_KEY);
  const [view, setView] = useStored<string>(VIEW_KEY);
  const sortBy = (view.sort as SortBy) || 'type';
  const only = (view.only as ShopSection | 'all') || 'all';
  const [copied, setCopied] = useState(false);
  const wk = key(mon);
  const tick = (i: ShopItem) => wk + '|' + i.id;
  const isTicked = (i: ShopItem) => !!ticks[tick(i)];
  const total = items.reduce((a, i) => a + (i.cost ?? 0), 0);
  const text = () => shoppingText(label + ' ' + addDays(mon, 6).getFullYear(), items, skipped);

  const copy = () => {
    const txt = text();
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove(); setCopied(true);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => setCopied(true), fallback); else fallback();
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<pre style="font:16px/1.7 Figtree,system-ui,sans-serif;padding:32px;white-space:pre-wrap">' + text().replace(/</g, '&lt;') + '</pre>');
    w.document.close(); w.focus(); w.print();
  };
  const stockTicked = () => {
    const got = items.filter(isTicked);
    const exp: Record<string, string> = {};
    got.forEach(i => { const d = dates[tick(i)]; if (d) exp[i.id] = d; });
    update(x => stockUp(x, got, wk, exp));
    setDates(ds => { const n = { ...ds }; got.forEach(i => delete n[tick(i)]); return n; });
    // Hand-added items leave the list once they're in the pantry.
    setTicks(t => { const n = { ...t }; got.filter(i => i.manual).forEach(i => delete n[tick(i)]); return n; });
  };
  const removeManual = (id: string) => update(x => {
    const left = (x.shopExtras[wk] ?? []).filter(m => m.id !== id);
    if (left.length) x.shopExtras[wk] = left; else delete x.shopExtras[wk];
  });
  const addManual = (m: ManualShopItem, section: ShopSection) => update(x => {
    x.shopExtras[wk] = [...(x.shopExtras[wk] ?? []), m];
    x.shopSections[norm(m.name)] = section;
  });
  const setSection = (i: ShopItem, section: ShopSection) => update(x => { x.shopSections[i.lk] = section; });
  // Type filter, then either grouped by type or one list in day or A–Z order.
  const shown = items.filter(i => only === 'all' || i.section === only);
  const groups: { sec: ShopSection | null; list: ShopItem[] }[] = sortBy === 'type'
    ? SHOP_SECTIONS.map(sec => ({ sec, list: shown.filter(i => i.section === sec) })).filter(g => g.list.length)
    : [{ sec: null, list: sortBy === 'az' ? shown.slice().sort((a, b) => a.name.localeCompare(b.name)) : shown }];

  return (
    <div className="two-col">
      <div>
      <AddItem onAdd={addManual} />
      <section className="card" style={{ padding: 18 }}>
        <div className="card-title">To buy <span className="sub">{items.length} item{items.length === 1 ? '' : 's'}</span>
          <span className="card-title-end row8">
            <button className="pill-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
            <button className="pill-sm" onClick={print}>Print</button>
          </span>
        </div>
        {pending.length > 0 && (
          <div className="pending-picks">
            <strong>Still to pick from buckets</strong> — tap the meal on the week page to choose:
            <ul>{pending.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {items.length > 0 && (
          <div className="filter-rows">
            <div className="filter-row">
              <span className="filter-label">Sort</span>
              <div className="seg" role="group" aria-label="Sort">
                {SORTS.map(([k, l]) => (
                  <button key={k} aria-pressed={sortBy === k} className={sortBy === k ? 'on' : ''} onClick={() => setView(v => ({ ...v, sort: k }))}>{l}</button>
                ))}
              </div>
            </div>
            <div className="filter-row">
              <span className="filter-label">Show</span>
              <div className="seg" role="group" aria-label="Show section">
                {(['all', ...SHOP_SECTIONS] as const).map(f => {
                  const on = only === f, n = f === 'all' ? items.length : items.filter(i => i.section === f).length;
                  if (f !== 'all' && !n) return null;
                  return (
                    <button key={f} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setView(v => ({ ...v, only: f }))}>
                      {f === 'all' ? 'All' : SHOP_SECTION_LABEL[f]} <span className="seg-count">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {groups.map(({ sec, list }) => (
          <div key={sec ?? 'all'} className="shop-group">
            {sec && (
              <div className="shop-group-head">
                <span>{SHOP_SECTION_LABEL[sec]}</span>
                <span className="muted">{list.length}</span>
              </div>
            )}
            {list.map(i => {
              const ck = isTicked(i);
              return (
                <div key={i.id} className="shop-row">
                  <button className="shop-item" style={{ opacity: ck ? 0.55 : 1 }}
                    onClick={() => setTicks(t => ({ ...t, [tick(i)]: !t[tick(i)] }))}>
                    <span className="box-check" style={{ background: ck ? '#23221F' : 'transparent' }}>{ck ? '✓' : ''}</span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }}>
                      <span style={{ fontSize: 15, textDecoration: ck ? 'line-through' : 'none' }}>{i.name}</span>
                      <span style={{ fontSize: 12 }} className="muted">
                        {i.manual ? 'Added by you' : 'For ' + i.days.join(', ')}{i.staple ? ' · staple' : ''}{i.need ? ' · uses ' + fmtAmount(i.need) : ''}{i.buy ? ' · buy ' + buyText(i) : ''}{i.status !== 'Not stocked' && <span className="phone-inline"> · {i.status}</span>}
                      </span>
                    </span>
                  </button>
                  <span className="shop-side">
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="chip wide-inline" style={{ fontSize: 11, padding: '3px 8px' }}>{i.status}</span>
                      {i.cost !== null && <span style={{ fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{money(i.cost)}</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select className="section-select" value={i.section} onChange={e => setSection(i, e.target.value as ShopSection)} aria-label={'Section for ' + i.name}>
                        {SHOP_SECTIONS.map(x => <option key={x} value={x}>{SHOP_SECTION_LABEL[x]}</option>)}
                      </select>
                      {i.manual && <button className="link-btn" style={{ fontSize: 12 }} aria-label={'Remove ' + i.name} onClick={() => removeManual(i.manual!)}>Remove</button>}
                    </span>
                  </span>
                  {ck && (
                    <div className="shop-expiry">
                      <ExpiryInput label="Use by" compact value={dates[tick(i)] ?? ''} onChange={v => setDates(ds => ({ ...ds, [tick(i)]: v }))} />
                      {!dates[tick(i)] && <span className="note">optional</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, padding: '12px 0 0', borderTop: '1px solid #23221F' }}>
            <span>Estimated total</span><span>{money(total)}</span>
          </div>
        )}
        {items.length > 0 && !shown.length && <p className="empty" style={{ padding: '12px 0', margin: 0 }}>Nothing in this section.</p>}
        {!items.length && <p className="empty" style={{ padding: '16px 0', margin: 0 }}>Nothing to buy — plan some meals, add an item above, or everything's already in the pantry.</p>}
        {items.some(isTicked) && (
          <button className="pill dark" style={{ marginTop: 12 }} onClick={stockTicked}>Add ticked items to pantry</button>
        )}
      </section>
      </div>
      <aside className="card" style={{ padding: 18 }}>
        <div className="card-title">Already in the pantry <span className="sub">skipped</span></div>
        <div className="row">
          {skipped.map(s => <span key={s.name} className="chip">{s.name} · {s.note}</span>)}
        </div>
        {!skipped.length && <p style={{ fontSize: 13, margin: 0 }} className="muted">Nothing skipped this week.</p>}
        <p className="note" style={{ margin: '14px 0 0' }}>{stockRule}</p>
      </aside>
    </div>
  );
}

/** Add something that isn't part of a recipe: a name, and optionally how much and what it costs. */
function AddItem({ onAdd }: { onAdd: (m: ManualShopItem, section: ShopSection) => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit>('each');
  const [price, setPrice] = useState('');
  /** Picked by hand; otherwise follows a guess from the name. */
  const [picked, setPicked] = useState<ShopSection | null>(null);
  const section = picked ?? guessSection(name);
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const m: ManualShopItem = { id: uid(), name: n };
    const q = parseFloat(qty), pr = parseFloat(price);
    if (q > 0) { m.qty = q; m.unit = unit; }
    if (!isNaN(pr)) m.price = pr;
    onAdd(m, section);
    setName(''); setQty(''); setPrice(''); setPicked(null);
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') add(); };
  return (
    <div className="add-panel">
    <div className="add-panel-title">+ Add to the list</div>
    <div className="shop-add" style={{ padding: 0 }}>
      <input className="field-sm compact" style={{ flex: '1 1 160px' }} value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
        placeholder="Item, e.g. Milk" aria-label="Item to add" />
      <span className="ing-group">
        <span className="ing-label">Amount</span>
        <input className="field-sm compact num" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} onKeyDown={onKey} placeholder="qty" aria-label="Amount" />
        <UnitSelect value={unit} onChange={setUnit} compact />
      </span>
      <span className="ing-group">
        <span className="ing-label">Price $</span>
        <input className="field-sm compact num" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} onKeyDown={onKey} placeholder="0.00" aria-label="Price" />
      </span>
      <span className="ing-group">
        <span className="ing-label phone-only">Section</span>
        <select className="field-sm compact" style={{ width: 104 }} value={section} onChange={e => setPicked(e.target.value as ShopSection)} aria-label="Section">
          {SHOP_SECTIONS.map(x => <option key={x} value={x}>{SHOP_SECTION_LABEL[x]}</option>)}
        </select>
      </span>
      <button className="pill-sm dark" style={{ padding: '0 16px' }} onClick={add}>Add</button>
    </div>
    </div>
  );
}
