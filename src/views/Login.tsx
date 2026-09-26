import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick}>
      <span className="logo-names">
        <span style={{ color: '#A9477B' }}>Ella</span> <em>&amp;</em> <span style={{ color: '#1B6B56' }}>Jackson</span>
      </span>
      <span className="logo-sub">Household</span>
    </button>
  );
}

/** Email sign-in: a magic link, or the 6-digit code from the same email (handy in a home-screen app). */
export default function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const e = email.trim();
    if (!e || !supabase) return;
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };

  const verify = async () => {
    const t = code.trim();
    if (!t || !supabase) return;
    setBusy(true); setError('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: t, type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <div className="app">
      <header className="header"><Logo /></header>
      <section className="card" style={{ maxWidth: 380, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Sign in</div>
        {!sent ? (
          <>
            <div style={{ fontSize: 13 }} className="muted">We’ll email you a sign-in link.</div>
            <input className="field" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="you@example.com" />
            <button className="pill dark" style={{ height: 42 }} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send sign-in link'}</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13 }} className="muted">Check {email.trim()} and tap the link, or enter the code from the email.</div>
            <input className="field" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') verify(); }} placeholder="6-digit code" />
            <button className="pill dark" style={{ height: 42 }} disabled={busy} onClick={verify}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { setSent(false); setCode(''); }}>Use a different email</button>
          </>
        )}
        {error && <div style={{ fontSize: 13, color: '#A9477B' }}>{error}</div>}
      </section>
    </div>
  );
}
