import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── Stale chunk auto-recovery ───
// After Vercel redeploy, old hashed chunks no longer exist.
// Vercel returns index.html (text/html) instead → MIME error.
// Detect this and force a clean reload (once) to pick up the new build.
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('MIME type') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  ) {
    const key = '__chunk_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      console.warn('[ChunkRecovery] Stale chunk detected, reloading...');
      // Unregister SW + clear caches before reload
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs =>
          Promise.all(regs.map(r => r.unregister()))
        ).finally(() => {
          caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .finally(() => window.location.reload());
        });
      } else {
        window.location.reload();
      }
    }
  }
});

// Also catch unhandled promise rejections (dynamic import uses promises)
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason || '');
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('MIME type')) {
    const key = '__chunk_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      console.warn('[ChunkRecovery] Stale chunk (promise), reloading...');
      window.location.reload();
    }
  }
});

// Clear the reload flag on successful load
sessionStorage.removeItem('__chunk_reload');

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
