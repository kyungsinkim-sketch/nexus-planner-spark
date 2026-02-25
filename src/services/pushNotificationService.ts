/**
 * pushNotificationService.ts — APNs device token registration & notification tap handling.
 *
 * On iOS (Tauri mobile), the Swift layer (`APNsSetup.swift`) injects the device token
 * into the WKWebView via `window.__APNS_DEVICE_TOKEN__` and dispatches a
 * `CustomEvent('apns-token')`. This service listens for that event and upserts the
 * token into the Supabase `device_tokens` table.
 *
 * On Web / Desktop, this service is a no-op (graceful degradation).
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isTauriApp, isMobileApp, getPlatform } from '@/lib/platform';

// ─── Window augmentation ─────────────────────────────
declare global {
  interface Window {
    __APNS_DEVICE_TOKEN__?: string;
    __APNS_TOKEN_ENV__?: string;
    __APNS_NOTIFICATION_TAP__?: (payload: string) => void;
  }
}

// ─── Module state ────────────────────────────────────
let _initialized = false;
let _userId: string | null = null;
let _onNotificationTap: ((payload: Record<string, unknown>) => void) | null = null;

// ─── Token Registration ─────────────────────────────

/**
 * Upsert device token into Supabase `device_tokens` table.
 */
async function registerToken(userId: string, token: string, env?: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const platform = getPlatformForDB();
  const environment = env || 'sandbox';
  const bundleId = 'io.re-be.app';

  try {
    // Check for existing active token
    const { data: existing } = await supabase
      .from('device_tokens')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      // Re-activate & update if needed
      await supabase
        .from('device_tokens')
        .update({
          is_active: true,
          environment,
          platform,
          bundle_id: bundleId,
          app_version: getAppVersion(),
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      console.log('[Push] Token updated:', token.slice(0, 12) + '…');
    } else {
      // Insert new token
      await supabase
        .from('device_tokens')
        .insert({
          user_id: userId,
          token,
          platform,
          environment,
          bundle_id: bundleId,
          device_name: getDeviceName(),
          app_version: getAppVersion(),
          is_active: true,
        });
      console.log('[Push] Token registered:', token.slice(0, 12) + '…');
    }
  } catch (error) {
    console.error('[Push] Token registration failed:', error);
  }
}

/**
 * Deactivate all device tokens for this user on the current device.
 */
export async function deregisterDeviceToken(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const token = window.__APNS_DEVICE_TOKEN__;
  if (!token) return;

  try {
    await supabase
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token', token);
    console.log('[Push] Token deactivated for sign-out');
  } catch (error) {
    console.error('[Push] Token deactivation failed:', error);
  }
}

// ─── Notification Tap Handler ───────────────────────

function setupNotificationTapHandler(): void {
  // The Swift layer calls `window.__APNS_NOTIFICATION_TAP__(payloadJSON)`
  // when the user taps a push notification.
  window.__APNS_NOTIFICATION_TAP__ = (payloadString: string) => {
    try {
      const payload = JSON.parse(payloadString) as Record<string, unknown>;
      console.log('[Push] Notification tapped:', payload);
      _onNotificationTap?.(payload);
    } catch (error) {
      console.error('[Push] Failed to parse notification tap payload:', error);
    }
  };
}

// ─── Initialization ─────────────────────────────────

/**
 * Initialize push notification service after user login.
 *
 * On iOS:
 * - Listens for APNs device token from Swift layer
 * - Registers token in Supabase `device_tokens`
 * - Sets up notification tap handler
 *
 * On Web/Desktop: no-op (graceful).
 *
 * @param userId Authenticated user's UUID
 * @param onTap Callback when user taps a push notification
 */
export function initPushNotifications(
  userId: string,
  onTap?: (payload: Record<string, unknown>) => void,
): void {
  if (_initialized) return;
  if (!isTauriApp()) return; // Web doesn't use APNs

  _userId = userId;
  _onNotificationTap = onTap || null;
  _initialized = true;

  // Setup tap handler
  setupNotificationTapHandler();

  // Check if token is already available (set before JS was ready)
  const existingToken = window.__APNS_DEVICE_TOKEN__;
  if (existingToken && _userId) {
    registerToken(_userId, existingToken, window.__APNS_TOKEN_ENV__);
  }

  // Listen for future token events (e.g., token refresh)
  window.addEventListener('apns-token', ((event: CustomEvent<{ token: string; environment?: string }>) => {
    const { token, environment } = event.detail;
    if (token && _userId) {
      registerToken(_userId, token, environment);
    }
  }) as EventListener);

  console.log('[Push] Service initialized for user:', userId.slice(0, 8) + '…');
}

/**
 * Cleanup push notification service (on sign-out).
 */
export function cleanupPushNotifications(): void {
  _initialized = false;
  _userId = null;
  _onNotificationTap = null;
  window.__APNS_NOTIFICATION_TAP__ = undefined;
}

// ─── Helpers ────────────────────────────────────────

function getPlatformForDB(): string {
  if (!isTauriApp()) return 'web';
  if (isMobileApp()) {
    // Detect iOS vs Android
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    return 'ios';
  }
  return 'macos';
}

function getDeviceName(): string {
  if (isMobileApp()) {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android';
    return 'Mobile';
  }
  return 'Desktop';
}

function getAppVersion(): string {
  return '0.2.0';
}
