import { useEffect, useState, useSyncExternalStore } from 'react';
import { householdKey, supabase, supabaseBackend } from './lib/supabase';
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

export default function App() {
  const [key] = useState(householdKey);
  if (supabase && !key) return <Message>Open the app with your household link.</Message>;
  return <Synced householdKey={key} />;
}

function Synced({ householdKey: key }: { householdKey: string | null }) {
  const [store] = useState(() => new HouseholdStore(supabase && key ? supabaseBackend(supabase, key) : null));
  useEffect(() => { store.start(); return () => store.stop(); }, [store]);
  const { data, status } = useSyncExternalStore(store.subscribe, store.getState);

  if (status === 'invalid') return <Message>This household link isn’t right. Check you copied the whole link, including the part after #.</Message>;
  if (!data) return <Message>Loading…</Message>;
  return <Household data={data} update={m => store.update(m)} status={status} />;
}
