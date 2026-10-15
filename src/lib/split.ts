// The Split page, Splitwise-style: every cost has one payer and the people it was for, and
// every balance is between two people (Ella–Jackson, Ella–Sam, Jackson–Sam…). Kept apart
// from the budget: only what's added on the Split page counts.

/** 'ella', 'jackson', or the name of someone outside the household (a reusable tag). */
export type Who = string;
export const US = ['ella', 'jackson'] as const;
export const isUs = (w: Who) => w === 'ella' || w === 'jackson';

/**
 * A cost: `paidBy` paid `amount`, which was for the people in `shares` (each one's part,
 * adding up to the amount). A `settle` is a settle-up between two people: the one who owed
 * paid the other back, and it closes their running total. A `payment` is a part-payment.
 */
export interface Txn {
  id: string;
  date: string;
  what: string;
  amount: number;
  paidBy: Who;
  shares: Record<Who, number>;
  settle?: boolean;
  payment?: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const same = (a: Who, b: Who) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Split an amount equally to the cent; any leftover cents go to the first people. */
export function equalShares(amount: number, people: Who[]): Record<Who, number> {
  const total = Math.round(amount * 100), n = people.length, out: Record<Who, number> = {};
  people.forEach((p, i) => { out[p] = (Math.floor(total / n) + (i < total % n ? 1 : 0)) / 100; });
  return out;
}

const shareOf = (t: Txn, w: Who) => { for (const k in t.shares) if (same(k, w)) return t.shares[k]; return 0; };
const involves = (t: Txn, w: Who) => same(t.paidBy, w) || Object.keys(t.shares).some(k => same(k, w));

/** What `a` owes `b` because of this cost (negative: `b` owes `a`). */
export const owesFrom = (t: Txn, a: Who, b: Who) =>
  (same(t.paidBy, b) ? shareOf(t, a) : 0) - (same(t.paidBy, a) ? shareOf(t, b) : 0);

/** Is this a settle-up between exactly these two? */
const settles = (t: Txn, a: Who, b: Who) => !!t.settle && involves(t, a) && involves(t, b);

/** The costs between `a` and `b` since they last settled up, oldest first. */
export function pairOpen(txns: Txn[], a: Who, b: Who): Txn[] {
  let open: Txn[] = [];
  for (const t of txns) {
    if (settles(t, a, b)) open = [];
    else if (!t.settle && Math.abs(owesFrom(t, a, b)) >= 0.005) open.push(t);
  }
  return open;
}

/** What `a` owes `b` right now (negative: `b` owes `a`). */
export const pairBalance = (txns: Txn[], a: Who, b: Who) => cents(pairOpen(txns, a, b).reduce((s, t) => s + owesFrom(t, a, b), 0));

/** Each settle-up between `a` and `b`, newest first, with the costs it closed. */
export function pairRounds(txns: Txn[], a: Who, b: Who) {
  const rounds: { settle: Txn; items: Txn[] }[] = [];
  let open: Txn[] = [];
  for (const t of txns) {
    if (settles(t, a, b)) { rounds.push({ settle: t, items: open }); open = []; }
    else if (!t.settle && Math.abs(owesFrom(t, a, b)) >= 0.005) open.push(t);
  }
  return rounds.reverse();
}

/**
 * Settle up between one of us and someone: whoever owes pays the whole balance. If the other
 * one of us handed the money over instead (`via`), they're owed it back by the one it was for.
 */
export function settleUp(txns: Txn[], me: Who, them: Who, date: string, id: () => string, via?: Who): Txn[] {
  const bal = pairBalance(txns, me, them); // what `me` owes `them`
  const debtor = bal > 0 ? me : them, creditor = bal > 0 ? them : me, amount = Math.abs(bal);
  const out: Txn[] = [{ id: id(), date, what: 'Settled up', amount, paidBy: debtor, shares: { [creditor]: amount }, settle: true }];
  if (via && amount > 0) {
    // `via` paid on `me`'s behalf (so `me` owes `via`), or received what `them` owed `me` (so `via` owes `me`).
    out.push(bal > 0
      ? { id: id(), date, what: 'Paid ' + them + ' for you', amount, paidBy: via, shares: { [me]: amount } }
      : { id: id(), date, what: them + ' paid back through you', amount, paidBy: me, shares: { [via]: amount } });
  }
  return out;
}

/** Everyone outside the household that a cost mentions, in the order first seen. */
export function peopleIn(txns: Txn[], tags: string[]): string[] {
  const out: string[] = [];
  const add = (w: Who) => { if (!isUs(w) && !out.some(o => same(o, w))) out.push(w); };
  tags.forEach(add);
  for (const t of txns) { add(t.paidBy); Object.keys(t.shares).forEach(add); }
  return out;
}

/** Rename someone everywhere (fixing a typo, say). */
export function renamePerson(txns: Txn[], from: string, to: string) {
  for (const t of txns) {
    if (same(t.paidBy, from)) t.paidBy = to;
    for (const k of Object.keys(t.shares)) if (same(k, from) && k !== to) { t.shares[to] = (t.shares[to] ?? 0) + t.shares[k]; delete t.shares[k]; }
  }
}

// ── Upgrading the first version of the Split page ──────────────────────────

interface OldSplit { id: string; date: string; what: string; amount: number; paidBy: string; forWho: string; ellaShare?: number; settle?: boolean }
interface OldOther { id: string; date: string; person: string; what: string; amount: number; dir: 'they' | 'we'; whose: string; payment?: boolean; settle?: boolean }

export function upgradeSplits(splits: OldSplit[] = [], others: OldOther[] = [], id: () => string): Txn[] {
  const out: Txn[] = [];
  for (const e of splits) {
    const shares: Record<Who, number> = e.forWho === 'both'
      ? { ella: e.ellaShare ?? cents(e.amount / 2), jackson: cents(e.amount - (e.ellaShare ?? cents(e.amount / 2))) }
      : { [e.forWho]: e.amount };
    out.push({ id: e.id, date: e.date, what: e.what, amount: e.amount, paidBy: e.paidBy, shares, ...(e.settle ? { settle: true } : {}) });
  }
  for (const e of others) {
    if (e.settle) {
      // The old settle-up squared things with this person for both of us.
      for (const me of US) out.push({ id: id(), date: e.date, what: 'Settled up', amount: 0, paidBy: me, shares: { [e.person]: 0 }, settle: true });
      continue;
    }
    const mine = e.whose === 'both' ? ['ella', 'jackson'] : [e.whose];
    for (const me of mine) {
      const amt = e.whose === 'both' ? cents(e.amount / 2) : e.amount;
      out.push(e.dir === 'they'
        ? { id: id(), date: e.date, what: e.what, amount: amt, paidBy: me, shares: { [e.person]: amt }, ...(e.payment ? { payment: true } : {}) }
        : { id: id(), date: e.date, what: e.what, amount: amt, paidBy: e.person, shares: { [me]: amt }, ...(e.payment ? { payment: true } : {}) });
    }
  }
  return out;
}
