import { useEffect, useRef, useState } from 'react';
import { addDays, key, parse } from '../lib/dates';
import { ManualShopItem, money, norm, SHOP_SECTION_LABEL, SHOP_SECTIONS, ShopSection, Unit, uid } from '../lib/model';
import { buyText, shortWeek, guessSection, ShopItem, shoppingText, Skipped, stockUp } from '../lib/food';
import type { Update } from '../Household';
import { ExpiryInput, stockRule, UnitSelect } from './PantryPage';
import Sheet from './Sheet';

const TICKS_KEY = 'hh-shop-ticks';

const EXPIRY_KEY = 'hh-shop-expiry';
const VIEW_KEY = 'hh-shop-view';

type SortBy = 'type' | 'day' | 'az';
/** A ticked item stays put this long, then fades for FADE_MS and moves down to "Bought". */
const HOLD_MS = 5000, FADE_MS = 1200;
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
  const [adding, setAdding] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showBought, setShowBought] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const wk = key(mon);
  // Hand-added and carried-over items keep their tick whichever week you're looking at.
  const tick = (i: ShopItem) => (i.manual || i.carried ? i.id : wk + '|' + i.id);
  const isTicked = (i: ShopItem) => !!ticks[tick(i)];
  // Items just ticked on this screen: they stay in place, fade, then join the bought list.
  const [fresh, setFresh] = useState<Record<string, 'hold' | 'fade'>>({});
  const timers = useRef<Record<string, number[]>>({});
  const stopTimers = (k: string) => { (timers.current[k] ?? []).forEach(clearTimeout); delete timers.current[k]; };
  const startTimers = (k: string) => {
    stopTimers(k);
    setFresh(f => ({ ...f, [k]: 'hold' }));
    timers.current[k] = [
      window.setTimeout(() => setFresh(f => (f[k] ? { ...f, [k]: 'fade' } : f)), HOLD_MS),
      window.setTimeout(() => { delete timers.current[k]; setFresh(f => { const n = { ...f }; delete n[k]; return n; }); }, HOLD_MS + FADE_MS),
    ];
  };
  useEffect(() => () => Object.values(timers.current).flat().forEach(clearTimeout), []);
  const toggle = (i: ShopItem) => {
    const k = tick(i), on = !ticks[k];
    setTicks(t => ({ ...t, [k]: on }));
    if (on) startTimers(k);
    else { stopTimers(k); setFresh(f => { const n = { ...f }; delete n[k]; return n; }); }
  };
  // While someone is typing a use-by date into a just-ticked row, hold it still.
  const pause = (k: string) => { if (fresh[k]) { stopTimers(k); setFresh(f => ({ ...f, [k]: 'hold' })); } };
  const resume = (k: string) => { if (fresh[k]) startTimers(k); };
  const bought = items.filter(i => isTicked(i) && !fresh[tick(i)]);
  const toBuy = items.filter(i => !isTicked(i));
  const total = toBuy.reduce((a, i) => a + (i.cost ?? 0), 0);
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
    w.document.write('<pre style="font:16px/1.7 Hanken Grotesk,system-ui,sans-serif;padding:32px;white-space:pre-wrap">' + text().replace(/</g, '&lt;') + '</pre>');
    w.document.close(); w.focus(); w.print();
  };
  const stockTicked = () => {
    const got = items.filter(isTicked);
    const exp: Record<string, string> = {};
    got.forEach(i => { const d = dates[tick(i)]; if (d) exp[i.id] = d; });
    update(x => stockUp(x, got, wk, exp));
    setDates(ds => { const n = { ...ds }; got.forEach(i => delete n[tick(i)]); return n; });
    // Hand-added and carried-over items leave the list once they're in the pantry.
    setTicks(t => { const n = { ...t }; got.filter(i => i.manual || i.carried).forEach(i => delete n[tick(i)]); return n; });
  };
  const removeManual = (id: string) => update(x => {
    for (const w of Object.keys(x.shopExtras)) {
      const left = x.shopExtras[w].filter(m => m.id !== id);
      if (left.length) x.shopExtras[w] = left; else delete x.shopExtras[w];
    }
  });
  const dropCarried = (i: ShopItem) => update(x => { x.shopCleared[i.carried + '|' + i.lk] = 1; });
  const addManual = (m: ManualShopItem, section: ShopSection) => update(x => {
    x.shopExtras[wk] = [...(x.shopExtras[wk] ?? []), m];
    x.shopSections[norm(m.name)] = section;
  });
  const setSection = (i: ShopItem, section: ShopSection) => update(x => { x.shopSections[i.lk] = section; });
  // Type filter, then either grouped by type or one list in day or A–Z order.
  const shown = items.filter(i => (only === 'all' || i.section === only) && (!isTicked(i) || fresh[tick(i)]));
  const groups: { sec: ShopSection | null; list: ShopItem[] }[] = sortBy === 'type'
    ? SHOP_SECTIONS.map(sec => ({ sec, list: shown.filter(i => i.section === sec) })).filter(g => g.list.length)
    : [{ sec: null, list: sortBy === 'az' ? shown.slice().sort((a, b) => a.name.localeCompare(b.name)) : shown }];

  /** One item: tick box, name and detail, cost and actions; once ticked, an optional use-by date. */
  const line = (i: ShopItem, inBought = false) => {
    const k = tick(i), ck = isTicked(i);
    const why = i.manual ? 'Added by you' : i.carried ? 'From the ' + shortWeek(parse(i.carried)) : i.days.length ? 'For ' + i.days.join(', ') : '';
    const detail = [why, i.staple ? 'staple' : '', i.buy ? 'buy ' + buyText(i) : '', i.status !== 'Not stocked' && !i.manual && !i.carried ? i.status.toLowerCase() : ''].filter(Boolean).join(' · ');
    return (
      <div key={i.id} className={'shop-line' + (ck ? ' done' : '') + (fresh[k] === 'fade' ? ' fading' : '')}
        onFocus={inBought ? undefined : () => pause(k)} onBlur={inBought ? undefined : e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) resume(k); }}>
        <button className="shop-tick" onClick={() => toggle(i)} aria-pressed={ck} title={inBought ? 'Put back on the list' : undefined}>
          <span className="box-check" style={{ background: ck ? 'var(--ink)' : 'transparent' }}>{ck ? '✓' : ''}</span>
          <span className="item-main">
            <span className="shop-name">{i.name}</span>
            {detail && <span className="item-sub">{detail}</span>}
          </span>
        </button>
        <span className="shop-end">
          {i.cost !== null && <span className="shop-cost">{money(i.cost)}</span>}
          {!inBought && i.manual && <button className="link-btn small" aria-label={'Remove ' + i.name} onClick={() => removeManual(i.manual!)}>Remove</button>}
          {!inBought && i.carried && <button className="link-btn small" aria-label={'Not needed: ' + i.name} title="Take it off the list" onClick={() => dropCarried(i)}>Not needed</button>}
          {sorting && !inBought && (
            <select className="section-select" value={i.section} onChange={e => setSection(i, e.target.value as ShopSection)} aria-label={'Section for ' + i.name}>
              {SHOP_SECTIONS.map(x => <option key={x} value={x}>{SHOP_SECTION_LABEL[x]}</option>)}
            </select>
          )}
        </span>
        {ck && (
          <div className="shop-expiry">
            <ExpiryInput label="Use by" compact value={dates[k] ?? ''} onChange={v => setDates(ds => ({ ...ds, [k]: v }))} />
            {!dates[k] && <span className="note">optional</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="list-page shop-page">
      {/* The list first: a summary line with the few actions, then the items. */}
      <div className="shop-summary">
        <span><b>{toBuy.length}</b> to buy{total > 0 && <> · about <b>{money(total)}</b></>}</span>
        <span className="row" style={{ gap: 14, alignItems: 'center' }}>
          <button className="link-btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          <button className="link-btn" onClick={print}>Print</button>
          <button className="pill dark" onClick={() => setAdding(true)}>+ Add</button>
        </span>
      </div>
      {pending.length > 0 && (
        <div className="pending-picks">
          <strong>Still to pick from buckets</strong>. Tap the meal on the week plan to choose:
          <ul>{pending.map(p => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {/* One row: how to sort, and a Filters button for which sections to show. */}
      {items.length > 0 && (
        <div className="list-filterbar">
          <div className="seg" role="group" aria-label="Sort">
            {SORTS.map(([k, l]) => (
              <button key={k} aria-pressed={sortBy === k} className={sortBy === k ? 'on' : ''} onClick={() => setView(v => ({ ...v, sort: k }))}>{l}</button>
            ))}
          </div>
          {new Set(items.map(i => i.section)).size > 1 && (
            <button className={'pill-sm' + (only !== 'all' ? ' dark' : '')} onClick={() => setFiltering(true)}>
              Filters{only !== 'all' ? ' · ' + SHOP_SECTION_LABEL[only] : ''}
            </button>
          )}
        </div>
      )}
      {filtering && (
        <Sheet title="Show a section" onClose={() => setFiltering(false)}>
          <div className="sheet-form">
            <div className="seg" role="group" aria-label="Show section" style={{ alignSelf: 'flex-start', flexWrap: 'wrap', borderRadius: 18 }}>
              {(['all', ...SHOP_SECTIONS] as const).map(f => {
                const on = only === f, n = f === 'all' ? toBuy.length : toBuy.filter(i => i.section === f).length;
                if (f !== 'all' && !n) return null;
                return (
                  <button key={f} className={on ? 'on' : ''} aria-pressed={on} onClick={() => { setView(v => ({ ...v, only: f })); setFiltering(false); }}>
                    {f === 'all' ? 'Everything' : SHOP_SECTION_LABEL[f]} <span className="seg-count">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Sheet>
      )}
      {groups.map(({ sec, list }) => (
        <div key={sec ?? 'all'} className="shop-group">
          {sec && <div className="sec-label shop-sec">{SHOP_SECTION_LABEL[sec]} <span className="sec-count">{list.length}</span></div>}
          {list.map(i => line(i))}
        </div>
      ))}
      {items.length > 0 && !shown.length && <p className="empty">{toBuy.length ? 'Nothing in this section.' : 'All bought ✓'}</p>}
      {!items.length && <p className="empty">Nothing to buy. Plan some meals, add an item, or everything’s already in the pantry.</p>}

      {/* This week's archive: what's been ticked off. Untick to put something back on the list. */}
      {bought.length > 0 && (
        <div className="shop-bought">
          <button className="shop-bought-head" onClick={() => setShowBought(v => !v)} aria-expanded={showBought}>
            <span className="sec-label">Bought <span className="sec-count">{bought.length}</span></span>
            <span className="muted">{showBought ? 'Hide' : 'Show'}</span>
          </button>
          {showBought && <div className="shop-bought-list">{bought.map(i => line(i, true))}</div>}
          <button className="pill dark shop-stock" onClick={stockTicked}>Add bought items to the pantry</button>
        </div>
      )}

      <div className="shop-foot">
        {items.length > 0 && <button className="link-btn" onClick={() => setSorting(v => !v)}>{sorting ? 'Done changing sections' : 'Change sections'}</button>}
        {skipped.length > 0 && (
          <div>
            <button className="link-btn" onClick={() => setShowSkipped(v => !v)}>{skipped.length} already in the pantry</button>
            {showSkipped && <div className="row" style={{ marginTop: 6 }}>{skipped.map(s => <span key={s.name} className="chip">{s.name} · {s.note}</span>)}</div>}
          </div>
        )}
        <p className="note" style={{ margin: 0 }}>{stockRule}</p>
      </div>
      {adding && <Sheet title="Add to the list" onClose={() => setAdding(false)}><AddItem onAdd={(m, sec) => { addManual(m, sec); }} /></Sheet>}
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
    <div className="sheet-form">
    <div className="shop-add" style={{ padding: 0 }}>
      <input className="field-sm compact" style={{ flex: '1 1 100%' }} autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
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
