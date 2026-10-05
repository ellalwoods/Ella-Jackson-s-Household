import { migrate, seed } from './model';
/** Same key the prototype used, so data saved there carries over. */
const CACHE_KEY = 'hh-sydney-v1';
const FLUSH_DELAY = 400;
/** First retry after a failed load or save; doubles each time, up to a minute. */
const RETRY_FIRST = 3000, RETRY_MAX = 60000;
const clone = (v) => JSON.parse(JSON.stringify(v));
function readCache() {
    try {
        return migrate(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
    }
    catch {
        return null;
    }
}
function writeCache(d) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(d));
    }
    catch { /* storage full or blocked */ }
}
/**
 * Holds the household document and keeps it in sync with the backend.
 *
 * Local edits are kept as a queue of mutations on top of the last version
 * confirmed by the server. Saves are conditional on the version, so when the
 * other person saved in the meantime we load their version and replay our
 * queued mutations on top of it instead of overwriting their changes.
 */
export class HouseholdStore {
    backend;
    retryFirst;
    state;
    listeners = new Set();
    base = null;
    version = 0;
    pending = [];
    flushing = false;
    remoteWhileFlushing = false;
    timer;
    unlisten = null;
    /** Bumped on start/stop so a stale start() never subscribes. */
    run = 0;
    retryIn;
    constructor(backend, retryFirst = RETRY_FIRST) {
        this.backend = backend;
        this.retryFirst = retryFirst;
        this.retryIn = retryFirst;
        this.state = backend ? { data: readCache(), status: 'loading' } : { data: readCache() ?? seed(), status: 'local' };
    }
    getState = () => this.state;
    subscribe = (fn) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
    set(patch) {
        this.state = { ...this.state, ...patch };
        if (this.state.data)
            writeCache(this.state.data);
        this.listeners.forEach(fn => fn());
    }
    async start() {
        if (!this.backend)
            return;
        const run = ++this.run;
        await this.pull();
        if (run !== this.run || this.state.status === 'invalid')
            return;
        this.unlisten = this.backend.listen(v => {
            if (this.flushing)
                this.remoteWhileFlushing = true;
            else if (v > this.version)
                this.pull().then(() => this.flush());
        });
        window.addEventListener('online', this.onWake);
        document.addEventListener('visibilitychange', this.onWake);
        this.flush();
    }
    stop() {
        this.run++;
        clearTimeout(this.timer);
        this.unlisten?.();
        this.unlisten = null;
        window.removeEventListener('online', this.onWake);
        document.removeEventListener('visibilitychange', this.onWake);
    }
    /** Phones drop websockets while asleep; catch up when the app comes back. */
    onWake = () => {
        if (document.visibilityState !== 'visible')
            return;
        this.pull().then(() => this.flush());
    };
    update(m) {
        const cur = this.state.data;
        if (!cur)
            return;
        const next = clone(cur);
        m(next);
        if (!this.backend) {
            this.set({ data: next });
            return;
        }
        this.pending.push(m);
        this.set({ data: next, status: 'saving' });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), FLUSH_DELAY);
    }
    /** Server version plus any local edits not yet saved. */
    recompute() {
        if (!this.base)
            return;
        const d = clone(this.base);
        this.pending.forEach(m => m(d));
        this.set({ data: d });
    }
    async pull() {
        let res;
        try {
            res = await this.backend.load();
        }
        catch (e) {
            this.failed(e);
            return;
        }
        this.retryIn = this.retryFirst;
        if (res === 'invalid') {
            this.set({ status: 'invalid' });
            return;
        }
        const data = migrate(res.data);
        if (!data) {
            // Brand-new household: start from whatever this device has, else sample data, and save it.
            if (!this.base) {
                this.base = readCache() ?? seed();
                this.version = res.version;
                this.pending.unshift(() => { });
                this.recompute();
            }
        }
        else if (res.version > this.version || !this.base) {
            this.base = data;
            this.version = res.version;
            this.recompute();
        }
        this.set({ status: this.pending.length ? 'saving' : 'synced' });
    }
    /**
     * A load or save failed. Say "offline" only when the device really has no
     * connection, and try again by itself (sooner at first, then backing off).
     */
    failed(e) {
        if (e)
            console.warn('Household sync failed; retrying', e);
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        this.set({ status: offline ? 'offline' : 'retrying' });
        clearTimeout(this.timer);
        const run = this.run;
        this.timer = setTimeout(() => { if (run === this.run)
            this.pull().then(() => this.flush()); }, this.retryIn);
        this.retryIn = Math.min(this.retryIn * 2, RETRY_MAX);
    }
    get failing() { return this.state.status === 'offline' || this.state.status === 'retrying'; }
    async flush() {
        if (!this.backend || this.flushing || !this.pending.length)
            return;
        if (!this.base || this.failing) {
            await this.pull();
            if (!this.base || this.failing)
                return;
        }
        this.flushing = true;
        const n = this.pending.length;
        const next = clone(this.base);
        this.pending.slice(0, n).forEach(m => m(next));
        let saved;
        try {
            saved = await this.backend.save(next, this.version);
        }
        catch (e) {
            this.flushing = false;
            this.failed(e);
            return;
        }
        this.flushing = false;
        this.retryIn = this.retryFirst;
        const remote = this.remoteWhileFlushing;
        this.remoteWhileFlushing = false;
        if (saved !== null) {
            this.base = next;
            this.version = saved;
            this.pending.splice(0, n);
            this.backend.announce(saved);
            this.recompute();
            if (remote)
                await this.pull();
        }
        else {
            // Someone else saved first: take their version and replay our edits on it.
            await this.pull();
            if (this.failing)
                return; // pull() has already scheduled a retry
        }
        if (this.pending.length)
            return this.flush();
        this.set({ status: 'synced' });
    }
}
