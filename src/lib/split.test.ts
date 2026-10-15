import { expect, it } from 'vitest';
import { equalShares, pairBalance, pairOpen, pairRounds, peopleIn, renamePerson, settleUp, Txn, upgradeSplits } from './split';
import { migrate, seed } from './model';

let n = 0;
const id = () => 't' + ++n;
const t = (x: Partial<Txn>): Txn => ({ id: id(), date: '2026-10-15', what: 'x', amount: 0, paidBy: 'ella', shares: {}, ...x });

it('splits equally to the cent', () => {
  expect(equalShares(100, ['ella', 'jackson', 'Sam'])).toEqual({ ella: 33.34, jackson: 33.33, Sam: 33.33 });
});

it('keeps a separate balance for each pair, like Splitwise', () => {
  const txns = [
    t({ amount: 60, paidBy: 'Mia', shares: { ella: 30, jackson: 30 } }),           // each of us owes Mia 30
    t({ amount: 90, paidBy: 'ella', shares: equalShares(90, ['ella', 'jackson', 'Sam']) }), // Jackson and Sam owe Ella 30
    t({ amount: 200, paidBy: 'ella', shares: { Sam: 200 } }),
    t({ amount: 400, paidBy: 'Sam', shares: { ella: 400 } }),                       // 200 + 30 − 400: Ella owes Sam 170
    t({ amount: 50, paidBy: 'Sam', shares: { Mia: 25, Sam: 25 } }),                 // nothing to do with us
  ];
  expect(pairBalance(txns, 'ella', 'Mia')).toBe(30);
  expect(pairBalance(txns, 'jackson', 'Mia')).toBe(30);
  expect(pairBalance(txns, 'jackson', 'ella')).toBe(30);
  expect(pairBalance(txns, 'ella', 'Sam')).toBe(170);
  expect(pairBalance(txns, 'jackson', 'Sam')).toBe(0);
  expect(pairOpen(txns, 'jackson', 'Sam')).toEqual([]);
});

it('settling one pair leaves the others alone; paying on the other’s behalf moves the debt between us', () => {
  const txns = [t({ amount: 60, paidBy: 'Mia', shares: { ella: 30, jackson: 30 } })];
  txns.push(...settleUp(txns, 'ella', 'Mia', '2026-10-16', id));
  expect(pairBalance(txns, 'ella', 'Mia')).toBe(0);
  expect(pairBalance(txns, 'jackson', 'Mia')).toBe(30);
  // Ella hands Mia Jackson's 30 as well.
  txns.push(...settleUp(txns, 'jackson', 'Mia', '2026-10-16', id, 'ella'));
  expect(pairBalance(txns, 'jackson', 'Mia')).toBe(0);
  expect(pairBalance(txns, 'jackson', 'ella')).toBe(30);
  expect(pairRounds(txns, 'ella', 'Mia')).toHaveLength(1);
});

it('renames a person everywhere', () => {
  const txns = [t({ amount: 10, paidBy: 'Smа', shares: { ella: 10 } }), t({ amount: 4, paidBy: 'ella', shares: { 'Smа': 4 } })];
  renamePerson(txns, 'Smа', 'Sam');
  expect(peopleIn(txns, [])).toEqual(['Sam']);
  expect(pairBalance(txns, 'ella', 'Sam')).toBe(6);
});

it('upgrades the first version of the Split page', () => {
  const d: any = seed();
  delete d.txns; delete d.splitPeople;
  d.splits = [{ id: 'a', date: '2026-10-15', what: 'Groceries', amount: 180, paidBy: 'ella', forWho: 'both' }];
  d.others = [{ id: 'b', date: '2026-10-15', person: 'Mia', what: 'Dinner', amount: 60, dir: 'we', whose: 'both' }];
  const m = migrate(d)!;
  expect(m.splitPeople).toEqual(['Mia']);
  expect(pairBalance(m.txns, 'jackson', 'ella')).toBe(90);
  expect(pairBalance(m.txns, 'ella', 'Mia')).toBe(30);
  expect(pairBalance(m.txns, 'jackson', 'Mia')).toBe(30);
  expect((m as any).splits).toBeUndefined();
  expect(upgradeSplits([], [], id)).toEqual([]);
});
