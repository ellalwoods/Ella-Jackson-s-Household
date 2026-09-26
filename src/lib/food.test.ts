import { expect, it } from 'vitest';
import { addDays, key, mondayOf } from './dates';
import { HouseholdData, seed } from './model';
import { costContext, expiry, weekBudget, fmtAmount, recipeCost, shoppingList, stockUp, toBase } from './food';

const mon = mondayOf(new Date(2026, 8, 23)); // Mon 21 Sep 2026
const wk = key(mon);

function household(): HouseholdData {
  return {
    ...seed(mon),
    plan: { [key(mon)]: { dinner: 'a' }, [key(addDays(mon, 2))]: { lunch: 'b' } },
    recipes: [
      { id: 'a', name: 'Rice bowl', meals: ['dinner'], ingredients: [{ name: 'Rice', qty: 250, unit: 'g' }, { name: 'Salt' }] },
      { id: 'b', name: 'Fried rice', meals: ['lunch'], ingredients: [{ name: 'Rice', qty: 0.2, unit: 'kg' }, { name: 'Egg', qty: 2, unit: 'each' }] },
      { id: 'c', name: 'Old', meals: ['dinner'], cost: 12, ingredients: [{ name: 'Mystery' }] },
    ],
    prices: [
      { name: 'Rice', qty: 1, unit: 'kg', price: 3 },
      { name: 'Egg', qty: 12, unit: 'each', price: 6 },
    ],
    pantry: [{ name: 'Salt', state: 'Full' }],
  };
}

it('converts and formats units', () => {
  expect(toBase(1.5, 'kg')).toEqual({ dim: 'mass', v: 1500 });
  expect(fmtAmount({ dim: 'mass', v: 1500 })).toBe('1.5 kg');
  expect(fmtAmount({ dim: 'volume', v: 250 })).toBe('250 ml');
  expect(fmtAmount({ dim: 'count', v: 3 })).toBe('3 units');
  expect(fmtAmount({ dim: 'count', v: 1 })).toBe('1 unit');
});

it('works out meal cost from the amount of each ingredient used', () => {
  const D = household(), prices = costContext(D);
  expect(recipeCost(D.recipes[0], prices)).toBe(0.75); // 250 g of $3/kg
  expect(recipeCost(D.recipes[1], prices)).toBe(1.6); // 200 g rice + 2 of 12 eggs
  expect(recipeCost(D.recipes[2], prices)).toBe(12); // unpriced: keeps the old flat cost
});

it('adds up the week, buys whole packs and skips what the pantry covers', () => {
  const D = household();
  const { items, skipped } = shoppingList(D, mon);
  const rice = items.find(i => i.name === 'Rice')!;
  expect(fmtAmount(rice.need!)).toBe('450 g');
  expect(rice.packs).toBe(1);
  expect(rice.cost).toBe(3);
  expect(items.find(i => i.name === 'Egg')!.cost).toBe(6);
  expect(skipped).toEqual([{ name: 'Salt', note: 'Full' }]);

  D.pantry.push({ name: 'Rice', state: 'Full', qty: 500, unit: 'g' });
  expect(shoppingList(D, mon).items.some(i => i.name === 'Rice')).toBe(false);

  D.pantry[1].qty = 100; // short by 350 g → still one 1 kg bag
  const again = shoppingList(D, mon).items.find(i => i.name === 'Rice')!;
  expect(again.status).toBe('Have 100 g');
  expect(again.packs).toBe(1);
});

it('puts the leftover in the pantry after shopping, allowing for the week', () => {
  const D = household();
  D.pantry.push({ name: 'Rice', state: 'Full', qty: 100, unit: 'g' });
  const { items } = shoppingList(D, mon);
  stockUp(D, items, wk);
  const rice = D.pantry.find(p => p.name === 'Rice')!;
  expect(rice).toMatchObject({ qty: 650, unit: 'g', forWeek: wk }); // 100 + 1000 − 450
  expect(D.pantry.find(p => p.name === 'Egg')).toMatchObject({ qty: 10, unit: 'each' });
  // Same week: nothing left to buy. Next week the 650 g counts as stock.
  expect(shoppingList(D, mon).items).toEqual([]);
  D.plan = { [key(addDays(mon, 7))]: { dinner: 'a' } };
  expect(shoppingList(D, addDays(mon, 7)).items.some(i => i.name === 'Rice')).toBe(false);
});

