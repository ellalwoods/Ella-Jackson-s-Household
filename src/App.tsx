import { useEffect, useState, useSyncExternalStore } from 'react';
import { householdKey, rememberHouseholdKey, supabase, supabaseBackend } from './lib/supabase';
import { HouseholdStore } from './lib/store';
import Household from './Household';
import { Logo } from './views/Logo';

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="header"><Logo /></header>
      <p className="empty">{children}</p>
    </div>
  );
}

/** Asks for the household link, e.g. the first time the home-screen app opens on an iPhone. */
function LinkForm({ onKey, wrong }: { onKey: (k: string) => void; wrong?: boolean }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const k = rememberHouseholdKey(text);
    if (k) onKey(k); else setError('That doesn’t look like a household link. Copy the whole link, including the part after #.');
  };
  return (
    <div className="app">
      <header className="header"><Logo /></header>
      <section className="card" style={{ maxWidth: 440, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>{wrong ? 'This household link isn’t right' : 'Open your household'}</div>
        <div style={{ fontSize: 13 }} className="muted">
          {wrong ? 'Check you copied the whole link, then paste it again.' : 'Paste your household link (the one you were sent) to get started. You only need to do this once on each device.'}
        </div>
        <input className="field" value={text} onChange={e => { setText(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="https://…/#…" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url" aria-label="Household link" />
        <button className="pill dark" onClick={submit}>Open household</button>
        {error && <div style={{ fontSize: 13, color: '#A9477B' }}>{error}</div>}
      </section>
    </div>
  );
}

export default function App() {
  const [key, setKey] = useState(householdKey);
  const [wrong, setWrong] = useState(false);
  if (supabase && (!key || wrong)) return <LinkForm wrong={wrong} onKey={k => { setWrong(false); setKey(k); }} />;
  return <Synced key={key ?? 'local'} householdKey={key} onInvalid={() => setWrong(true)} />;
}

function Synced({ householdKey: key, onInvalid }: { householdKey: string | null; onInvalid: () => void }) {
  const [store] = useState(() => new HouseholdStore(supabase && key ? supabaseBackend(supabase, key) : null));
  useEffect(() => { store.start(); return () => store.stop(); }, [store]);
  const { data, status } = useSyncExternalStore(store.subscribe, store.getState);
  useEffect(() => { if (status === 'invalid') onInvalid(); }, [status, onInvalid]);

  if (status === 'invalid') return <Message>Checking your household link…</Message>;
  if (!data && (status === 'offline' || status === 'retrying')) return <Message>Can’t reach your household right now. Check your internet connection; it’ll load as soon as you’re back online.</Message>;
  if (!data) return <Message>Loading…</Message>;
  return <Household data={data} update={m => store.update(m)} status={status} />;
}
