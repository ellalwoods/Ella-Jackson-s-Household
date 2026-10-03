import { describe as group, expect, it } from 'vitest';
import { addDays, key, mondayOf, weekLabel } from './dates';
import { budget, Category, describe, eatOutName, removeTag, renameTag, tagUses, HouseholdData, migrate, money, num, occurs, seed, setShare } from './model';

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
    expect(migrate({ cats: [{ id: 'r', name: 'Rent', ella: 1, jackson: 1 }] })!.cats[0].fixed).toBe(true);
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

group('share of what’s left', () => {
  const cats = () => [
    { id: 'a', name: 'Fun money', ella: 0, jackson: 0, share: 50 },
    { id: 'b', name: 'Discretionary', ella: 0, jackson: 0, share: 30 },
    { id: 'c', name: 'Savings', ella: 0, jackson: 0, share: 20 },
  ] as Category[];

  it('shifts the others, keeping their ratio', () => {
    const cs = cats();
    setShare(cs, 'a', 20);
    expect(cs.map(c => c.share)).toEqual([20, 48, 32]);
  });

  it('splits each person’s remainder', () => {
    const D = { ...seed(), cats: [{ id: 'r', name: 'Rent', ella: 400, jackson: 400, fixed: true }, ...cats()] } as HouseholdData;
    D.incomes = [{ id: 'i', name: 'Pay', person: 'ella', amount: 1000 }, { id: 'j', name: 'Pay', person: 'jackson', amount: 600 }];
    const b = budget(D);
    expect(b.ellaLeft).toBe(600);
    expect(b.cats[1].e).toBe(300);
    expect(b.cats[3].j).toBe(40);
  });

  it('turns on for fun money and savings when upgrading', () => {
    const d = migrate({ cats: [{ id: 'x', name: 'Public transport', ella: 50, jackson: 50 }, { id: 'y', name: 'Fun money', ella: 30, jackson: 30 }, { id: 'z', name: 'Savings', ella: 90, jackson: 90 }] })!;
    expect(d.cats[0].fixed).toBe(true);
    expect(d.cats.map(c => c.share)).toEqual([undefined, 25, 75]);
  });
});

group('amounts', () => {
  it('reads $ signs and commas', () => {
    expect(num('$1,200')).toBe(1200);
    expect(num(' 400 ')).toBe(400);
    expect(num('abc')).toBe(0);
  });
});

group('places', () => {
  it('names a meal out by its saved place, falling back to what was typed', () => {
    const d = migrate({ cats: [] })!;
    expect(d.places).toEqual([]);
    d.places.push({ id: 'p1', name: 'Bella Brutta', kind: 'restaurant', been: true });
    d.eatOutPlace['2026-10-02|dinner'] = 'p1';
    d.eatOut['2026-10-03|lunch'] = 'Somewhere new';
    expect(eatOutName(d, '2026-10-02|dinner')).toBe('Bella Brutta');
    expect(eatOutName(d, '2026-10-03|lunch')).toBe('Somewhere new');
    expect(eatOutName(d, '2026-10-04|lunch')).toBe('');
  });
});

group('shared tags', () => {
  it('renames and removes a tag everywhere, merging duplicates', () => {
    const d = seed();
    d.recipeTags = ['Qiuck', 'Quick', 'Kids'];
    d.recipes[0].tags = ['Qiuck', 'Kids'];
    d.recipes[1].tags = ['Quick', 'Qiuck'];
    renameTag(d, 'recipe', 'Qiuck', 'Quick');
    expect(d.recipeTags).toEqual(['Quick', 'Kids']);
    expect(d.recipes[0].tags).toEqual(['Quick', 'Kids']);
    expect(d.recipes[1].tags).toEqual(['Quick']);
    expect(tagUses(d, 'recipe', 'Kids')).toBe(1);
    removeTag(d, 'recipe', 'Kids');
    expect(d.recipeTags).toEqual(['Quick']);
    expect(d.recipes[0].tags).toEqual(['Quick']);
  });
});
