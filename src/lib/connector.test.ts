import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handle } from '../../supabase/functions/household-connector/index';
import { migrate, seed } from './model';

/** A stand-in for Supabase's get_household / save_household and broadcast endpoints. */
const KEY = 'abcdefghijklmnop1234';
let server: { data: any; version: number };
const env = { url: 'https://example.supabase.co', apiKey: 'sb_publishable_test' };

beforeEach(() => {
  server = { data: JSON.parse(JSON.stringify(seed())), version: 4 };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (url.endsWith('/rpc/get_household')) {
      return new Response(JSON.stringify(body.p_key === KEY ? [{ data: server.data, version: server.version }] : []));
    }
    if (url.endsWith('/rpc/save_household')) {
      if (body.p_key !== KEY || body.p_expected !== server.version) return new Response('null');
      server.data = body.p_data;
      return new Response(JSON.stringify(++server.version));
    }
    return new Response('{}'); // realtime broadcast
  }));
});
afterEach(() => vi.unstubAllGlobals());

const call = async (method: string, params: any = {}, key = KEY) => {
  const res = await handle(new Request('https://x.supabase.co/household-connector/' + key, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), env);
  return res.status === 200 ? res.json() : { status: res.status };
};
const tool = async (name: string, args: any) => (await call('tools/call', { name, arguments: args })).result;

it('speaks MCP: initialize and list tools', async () => {
  const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  expect(init.result.serverInfo.name).toBe('household');
  expect(init.result.protocolVersion).toBe('2025-06-18');
  const list = await call('tools/list');
  expect(list.result.tools.map((t: any) => t.name)).toEqual(['get_household_summary', 'add_recipe', 'add_place', 'save_prices']);
});

it('adds a recipe the app can read, reusing tags and keeping existing prices', async () => {
  server.data.recipeTags = ['Quick'];
  const r = await tool('add_recipe', {
    name: 'Chicken laksa', meals: ['dinner', 'lunch'], tags: ['quick', 'Spicy'],
    ingredients: [
      { name: 'Chicken thighs', qty: 300, unit: 'g', buy: { qty: 500, unit: 'g', price: 7 } }, // already priced in the sample data
      { name: 'Laksa paste', qty: 90, unit: 'g', buy: { qty: 185, unit: 'g', price: 4.5 } },
      { name: 'Salt', staple: true },
      { name: 'Lime', qty: 1, unit: 'units' },
    ],
    method: '1. Fry paste.\n2. Add stock and chicken.\n3. Serve over noodles.',
    link: 'www.recipetineats.com/laksa',
  });
  expect(r.isError).toBeUndefined();
  expect(r.content[0].text).toContain('Added “Chicken laksa”');
  expect(r.content[0].text).toContain('Saved prices for Laksa paste');
  expect(r.content[0].text).toContain('Kept the existing prices for Chicken thighs');
  expect(server.version).toBe(5);

  const d = migrate(server.data)!;
  const laksa = d.recipes.find(x => x.name === 'Chicken laksa')!;
  expect(laksa.tags).toEqual(['Quick', 'Spicy']);
  expect(laksa.ingredients).toEqual([
    { name: 'Chicken thighs', qty: 300, unit: 'g' }, { name: 'Laksa paste', qty: 90, unit: 'g' }, { name: 'Salt' }, { name: 'Lime', qty: 1, unit: 'each' },
  ]);
  expect(laksa.link).toBe('https://www.recipetineats.com/laksa');
  expect(d.staples).toContain('Salt');
  expect(d.prices.find(p => p.name === 'Chicken thighs')!.price).toBe(13);
  expect(d.recipeTags).toEqual(['Quick', 'Spicy']);

  // Adding it again changes nothing.
  const again = await tool('add_recipe', { name: 'chicken laksa', ingredients: [] });
  expect(again.content[0].text).toContain('already in the app');
  expect(server.version).toBe(5);
});

it('adds a place and saves prices', async () => {
  await tool('add_place', { name: 'Bella Brutta', kind: 'restaurant', suburb: 'Newtown', cost: 45, tags: ['Date night'], notes: 'Book ahead', been: false });
  const d = migrate(server.data)!;
  expect(d.places[0]).toMatchObject({ name: 'Bella Brutta', kind: 'restaurant', suburb: 'Newtown', cost: 45, tags: ['Date night'], been: false });
  const p = await tool('save_prices', { items: [{ name: 'Rice', qty: 2, unit: 'kg', price: 5.5 }, { name: 'Basil', price: 3 }] });
  expect(p.content[0].text).toContain('Rice (2 kg for $5.50)');
  const d2 = migrate(server.data)!;
  expect(d2.prices.find(x => x.name === 'Rice')).toEqual({ name: 'Rice', qty: 2, unit: 'kg', price: 5.5 });
  expect(d2.prices.find(x => x.name === 'Basil')).toEqual({ name: 'Basil', qty: 1, unit: 'each', price: 3 });
});

it('summarises what is there, and retries if a phone saved at the same moment', async () => {
  const s = JSON.parse((await tool('get_household_summary', {})).content[0].text);
  expect(s.recipes).toContain('Spaghetti bolognese');
  expect(s.ingredients).toContain('Rice — 1 kg for $3.00');

  // The first save attempt loses a race with another device; the connector reloads and tries again.
  const real = fetch as any, impl = real.getMockImplementation();
  let raced = false;
  real.mockImplementation(async (url: string, init: any) => {
    if (!raced && url.endsWith('/rpc/save_household')) { raced = true; server.version++; return new Response('null'); }
    return impl(url, init);
  });
  await tool('add_place', { name: 'Single O', kind: 'cafe' });
  expect(migrate(server.data)!.places.map(p => p.name)).toEqual(['Single O']);
});

it('refuses the wrong key and non-POST requests', async () => {
  const r = await tool('get_household_summary', {}).catch(() => null);
  expect(r).toBeTruthy();
  const wrong = await call('tools/call', { name: 'add_place', arguments: { name: 'X' } }, 'zzzzzzzzzzzzzzzzzzzz');
  expect(wrong.result.isError).toBe(true);
  expect(wrong.result.content[0].text).toContain('wrong household key');
  const bad = await call('tools/list', {}, 'short');
  expect(bad.status).toBe(401);
  const get = await handle(new Request('https://x/household-connector/' + KEY), env);
  expect(get.status).toBe(405);
});
