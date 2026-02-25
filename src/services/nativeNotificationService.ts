/**
 * Native Notification Service — macOS Notification Center + Dock Badge
 *
 * Bridges the existing AppNotification system to native OS notifications.
 * When running in Tauri desktop mode:
 * - Pushes notifications to macOS Notification Center
 * - Updates Dock icon badge with unread count
 * - Handles notification click → focus app window
 *
 * Falls back gracefully to no-ops when running in web/PWA mode.
 */

import { isTauriApp, invokeTauri } from '@/lib/platform';

// ─── Notification Permission ────────────────────────────

let _permissionGranted = false;
let _initialized = false;

/**
 * Initialize native notification system.
 * Call once on app startup.
 * Requests permission and sets up click handler.
 */
export async function initNativeNotifications(): Promise<boolean> {
  if (!isTauriApp() || _initialized) return _permissionGranted;

  try {
    const {
      isPermissionGranted,
      requestPermission,
    } = await import('@tauri-apps/plugin-notification');

    _permissionGranted = await isPermissionGranted();

    if (!_permissionGranted) {
      const permission = await requestPermission();
      _permissionGranted = permission === 'granted';
    }

    _initialized = true;
    console.log('[NativeNotif] Initialized, permission:', _permissionGranted);
    return _permissionGranted;
  } catch (error) {
    console.warn('[NativeNotif] Init failed:', error);
    return false;
  }
}

// ─── Send Notification ──────────────────────────────────

export type NotificationType = 'chat' | 'todo' | 'event' | 'brain' | 'company';

interface NativeNotificationOptions {
  title: string;
  body: string;
  type?: NotificationType;
  /** Optional group ID for stacking similar notifications */
  group?: string;
}

/**
 * Send a native macOS notification.
 *
 * Shows in macOS Notification Center with the app icon.
 * Clicking the notification will focus the app window.
 */
export async function sendNativeNotification(
  options: NativeNotificationOptions
): Promise<void> {
  if (!isTauriApp() || !_permissionGranted) return;

  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');

    sendNotification({
      title: options.title,
      body: options.body,
      sound: 'default',
      ...(options.group ? { group: options.group } : {}),
    });

    console.log('[NativeNotif] Sent:', options.title);
  } catch (error) {
    console.warn('[NativeNotif] Send failed:', error);
  }
}

/**
 * Send a chat notification with sender name and message preview.
 */
export async function sendChatNotification(
  senderName: string,
  messagePreview: string,
  projectName?: string
): Promise<void> {
  const title = projectName
    ? `${senderName} · ${projectName}`
    : senderName;

  await sendNativeNotification({
    title,
    body: messagePreview,
    type: 'chat',
    group: 'chat',
  });
}

/**
 * Send a todo notification.
 */
export async function sendTodoNotification(
  todoTitle: string,
  dueDate?: string
): Promise<void> {
  await sendNativeNotification({
    title: todoTitle,
    body: dueDate ? `마감: ${dueDate}` : '새 할 일이 할당되었습니다',
    type: 'todo',
    group: 'todo',
  });
}

/**
 * Send a calendar event notification.
 */
export async function sendEventNotification(
  eventTitle: string,
  eventTime: string
): Promise<void> {
  await sendNativeNotification({
    title: eventTitle,
    body: eventTime,
    type: 'event',
    group: 'event',
  });
}

// ─── Dock Badge ─────────────────────────────────────────

let _currentBadgeCount = 0;

/**
 * Set the Dock icon badge count.
 * Pass 0 to clear the badge.
 *
 * Shows a red circle with the number on the app's Dock icon.
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (!isTauriApp()) return;

  // Avoid redundant IPC calls
  if (count === _currentBadgeCount) return;
  _currentBadgeCount = count;

  await invokeTauri<void>('set_badge_count', { count });
}

/**
 * Clear the Dock badge.
 */
export async function clearBadge(): Promise<void> {
  await setBadgeCount(0);
}

/**
 * Update badge count based on unread notification count.
 * Call this whenever notifications change.
 */
export async function updateBadgeFromUnreadCount(unreadCount: number): Promise<void> {
  await setBadgeCount(unreadCount);
}

// ─── Window Focus ───────────────────────────────────────

/**
 * Bring the app window to foreground.
 * Used when user clicks a native notification.
 */
export async function focusAppWindow(): Promise<void> {
  if (!isTauriApp()) return;
  await invokeTauri<void>('focus_window');
}

// ─── App Visibility ─────────────────────────────────────

let _isAppFocused = true;

/**
 * Track app focus state.
 * Native notifications should only be sent when app is NOT focused.
 */
export function setupFocusTracking(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('focus', () => {
    _isAppFocused = true;
    // Clear badge when user focuses the app
    clearBadge();
  });

  window.addEventListener('blur', () => {
    _isAppFocused = false;
  });

  // Also handle document visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      _isAppFocused = true;
      clearBadge();
    } else {
      _isAppFocused = false;
    }
  });
}

/**
 * Check if the app is currently focused.
 * Used to decide whether to show native notification.
 */
export function isAppFocused(): boolean {
  return _isAppFocused;
}

/**
 * Conditionally send a native notification only when app is NOT focused.
 * This prevents duplicate notifications when user is already looking at the app.
 */
export async function sendNotificationIfBackground(
  options: NativeNotificationOptions
): Promise<void> {
  if (_isAppFocused) return;
  await sendNativeNotification(options);
}
