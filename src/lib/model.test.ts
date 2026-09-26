import { describe as group, expect, it } from 'vitest';
import { addDays, key, mondayOf, weekLabel } from './dates';
import { budget, describe, HouseholdData, migrate, money, occurs, seed } from './model';

const mon = mondayOf(new Date(2026, 8, 23)); // Mon 21 Sep 2026

group('occurs / describe', () => {
  it('handles weekly, every-N, monthly and one-off chores', () => {
    const weekly = { id: 'a', name: 'Bins', person: 'ella' as const, sched: { type: 'weekly' as const, days: [1] } };
    expect(occurs(weekly, addDays(mon, 1))).toBe(true);
    expect(occurs(weekly, addDays(mon, 2))).toBe(false);
    const every = { ...weekly, sched: { type: 'every' as const, n: 14, start: key(addDays(mon, 6)) } };
    expect(occurs(every, addDays(mon, 6))).toBe(true);
    expect(occurs(every, addDays(mon, 13))).toBe(false);
    expect(occurs(every, addDays(mon, 20))).toBe(true);
    expect(occurs(every, addDays(mon, -8))).toBe(false);
    expect(occurs({ ...weekly, sched: { type: 'monthly', dom: 23 } }, new Date(2026, 8, 23))).toBe(true);
    expect(describe({ type: 'every', n: 14, start: '2026-09-27' })).toBe('Fortnightly from 27 Sep');
    expect(describe({ type: 'monthly', dom: 2 })).toBe('Monthly on the 2nd');
    expect(describe({ type: 'weekly', days: [4, 0, 2] })).toBe('Every Mon, Wed, Fri');
  });
});

group('budget', () => {
  it('sums string amounts typed in inputs', () => {
    const D: HouseholdData = { ...seed(mon), cats: [{ id: 'x', name: 'Rent', ella: '380', jackson: 380 }] };
    const b = budget(D);
    expect(b.spend).toBe(760);
    expect(b.income).toBe(2400);
    expect([b.left, b.ellaLeft, b.jacksonLeft]).toEqual([1640, 770, 870]); // 1150 − 380, 1250 − 380
    expect(money(b.income - b.spend)).toBe('$1,640');
    expect(money(-12.5)).toBe('−$12.50');
  });
});

group('migrate', () => {
  it('turns the prototype single income into income sources', () => {
    const d = migrate({ cats: [], income: { ella: 100, jackson: 200 } })!;
    expect(d.incomes.map(i => [i.person, i.amount])).toEqual([['ella', 100], ['jackson', 200]]);
    expect(d.plan).toEqual({});
  });
  it('moves cupboard to pantry and plain ingredients to objects', () => {
    const d = migrate({ cats: [], incomes: [], cupboard: [{ name: 'Rice', state: 'Half' }], recipes: [{ id: 'a', name: 'X', cost: 9, ingredients: ['Rice'] }] })!;
    expect(d.pantry).toEqual([{ name: 'Rice', state: 'Half' }]);
    expect('cupboard' in d).toBe(false);
    expect(d.recipes[0].ingredients).toEqual([{ name: 'Rice' }]);
    expect(d.prices).toEqual([]);
    expect(d.recipes[0].meals).toEqual(['dinner']);
  });
  it('moves dinner-only plans into the dinner slot', () => {
    const d = migrate({ cats: [], incomes: [], plan: { '2026-09-21': { r: 'bol' }, '2026-09-22': { lunch: 'x' } } })!;
    expect(d.plan).toEqual({ '2026-09-21': { dinner: 'bol' }, '2026-09-22': { lunch: 'x' } });
  });
});

it('formats week labels', () => {
  expect(weekLabel(mon)).toBe('21–27 Sep');
  expect(weekLabel(new Date(2026, 8, 28))).toBe('28 Sep – 4 Oct');
});
