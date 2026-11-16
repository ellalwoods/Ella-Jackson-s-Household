import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable, offline-capable app (see public/sw.js). Only in the built site.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(r => r.update()).catch(() => {}); });
}

/**
 * An app saved to the home screen can stay open for days. Whenever it comes back on screen,
 * check whether a newer version has been published and, if so, load it.
 */
if (import.meta.env.PROD) {
  const current = () => document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src') ?? '';
  const check = async () => {
    try {
      const html = await (await fetch('./index.html', { cache: 'no-store' })).text();
      const latest = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1] ?? html.match(/<script[^>]+src="([^"]+)"[^>]+type="module"/)?.[1];
      if (!latest || latest === current()) return;
      // Reload once per new version, so a bad response can never loop.
      if (sessionStorage.getItem('hh-reloaded-for') === latest) return;
      sessionStorage.setItem('hh-reloaded-for', latest);
      location.reload();
    } catch { /* offline: keep what we have */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('load', () => { setTimeout(check, 1500); });
}
