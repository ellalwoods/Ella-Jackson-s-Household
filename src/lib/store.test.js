import { beforeAll, expect, it } from 'vitest';
import { seed } from './model';
import { HouseholdStore } from './store';
beforeAll(() => {
    const noop = { addEventListener() { }, removeEventListener() { }, visibilityState: 'visible' };
    Object.assign(globalThis, { window: noop, document: noop });
});
/** In-memory stand-in for the household row behind get_household / save_household. */
function fakeBackend(secret = 'k') {
    const server = { data: null, version: 0 };
    const make = (key) => ({
        load: async () => (key === secret ? { data: server.data && JSON.parse(JSON.stringify(server.data)), version: server.version } : 'invalid'),
        save: async (data, expected) => {
            if (key !== secret || server.version !== expected)
                return null;
            server.data = JSON.parse(JSON.stringify(data));
            return ++server.version;
        },
        listen: () => () => { },
        announce: () => { },
    });
    return { server, make };
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
it('fills a brand-new household and saves edits', async () => {
    const { server, make } = fakeBackend();
    const store = new HouseholdStore(make('k'));
    await store.start();
    await wait(50);
    expect(server.version).toBe(1);
    expect(server.data?.recipes.length).toBeGreaterThan(0);
    store.update(d => { d.recipes.push({ id: 'new', name: 'Laksa', meals: ['dinner'], ingredients: [] }); });
    await wait(600);
    expect(server.version).toBe(2);
    expect(server.data.recipes.some(r => r.name === 'Laksa')).toBe(true);
    expect(store.getState().status).toBe('synced');
    store.stop();
});
it('replays local edits on top of the other person’s newer save', async () => {
    const { server, make } = fakeBackend();
    server.data = seed();
    server.version = 5;
    const store = new HouseholdStore(make('k'));
    await store.start();
    // Jackson saves from his phone; this device hasn't heard about it yet.
    server.data = { ...server.data, pantry: [...server.data.pantry, { name: 'Milk', state: 'Full' }] };
    server.version = 6;
    store.update(d => { d.pantry.push({ name: 'Eggs', state: 'Low' }); });
    await wait(600);
    const names = server.data.pantry.map(c => c.name);
    expect(names).toContain('Milk');
    expect(names).toContain('Eggs');
    expect(server.version).toBe(7);
    expect(store.getState().data.pantry.map(c => c.name)).toEqual(names);
    store.stop();
});
it('refuses a link with the wrong key', async () => {
    const { server, make } = fakeBackend();
    const store = new HouseholdStore(make('wrong'));
    await store.start();
    expect(store.getState().status).toBe('invalid');
    expect(server.version).toBe(0);
});
it('recovers by itself when the server briefly fails, without saying offline', async () => {
    const { server, make } = fakeBackend();
    server.data = seed();
    server.version = 3;
    const backend = make('k');
    let fails = 2;
    const load = backend.load;
    backend.load = async () => { if (fails-- > 0)
        throw new Error('timeout'); return load(); };
    const store = new HouseholdStore(backend, 10);
    await store.start();
    expect(store.getState().status).toBe('retrying');
    await wait(100);
    expect(store.getState().status).toBe('synced');
    store.stop();
});
