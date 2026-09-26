import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Backend } from './store';
import type { HouseholdData } from './model';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when Supabase isn't configured: the app then keeps data on this device only. */
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

const KEY_STORE = 'hh-link-key';

/**
 * The household key comes from the link (`…/#<key>`). It's remembered so the
 * app still opens if the address loses its `#` part (e.g. some home-screen shortcuts).
 */
export function householdKey(): string | null {
  const fromLink = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  try {
    if (fromLink) { localStorage.setItem(KEY_STORE, fromLink); return fromLink; }
    return localStorage.getItem(KEY_STORE);
  } catch {
    return fromLink || null;
  }
}

/**
 * Accepts a whole household link (…/#key) or just the key. Saves and returns
 * the key, or null if it doesn't look like one.
 */
export function rememberHouseholdKey(input: string): string | null {
  const t = input.trim();
  const k = decodeURIComponent(t.includes('#') ? t.slice(t.indexOf('#') + 1) : t).trim();
  if (!/^[A-Za-z0-9_-]{16,}$/.test(k)) return null;
  try { localStorage.setItem(KEY_STORE, k); } catch { /* storage blocked */ }
  try { history.replaceState(null, '', '#' + k); } catch { /* not available */ }
  return k;
}

async function topicFor(key: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('household:' + key));
  return 'household-' + Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

export function supabaseBackend(sb: SupabaseClient, key: string): Backend {
  let live: RealtimeChannel | null = null;
  return {
    async load() {
      const { data, error } = await sb.rpc('get_household', { p_key: key });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { data: row.data, version: row.version } : 'invalid';
    },
    async save(doc: HouseholdData, expected: number) {
      const { data, error } = await sb.rpc('save_household', { p_key: key, p_data: doc, p_expected: expected });
      if (error) throw error;
      return typeof data === 'number' ? data : null;
    },
    listen(onSaved) {
      let stopped = false, ch: RealtimeChannel | null = null;
      topicFor(key).then(topic => {
        if (stopped) return;
        ch = sb.channel(topic).on('broadcast', { event: 'saved' }, m => onSaved(Number(m.payload?.version) || 0)).subscribe();
        live = ch;
      });
      return () => {
        stopped = true;
        if (!ch) return;
        sb.removeChannel(ch);
        if (live === ch) live = null;
      };
    },
    announce(version) {
      live?.send({ type: 'broadcast', event: 'saved', payload: { version } });
    },
  };
}
