import { describe, expect, it } from 'vitest';
import { addDays, key, mondayOf } from './dates';
import { seed } from './model';
import { addToPantry, bucketAverage, costContext, pendingPicks, searchRecipes, weekMeals, guessSection, expiry, weekBudget, fmtAmount, recipeCost, shoppingList, stockUp, toBase } from './food';
const mon = mondayOf(new Date(2026, 8, 23)); // Mon 21 Sep 2026
const wk = key(mon);
function household() {
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
    const rice = items.find(i => i.name === 'Rice');
    expect(fmtAmount(rice.need)).toBe('450 g');
    expect(rice.packs).toBe(1);
    expect(rice.cost).toBe(3);
    expect(items.find(i => i.name === 'Egg').cost).toBe(6);
    expect(skipped).toEqual([{ name: 'Salt', note: 'Full' }]);
    D.pantry.push({ name: 'Rice', state: 'Full', qty: 500, unit: 'g' });
    expect(shoppingList(D, mon).items.some(i => i.name === 'Rice')).toBe(false);
    D.pantry[1].qty = 100; // short by 350 g → still one 1 kg bag
    const again = shoppingList(D, mon).items.find(i => i.name === 'Rice');
    expect(again.status).toBe('Have 100 g');
    expect(again.packs).toBe(1);
});
it('puts the leftover in the pantry after shopping, allowing for the week', () => {
    const D = household();
    D.pantry.push({ name: 'Rice', state: 'Full', qty: 100, unit: 'g' });
    const { items } = shoppingList(D, mon);
    stockUp(D, items, wk);
    const rice = D.pantry.find(p => p.name === 'Rice');
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
    expect(expiry('none', today)).toBeNull(); // N/A: never expires
    const D = household();
    D.pantry.push({ name: 'Rice', state: 'Full', qty: 900, unit: 'g', expires: '2026-09-20' });
    const rice = shoppingList(D, mon, today).items.find(i => i.name === 'Rice');
    expect(rice.status).toBe('Expired');
    expect(rice.have).toBeNull();
});
it('carries expiry dates from the shopping list into the pantry', () => {
    const D = household();
    const { items } = shoppingList(D, mon);
    stockUp(D, items, wk, { egg: '2026-10-05' });
    expect(D.pantry.find(p => p.name === 'Egg').expires).toBe('2026-10-05');
    expect(D.pantry.find(p => p.name === 'Rice').expires).toBeUndefined();
});
it('costs staples at a nominal amount and leaves them off pack sizes', () => {
    const D = household();
    D.staples = ['Salt'];
    D.prices.push({ name: 'Salt', qty: 1, unit: 'kg', price: 2 });
    expect(recipeCost(D.recipes[0], costContext(D))).toBe(0.8); // 250 g rice + salt $0.05
    D.pantry = [];
    const salt = shoppingList(D, mon).items.find(i => i.name === 'Salt');
    expect(salt.buy).toBeNull(); // no pack size: bought whole, tracked by level
    expect(salt.cost).toBe(2); // but it has a purchase price for the list
    expect(salt.staple).toBe(true);
    stockUp(D, [salt], wk);
    expect(D.pantry.find(p => p.name === 'Salt')).toEqual({ name: 'Salt', state: 'Full' });
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
it('includes hand-added items, counts their price, and stocks them into the pantry', () => {
    const D = household();
    D.plan = {};
    D.shopExtras = { [wk]: [{ id: 'm1', name: 'Milk', qty: 2, unit: 'L', price: 3.1 }, { id: 'm2', name: 'Toilet paper' }] };
    D.pantry = [{ name: 'Milk', state: 'Full', qty: 500, unit: 'ml' }];
    const { items } = shoppingList(D, mon);
    expect(items.map(i => [i.name, i.cost])).toEqual([['Milk', 3.1], ['Toilet paper', null]]);
    stockUp(D, items, wk, { 'm:m1': '2026-10-01' });
    expect(D.pantry.find(p => p.name === 'Milk')).toMatchObject({ qty: 2500, unit: 'ml', expires: '2026-10-01' });
    expect(D.pantry.find(p => p.name === 'Toilet paper')).toMatchObject({ state: 'Full' });
    expect(D.shopExtras[wk]).toBeUndefined();
});
it('adds to the pantry by hand, topping up amounts in matching units', () => {
    const D = household();
    D.pantry = [{ name: 'Rice', state: 'Full', qty: 300, unit: 'g' }, { name: 'Salt', state: 'Low' }];
    addToPantry(D, { name: 'rice', qty: 1, unit: 'kg', expires: '2027-01-01' });
    addToPantry(D, { name: 'Salt' });
    addToPantry(D, { name: 'Oats', qty: 750, unit: 'g' });
    expect(D.pantry).toEqual([
        { name: 'Rice', state: 'Full', qty: 1300, unit: 'g', expires: '2027-01-01' },
        { name: 'Salt', state: 'Full' },
        { name: 'Oats', state: 'Full', qty: 750, unit: 'g' },
    ]);
});
it('sorts shopping items into sections: guesses for added items, remembers choices', () => {
    expect(['Toothpaste', 'Dishwashing liquid', 'Toilet paper', 'Milk', 'Pad thai noodles', 'Face cleanser', 'Laundry powder', 'Olive oil spray', 'Fabric softener', 'Napisan',
        'Bin bags', 'Panadol', 'Vitamin D', 'Bandaids', 'Birthday card', 'Potting mix', 'Pillows', 'Cardamom', 'Board game'].map(guessSection))
        .toEqual(['personal', 'cleaning', 'household', 'food', 'food', 'personal', 'laundry', 'food', 'laundry', 'laundry',
        'household', 'health', 'health', 'health', 'leisure', 'leisure', 'household', 'food', 'leisure']);
    const D = household();
    D.shopExtras = { [wk]: [{ id: 'a', name: 'Shampoo' }, { id: 'b', name: 'Sponges' }] };
    D.shopSections = { egg: 'other' };
    const sec = Object.fromEntries(shoppingList(D, mon).items.map(i => [i.name, i.section]));
    expect(sec).toMatchObject({ Rice: 'food', Egg: 'other', Shampoo: 'personal', Sponges: 'cleaning' });
});
it('costs buckets at their average until items are picked, and shops for the picks', () => {
    const D = household();
    D.prices.push({ name: 'Carrot', qty: 1, unit: 'kg', price: 2 }, // 200 g → $0.40
    { name: 'Broccoli', qty: 1, unit: 'each', price: 2.6 }, // 1 → $2.60
    { name: 'Potato', qty: 2, unit: 'kg', price: 4 });
    D.buckets = [{ id: 'veg', name: 'Vegetables', items: [
                { name: 'Carrot', qty: 200, unit: 'g' }, { name: 'Broccoli', qty: 1, unit: 'each' }, { name: 'Potato', qty: 300, unit: 'g' },
            ] }];
    D.recipes.push({ id: 'sv', name: 'Steak and Veg', meals: ['dinner'], ingredients: [], buckets: [{ bucket: 'veg', count: 2 }] });
    const ctx = costContext(D);
    expect(bucketAverage(D.buckets[0], ctx)).toBe(1.2); // (0.40 + 2.60 + 0.60) / 3
    expect(recipeCost(D.recipes[3], ctx)).toBe(2.4); // 2 × average
    expect(recipeCost(D.recipes[3], ctx, { veg: ['Carrot'] })).toBe(1.6); // carrot + 1 × average
    expect(recipeCost(D.recipes[3], ctx, { veg: ['Carrot', 'Potato'] })).toBe(1); // actual picks
    D.plan = { [wk]: { dinner: 'sv' } };
    D.pantry = [];
    D.picks = { [wk + '|dinner']: { veg: ['Carrot', 'Potato'] } };
    const names = shoppingList(D, mon).items.map(i => i.name);
    expect(names).toEqual(['Carrot', 'Potato']);
    expect(shoppingList(D, mon).items[0].need).toEqual({ dim: 'mass', v: 200 });
});
it('treats blank bucket picks as omitted: no cost, not shopped, not pending', () => {
    const D = household();
    D.prices.push({ name: 'Carrot', qty: 1, unit: 'kg', price: 2 }, { name: 'Potato', qty: 2, unit: 'kg', price: 4 });
    D.buckets = [{ id: 'veg', name: 'Vegetables', perMeal: 3, items: [{ name: 'Carrot', qty: 200, unit: 'g' }, { name: 'Potato', qty: 300, unit: 'g', tags: ['Roots'] }] }];
    D.recipes.push({ id: 'sv', name: 'Steak and Veg', meals: ['dinner'], ingredients: [], buckets: [{ bucket: 'veg', count: 3 }], tags: ['Quick'] });
    D.plan = { [wk]: { dinner: 'sv' } };
    D.pantry = [];
    D.picks = { [wk + '|dinner']: { veg: ['Carrot', '', ''] } };
    expect(recipeCost(D.recipes[3], costContext(D), D.picks[wk + '|dinner'])).toBe(0.4); // carrot only
    expect(shoppingList(D, mon).items.map(i => i.name)).toEqual(['Carrot']);
    expect(pendingPicks(weekMeals(D, mon)[0], D)).toEqual([]);
    expect(searchRecipes(D.recipes, 'quick').map(r => r.name)).toEqual(['Steak and Veg']);
});
it('lets bucket items be staples: nominal cost, no pack size on the list', () => {
    const D = household();
    D.staples = ['Garlic'];
    D.prices.push({ name: 'Carrot', qty: 1, unit: 'kg', price: 2 });
    D.buckets = [{ id: 'b', name: 'Aromatics', items: [{ name: 'Garlic' }, { name: 'Carrot', qty: 200, unit: 'g' }] }];
    D.recipes.push({ id: 'x', name: 'Soup', meals: ['dinner'], ingredients: [], buckets: [{ bucket: 'b', count: 2 }] });
    const ctx = costContext(D);
    expect(bucketAverage(D.buckets[0], ctx)).toBe(0.23); // (0.05 + 0.40) / 2, rounded
    expect(recipeCost(D.recipes[3], ctx, { b: ['Garlic', 'Carrot'] })).toBe(0.45);
    D.plan = { [wk]: { dinner: 'x' } };
    D.pantry = [];
    D.picks = { [wk + '|dinner']: { b: ['Garlic'] } };
    const garlic = shoppingList(D, mon).items.find(i => i.name === 'Garlic');
    expect(garlic.buy).toBeNull();
});
describe('mini recipes in buckets', () => {
    it('costs a picked mini recipe as a whole batch and lists its ingredients', () => {
        const D = seed(new Date(2026, 8, 23));
        D.recipes.push({ id: 'sv', name: 'Salsa verde', mini: true, meals: [], ingredients: [{ name: 'Parsley', qty: 1, unit: 'each' }, { name: 'Capers', qty: 50, unit: 'g' }] });
        D.prices.push({ name: 'Parsley', qty: 1, unit: 'each', price: 3 }, { name: 'Capers', qty: 100, unit: 'g', price: 4 });
        D.buckets.push({ id: 'gar', name: 'Garnishes', items: [{ name: 'Salsa verde', recipe: 'sv' }, { name: 'Chives', qty: 1, unit: 'each' }] });
        const mon = mondayOf(new Date(2026, 8, 23)), k = key(mon);
        const bol = D.recipes.find(r => r.id === 'bol');
        bol.buckets = [{ bucket: 'gar', count: 1 }];
        D.picks[k + '|dinner'] = { gar: ['Salsa verde'] };
        const ctx = costContext(D);
        expect(recipeCost(bol, ctx, { gar: ['Salsa verde'] }) - recipeCost({ ...bol, buckets: [] }, ctx)).toBeCloseTo(5);
        const names = shoppingList(D, mon).items.map(i => i.name);
        expect(names).toContain('Parsley');
        expect(names).toContain('Capers');
        expect(names).not.toContain('Salsa verde');
    });
});
