import { useEffect, useState } from 'react';
import { addDays, key } from '../lib/dates';
import { money } from '../lib/model';
import { buyText, fmtAmount, ShopItem, shoppingText, Skipped, stockUp } from '../lib/food';
import type { Update } from '../Household';
import { stockRule } from './PantryPage';

const TICKS_KEY = 'hh-shop-ticks';

const EXPIRY_KEY = 'hh-shop-expiry';

/** Ticks and expiry dates are per device (whoever is at the shops), remembered across reloads. */
function useStored<T>(storageKey: string) {
  const [v, setV] = useState<Record<string, T>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* blocked */ } }, [storageKey, v]);
  return [v, setV] as const;
}

interface Props { update: Update; mon: Date; label: string; items: ShopItem[]; skipped: Skipped[] }

export default function ShopPage({ update, mon, label, items, skipped }: Props) {
  const [ticks, setTicks] = useStored<boolean>(TICKS_KEY);
  const [dates, setDates] = useStored<string>(EXPIRY_KEY);
  const [copied, setCopied] = useState(false);
  const wk = key(mon);
  const isTicked = (i: ShopItem) => !!ticks[wk + '|' + i.lk];
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
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
    a.download = 'shopping-list-' + wk + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
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
    got.forEach(i => { const d = dates[wk + '|' + i.lk]; if (d) exp[i.lk] = d; });
    update(x => stockUp(x, got, wk, exp));
    setDates(ds => { const n = { ...ds }; got.forEach(i => delete n[wk + '|' + i.lk]); return n; });
  };

  return (
    <div className="flow">
      <section className="card" style={{ flex: '2 1 420px', padding: '18px 20px' }}>
        <div className="row8" style={{ marginBottom: 10 }}>
          <button className="pill dark" onClick={copy}>{copied ? 'Copied ✓' : 'Copy list'}</button>
          <button className="pill plain" onClick={download}>Download .txt</button>
          <button className="pill plain" onClick={print}>Print</button>
        </div>
        {items.map(i => {
          const ck = isTicked(i);
          return (
            <div key={i.lk} className="shop-row">
            <button className="shop-item" style={{ opacity: ck ? 0.55 : 1 }}
              onClick={() => setTicks(t => ({ ...t, [wk + '|' + i.lk]: !t[wk + '|' + i.lk] }))}>
              <span className="box-check" style={{ background: ck ? '#23221F' : 'transparent' }}>{ck ? '✓' : ''}</span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'normal' }}>
                <span style={{ fontSize: 15, textDecoration: ck ? 'line-through' : 'none' }}>{i.name}</span>
                <span style={{ fontSize: 12 }} className="muted">
                  For {i.days.join(', ')}{i.need ? ' · uses ' + fmtAmount(i.need) : ''}{i.buy ? ' · buy ' + buyText(i) : ''}
                </span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <span className="chip" style={{ fontSize: 11, padding: '3px 8px' }}>{i.status}</span>
                {i.cost !== null && <span style={{ fontSize: 12 }} className="muted">{money(i.cost)}</span>}
              </span>
            </button>
            {ck && (
              <label className="shop-expiry">
                Expires <input type="date" className="field-sm" style={{ height: 34 }} value={dates[wk + '|' + i.lk] ?? ''}
                  onChange={e => { const v = e.target.value; setDates(ds => ({ ...ds, [wk + '|' + i.lk]: v })); }} />
                <span className="note">optional</span>
              </label>
            )}
            </div>
          );
        })}
        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, padding: '12px 0 0', borderTop: '1px solid #23221F' }}>
            <span>Estimated total</span><span>{money(total)}</span>
          </div>
        )}
        {!items.length && <p className="empty" style={{ padding: '16px 0', margin: 0 }}>Nothing to buy — plan some dinners, or everything's already in the pantry.</p>}
        {items.some(isTicked) && (
          <button className="pill outline-dark" style={{ marginTop: 12 }} onClick={stockTicked}>Add ticked items to pantry</button>
        )}
      </section>
      <aside className="card" style={{ flex: '1 1 260px', padding: '18px 20px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Already in pantry — skipped</div>
        <div className="row">
          {skipped.map(s => <span key={s.name} className="chip">{s.name} · {s.note}</span>)}
        </div>
        {!skipped.length && <p style={{ fontSize: 13, margin: 0 }} className="muted">Nothing skipped this week.</p>}
        <p className="note" style={{ margin: '14px 0 0' }}>{stockRule}</p>
      </aside>
    </div>
  );
}
