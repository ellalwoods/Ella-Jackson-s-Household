import { describe as group, expect, it } from 'vitest';
import { addDays, key, mondayOf, weekLabel } from './dates';
import { budget, describe, HouseholdData, migrate, money, occurs, seed, shoppingList } from './model';

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

group('shoppingList', () => {
  it('skips Full/Half cupboard items and keeps Low/Replace', () => {
    const D = seed(mon);
    const { items, skipped } = shoppingList(D, mon);
    const names = items.map(i => i.name);
    expect(names).toContain('Garlic'); // Low
    expect(names).toContain('Spaghetti'); // Replace
    expect(names).not.toContain('Passata'); // Full
    expect(skipped.map(s => s.name)).toEqual(expect.arrayContaining(['Passata', 'Rice', 'Soy sauce', 'Olive oil']));
    expect(items.find(i => i.name === 'Garlic')!.days).toEqual(['Mon', 'Tue', 'Thu']);
  });
});

group('budget', () => {
  it('sums string amounts typed in inputs', () => {
    const D: HouseholdData = { ...seed(mon), cats: [{ id: 'x', name: 'Rent', ella: '380', jackson: 380 }] };
    const b = budget(D);
    expect(b.spend).toBe(760);
    expect(b.income).toBe(2400);
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
});

it('formats week labels', () => {
  expect(weekLabel(mon)).toBe('21–27 Sep');
  expect(weekLabel(new Date(2026, 8, 28))).toBe('28 Sep – 4 Oct');
});
