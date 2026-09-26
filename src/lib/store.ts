import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { HouseholdData, migrate, seed } from './model';

export type Mutation = (d: HouseholdData) => void;
export type SyncStatus = 'local' | 'loading' | 'synced' | 'saving' | 'offline' | 'forbidden';
export interface StoreState { data: HouseholdData | null; status: SyncStatus }

/** Same key the prototype used, so data saved there carries over. */
const CACHE_KEY = 'hh-sydney-v1';
const ROW_ID = 'home';
const FLUSH_DELAY = 400;
const RETRY_DELAY = 5000;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function readCache(): HouseholdData | null {
  try { return migrate(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); } catch { return null; }
}
function writeCache(d: HouseholdData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* storage full or blocked */ }
}

/**
 * Holds the household document and keeps it in sync with one Supabase row.
 *
 * Local edits are kept as a queue of mutations on top of the last version
 * confirmed by the server. Writes are conditional on the version, so when the
 * other person saved in the meantime we pull their version and replay our
 * queued mutations on top of it instead of overwriting their changes.
 */
export class HouseholdStore {
  private state: StoreState;
  private listeners = new Set<() => void>();
  private base: HouseholdData | null = null;
  private version = 0;
  private pending: Mutation[] = [];
  private flushing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private channel: RealtimeChannel | null = null;
  private remoteWhileFlushing: { data: HouseholdData; version: number } | null = null;
  /** Bumped on start/stop so a stale start() never subscribes. */
  private run = 0;

  constructor(private sb: SupabaseClient | null) {
    this.state = sb ? { data: readCache(), status: 'loading' } : { data: readCache() ?? seed(), status: 'local' };
  }

  getState = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };

  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    if (this.state.data) writeCache(this.state.data);
    this.listeners.forEach(fn => fn());
  }

  async start() {
    if (!this.sb) return;
    const run = ++this.run;
    await this.pull();
    if (run !== this.run || this.state.status === 'forbidden') return;
    this.channel = this.sb
      .channel('household')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'household', filter: 'id=eq.' + ROW_ID }, p => {
        const row = p.new as { data: HouseholdData; version: number };
        this.receive(row.data, row.version);
      })
      .subscribe();
    window.addEventListener('online', this.onWake);
    document.addEventListener('visibilitychange', this.onWake);
  }

  stop() {
    this.run++;
    clearTimeout(this.timer);
    if (this.channel) this.sb?.removeChannel(this.channel);
    window.removeEventListener('online', this.onWake);
    document.removeEventListener('visibilitychange', this.onWake);
  }

  /** Phones drop websockets while asleep; catch up when the app comes back. */
  private onWake = () => {
    if (document.visibilityState !== 'visible') return;
    this.pull().then(() => this.flush());
  };

  update(m: Mutation) {
    const cur = this.state.data;
    if (!cur) return;
    const next = clone(cur);
    m(next);
    if (!this.sb) { this.set({ data: next }); return; }
    this.pending.push(m);
    this.set({ data: next, status: 'saving' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), FLUSH_DELAY);
  }

  /** Server version plus any local edits not yet saved. */
  private recompute() {
    if (!this.base) return;
    const d = clone(this.base);
    this.pending.forEach(m => m(d));
    this.set({ data: d });
  }

  private receive(data: HouseholdData, version: number) {
    if (this.flushing) { this.remoteWhileFlushing = { data, version }; return; }
    if (version <= this.version) return;
    this.base = migrate(data);
    this.version = version;
    this.recompute();
  }

  private async pull(): Promise<void> {
    const sb = this.sb!;
    const { data: row, error } = await sb.from('household').select('data,version').eq('id', ROW_ID).maybeSingle();
    if (error) { this.set({ status: 'offline' }); return; }
    if (!row) {
      // First sign-in for the household: start from whatever this device has, else sample data.
      const initial = this.base ?? readCache() ?? seed();
      const { error: insErr } = await sb.from('household').insert({ id: ROW_ID, data: initial, version: 1 });
      if (insErr && insErr.code !== '23505') {
        this.set({ status: insErr.code === '42501' ? 'forbidden' : 'offline' });
        return;
      }
      return this.pull();
    }
    if (row.version > this.version || !this.base) {
      this.base = migrate(row.data) ?? seed();
      this.version = row.version;
      this.recompute();
    }
    this.set({ status: this.pending.length ? 'saving' : 'synced' });
  }

  private async flush(): Promise<void> {
    if (!this.sb || this.flushing || !this.pending.length) return;
    if (!this.base) { await this.pull(); if (!this.base) return; }
    this.flushing = true;
    const n = this.pending.length;
    const next = clone(this.base);
    this.pending.slice(0, n).forEach(m => m(next));
    const { data: rows, error } = await this.sb
      .from('household')
      .update({ data: next, version: this.version + 1, updated_at: new Date().toISOString() })
      .eq('id', ROW_ID)
      .eq('version', this.version)
      .select('version');
    this.flushing = false;
    const remote = this.remoteWhileFlushing;
    this.remoteWhileFlushing = null;

    if (error) {
      this.set({ status: 'offline' });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), RETRY_DELAY);
      return;
    }
    if (rows && rows.length) {
      this.base = next;
      this.version = rows[0].version;
      this.pending.splice(0, n);
      if (remote) this.receive(remote.data, remote.version);
      else this.recompute();
    } else {
      // Someone else saved first: take their version and replay our edits on it.
      await this.pull();
      if (this.state.status === 'offline') {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), RETRY_DELAY);
        return;
      }
    }
    if (this.pending.length) return this.flush();
    this.set({ status: 'synced' });
  }
}
