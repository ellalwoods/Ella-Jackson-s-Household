import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { HouseholdStore } from './lib/store';
import Household from './Household';
import Login, { Logo } from './views/Login';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <Synced userId="local" />;
  if (session === undefined) return <div className="app" />;
  if (!session) return <Login />;
  return <Synced key={session.user.id} userId={session.user.id} />;
}

function Synced({ userId }: { userId: string }) {
  const [store] = useState(() => new HouseholdStore(supabase));
  useEffect(() => { store.start(); return () => store.stop(); }, [store]);
  const { data, status } = useSyncExternalStore(store.subscribe, store.getState);
  const signOut = supabase ? () => { supabase!.auth.signOut(); } : undefined;

  if (status === 'forbidden') {
    return (
      <div className="app">
        <header className="header"><Logo /></header>
        <p className="empty">This email isn’t part of the household. Ask for it to be added, then sign in again.</p>
        <button className="pill" onClick={signOut}>Sign out</button>
      </div>
    );
  }
  if (!data) return <div className="app"><header className="header"><Logo /></header><p className="empty">Loading…</p></div>;
  return <Household key={userId} data={data} update={m => store.update(m)} status={status} onSignOut={signOut} />;
}
