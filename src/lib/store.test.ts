import { beforeAll, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { seed } from './model';
import { HouseholdStore } from './store';

beforeAll(() => {
  const noop = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' };
  Object.assign(globalThis, { window: noop, document: noop });
});

/** Minimal in-memory stand-in for the single `household` row. */
function fakeServer() {
  const server = { row: null as null | { data: unknown; version: number } };
  const query = (op: string, payload?: any) => {
    const filters: Record<string, unknown> = {};
    const q: any = {
      eq(col: string, v: unknown) { filters[col] = v; return q; },
      select() { return q; },
      maybeSingle: async () => ({ data: server.row && JSON.parse(JSON.stringify(server.row)), error: null }),
      then(res: (v: unknown) => void) {
        if (op === 'insert') {
          if (server.row) return res({ error: { code: '23505' } });
          server.row = { data: payload.data, version: payload.version };
          return res({ error: null });
        }
        // update
        if (!server.row || server.row.version !== filters.version) return res({ data: [], error: null });
        server.row = { data: payload.data, version: payload.version };
        return res({ data: [{ version: payload.version }], error: null });
      },
    };
    return q;
  };
  const channel: any = { on: () => channel, subscribe: () => channel };
  const client = {
    from: () => ({ select: () => query('select'), insert: (p: unknown) => query('insert', p), update: (p: unknown) => query('update', p) }),
    channel: () => channel,
    removeChannel() {},
  } as unknown as SupabaseClient;
  return { server, client };
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

it('creates the row on first sign-in and saves edits', async () => {
  const { server, client } = fakeServer();
  const store = new HouseholdStore(client);
  await store.start();
  expect(server.row?.version).toBe(1);
  store.update(d => { d.recipes.push({ id: 'new', name: 'Laksa', cost: 20, ingredients: [] }); });
  await wait(600);
  expect(server.row?.version).toBe(2);
  expect((server.row!.data as any).recipes.some((r: any) => r.name === 'Laksa')).toBe(true);
  expect(store.getState().status).toBe('synced');
  store.stop();
});

it('replays local edits on top of the other person’s newer save', async () => {
  const { server, client } = fakeServer();
  server.row = { data: seed(), version: 5 };
  const store = new HouseholdStore(client);
  await store.start();

  // Jackson saves from his phone; this device hasn't heard about it yet.
  const theirs: any = JSON.parse(JSON.stringify(server.row.data));
  theirs.cupboard.push({ name: 'Milk', state: 'Full' });
  server.row = { data: theirs, version: 6 };

  store.update(d => { d.cupboard.push({ name: 'Eggs', state: 'Low' }); });
  await wait(600);

  const names = (server.row!.data as any).cupboard.map((c: any) => c.name);
  expect(names).toContain('Milk');
  expect(names).toContain('Eggs');
  expect(server.row!.version).toBe(7);
  expect(store.getState().data!.cupboard.map(c => c.name)).toEqual(names);
  store.stop();
});
