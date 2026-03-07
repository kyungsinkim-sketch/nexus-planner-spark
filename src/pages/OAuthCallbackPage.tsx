/**
 * OAuthCallbackPage — Minimal page for OAuth popup callbacks.
 *
 * When Slack (or other providers) redirect back with ?code=...,
 * this page shows a brief "Connecting..." message while the parent
 * window reads the URL params via polling.
 *
 * The parent popup-polling code in SlackWidget reads popup.location.href
 * to extract the code, then closes the popup.
 */

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface OAuthCallbackPageProps {
  provider: string;
}

export default function OAuthCallbackPage({ provider }: OAuthCallbackPageProps) {
  useEffect(() => {
    // Auto-close after 10s in case parent polling fails
    const timeout = setTimeout(() => window.close(), 10000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Connecting to {provider.charAt(0).toUpperCase() + provider.slice(1)}...
      </p>
      <p className="text-xs text-muted-foreground/60">
        This window will close automatically.
      </p>
    </div>
  );
}
