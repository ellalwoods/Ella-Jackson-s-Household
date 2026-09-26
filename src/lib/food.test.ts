import { expect, it } from 'vitest';
import { addDays, key, mondayOf } from './dates';
import { HouseholdData, seed } from './model';
import { costContext, expiry, groceryEstimate, fmtAmount, recipeCost, shoppingList, stockUp, toBase } from './food';

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

it('blends planned meal costs with the grocery placeholder for empty slots', () => {
  const D = household();
  D.cats = [{ id: 'g', name: 'Groceries', ella: 105, jackson: 105 }]; // $210 placeholder = $10 per slot
  D.plan = {};
  expect(groceryEstimate(D, mon)).toMatchObject({ status: 'placeholder', ella: 105, jackson: 105 });

  D.plan = { [key(mon)]: { dinner: 'a', other: 'b' } }; // $0.75 dinner + $1.60 other
  const g = groceryEstimate(D, mon)!;
  expect(g.status).toBe('partial');
  expect(g.filled).toBe(1); // "Other" doesn't use up a slot
  expect(g.ella + g.jackson).toBeCloseTo(2.35 + 200, 1); // meals + 20 empty slots × $10

  D.plan = {};
  for (let i = 0; i < 7; i++) D.plan[key(addDays(mon, i))] = { breakfast: 'a', lunch: 'a', dinner: 'a' };
  expect(groceryEstimate(D, mon)).toMatchObject({ status: 'planned', ella: 7.88, jackson: 7.88 }); // 21 × $0.75 split
});