it('labels expiry dates and treats expired pantry items as not in stock', () => {
  const today = new Date(2026, 8, 23);
  expect(expiry('2026-09-22', today)).toMatchObject({ expired: true, label: 'Expired 22 Sep' });
  expect(expiry('2026-09-24', today)).toMatchObject({ soon: true, label: 'Expires tomorrow' });
  expect(expiry('2026-10-10', today)).toMatchObject({ soon: false, expired: false, label: 'Use by 10 Oct' });

  const D = household();
  D.pantry.push({ name: 'Rice', state: 'Full', qty: 900, unit: 'g', expires: '2026-09-20' });
  const rice = shoppingList(D, mon, today).items.find(i => i.name === 'Rice')!;
  expect(rice.status).toBe('Expired');
  expect(rice.have).toBeNull();
});

it('carries expiry dates from the shopping list into the pantry', () => {
  const D = household();
  const { items } = shoppingList(D, mon);
  stockUp(D, items, wk, { egg: '2026-10-05' });
  expect(D.pantry.find(p => p.name === 'Egg')!.expires).toBe('2026-10-05');
  expect(D.pantry.find(p => p.name === 'Rice')!.expires).toBeUndefined();
});

it('costs staples at a nominal amount and leaves them off pack sizes', () => {
  const D = household();
  D.staples = ['Salt'];
  D.prices.push({ name: 'Salt', qty: 1, unit: 'kg', price: 2 });
  expect(recipeCost(D.recipes[0], costContext(D))).toBe(0.8); // 250 g rice + salt $0.05
  D.pantry = [];
  const salt = shoppingList(D, mon).items.find(i => i.name === 'Salt')!;
  expect(salt.buy).toBeNull();
  expect(salt.cost).toBeNull();
});

it('fills budgets from spends and meals, fixed categories in full, and counts overspend', () => {
  const D = household();
  D.incomes = [{ id: 'i1', name: 'Pay', person: 'ella', amount: 1000 }, { id: 'i2', name: 'Pay', person: 'jackson', amount: 1000 }];
  D.cats = [
    { id: 'rent', name: 'Rent', ella: 300, jackson: 300, fixed: true },
    { id: 'g', name: 'Groceries', ella: 50, jackson: 50 },
    { id: 'fun', name: 'Leisure', ella: 40, jackson: 40 },
  ];
  // Meals: Mon dinner $0.75 + Wed lunch $1.60 = $2.35 → groceries 50/50.
  D.spends = { [wk]: [
    { id: 's1', cat: 'fun', amount: 25, who: 'ella', note: 'Movies' },
    { id: 's2', cat: 'fun', amount: 60, who: 'jackson' },
  ] };
  D.extras = { [wk]: [{ id: 'x', name: 'Gift', amount: 20, who: 'both' }] };
  const b = weekBudget(D, mon);
  const [rent, groc, fun] = b.cats;
  expect(rent.spent).toEqual({ e: 300, j: 300, total: 600 });
  expect(groc.spent.total).toBe(2.35);
  expect(groc.counted.total).toBe(100); // under budget: the budget counts
  expect(fun.spent).toEqual({ e: 25, j: 60, total: 85 });
  expect(fun.over).toBe(5);
  expect(fun.counted).toEqual({ e: 40, j: 60, total: 100 }); // Jackson went $20 over his share
  expect(b.committed.total).toBe(600 + 100 + 100 + 20);
  expect([b.ellaLeft, b.jacksonLeft]).toEqual([1000 - 300 - 50 - 40 - 10, 1000 - 300 - 50 - 60 - 10]);
});
