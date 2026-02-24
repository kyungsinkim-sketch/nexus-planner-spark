/**
 * Platform detection utilities for Re-Be.io
 *
 * Detects whether the app is running in:
 * - Tauri desktop app (macOS / Windows / Linux)
 * - Tauri mobile app (iOS / Android)
 * - Web browser (PWA or regular)
 *
 * Routes RAG queries to local (Tauri IPC) vs server (Supabase Edge Functions).
 */

/**
 * Check if running inside a Tauri app (desktop or mobile).
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Check if running inside a Tauri desktop app.
 */
export function isDesktopApp(): boolean {
  if (!isTauriApp()) return false;
  // On mobile, navigator.maxTouchPoints is typically > 0 and screen is small
  // But Tauri also sets different user agent patterns
  const isMobileScreen = window.innerWidth < 768;
  const isTouchDevice = 'ontouchstart' in window && navigator.maxTouchPoints > 1;
  return !(isMobileScreen && isTouchDevice);
}

/**
 * Check if running inside a Tauri mobile app (iOS/Android).
 */
export function isMobileApp(): boolean {
  if (!isTauriApp()) return false;
  return !isDesktopApp();
}

/**
 * Check if local RAG is available and initialized.
 * Returns true when running in Tauri (desktop or mobile) and the local DB is ready.
 */
let _localRAGReady: boolean | null = null;

export async function isLocalRAGEnabled(): Promise<boolean> {
  if (!isTauriApp()) return false;
  if (_localRAGReady !== null) return _localRAGReady;

  try {
    const result = await invokeTauri<string>('rag_stats');
    if (result) {
      const stats = JSON.parse(result);
      _localRAGReady = stats.initialized === true;
      return _localRAGReady;
    }
  } catch {
    _localRAGReady = false;
  }
  return false;
}

/**
 * Synchronous check — use after first async check has completed.
 */
export function isLocalRAGReady(): boolean {
  return _localRAGReady === true;
}

/**
 * Reset local RAG readiness (e.g. after DB re-initialization).
 */
export function resetLocalRAGStatus(): void {
  _localRAGReady = null;
}

/**
 * Get the current platform string.
 */
export function getPlatform(): 'desktop' | 'mobile' | 'web' {
  if (!isTauriApp()) return 'web';
  return isDesktopApp() ? 'desktop' : 'mobile';
}

/**
 * Invoke a Tauri IPC command with type safety.
 * Returns null if not running in Tauri (graceful degradation for web).
 */
export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauriApp()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (error) {
    console.warn(`[Tauri IPC] Command "${command}" failed:`, error);
    return null;
  }
}
