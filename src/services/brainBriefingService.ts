/**
 * brainBriefingService — Builds and persists the Brain AI daily briefing.
 *
 * Previously the briefing lived only in ephemeral React state plus a
 * `localStorage` "already-shown-today" flag. On any remount (widget re-open,
 * route change, second device login) the flag blocked regeneration while the
 * state was gone, so the briefing permanently vanished from the chat.
 *
 * This service persists the briefing as a Brain→user direct message with a
 * deterministic `<!--briefing:YYYY-MM-DD-->` marker prefix. Idempotency is
 * handled at the database level:
 *
 *   - If a briefing with today's marker already exists for this user, no new
 *     insert happens and the existing row is returned.
 *   - Otherwise a fresh briefing is built, prefixed with the marker, and
 *     inserted via `sendDirectMessage`.
 *
 * Both the desktop `BrainChatWidget` and the mobile `MobileAIChatView` load
 * Brain DM history with `getDirectMessages`, so once the briefing is in the
 * DB it surfaces identically on every device and survives refreshes. The
 * marker is stripped at render time by `stripBriefingMarker` so users never
 * see the HTML comment.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sendDirectMessage, getDirectMessages } from './chatService';
import type { ChatMessage, CalendarEvent, PersonalTodo, AppNotification } from '@/types/core';
import type { Language } from '@/lib/i18n';

// ── Constants ─────────────────────────────────────────────────────────────

export const BRAIN_BOT_ID = '00000000-0000-0000-0000-000000000099';

const BRIEFING_MARKER_OPEN = '<!--briefing:';
const BRIEFING_MARKER_CLOSE = '-->';

/**
 * Briefing schema version. Bump whenever the briefing filter/content logic
 * changes in a way that makes previously-persisted briefings incorrect. The
 * existence check in `ensureTodaysBriefing` will then skip stale rows and
 * regenerate a fresh briefing with the current code.
 *
 * v2 — Fixed TODO filter to exclude todos assigned to other users
 *      (requested-by-me delegations were leaking into my briefing).
 */
const BRIEFING_VERSION = 'v2';

// ── Marker helpers ────────────────────────────────────────────────────────

/** Build the invisible marker for a given KST date key (YYYY-MM-DD). */
export function buildBriefingMarker(dateKey: string): string {
  return `${BRIEFING_MARKER_OPEN}${dateKey}:${BRIEFING_VERSION}${BRIEFING_MARKER_CLOSE}`;
}

/** True if the content string begins with a briefing marker. */
export function isBriefingContent(content: string | null | undefined): boolean {
  return !!content && content.startsWith(BRIEFING_MARKER_OPEN);
}

/** Extract YYYY-MM-DD from a briefing-marked content string, or null. */
export function extractBriefingDate(content: string | null | undefined): string | null {
  if (!isBriefingContent(content)) return null;
  const end = content!.indexOf(BRIEFING_MARKER_CLOSE);
  if (end < 0) return null;
  return content!.slice(BRIEFING_MARKER_OPEN.length, end);
}

/**
 * Remove the leading marker (and its trailing newline) from briefing content
 * so the user sees clean text. Non-briefing content is returned unchanged.
 */
export function stripBriefingMarker(content: string | null | undefined): string {
  if (!content) return '';
  if (!isBriefingContent(content)) return content;
  const end = content.indexOf(BRIEFING_MARKER_CLOSE);
  if (end < 0) return content;
  return content.slice(end + BRIEFING_MARKER_CLOSE.length).replace(/^\n+/, '');
}

/** YYYY-MM-DD in Asia/Seoul — the day the briefing is keyed to. */
export function getTodayKstDateKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// ── Briefing text builder ─────────────────────────────────────────────────

export interface BriefingBuilderInput {
  userName: string;
  language: Language;
  events: CalendarEvent[];
  todos: PersonalTodo[];
  notifications: AppNotification[];
  currentUserId: string;
}

/**
 * Build the human-readable briefing body (no marker prefix). Deterministic
 * given the same inputs, so the DB idempotency key is the date alone — the
 * text can safely be rebuilt on every call before the existence check.
 */
export function buildBriefingText(input: BriefingBuilderInput): string {
  const { userName, language, events, todos, notifications, currentUserId } = input;
  const todayStr = getTodayKstDateKey();

  // Filter events happening today in KST, attended by or owned by the user.
  const todayEvents = events.filter((e) => {
    if (!e.startAt) return false;
    const eDate = new Date(e.startAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    if (eDate !== todayStr) return false;
    const isMine =
      e.ownerId === currentUserId ||
      e.createdBy === currentUserId ||
      e.attendeeIds?.includes(currentUserId);
    return isMine;
  });

  // Pending todos assigned to me (mirrors BrainChatWidget / useBrainBriefing).
  const pendingTodos = todos.filter((t) => {
    const s = (t.status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'DONE' || s === 'CANCELLED') return false;
    if (!t.assigneeIds?.includes(currentUserId)) return false;
    return true;
  });

  const dueTodayTodos = pendingTodos.filter((t) => {
    if (!t.dueDate) return false;
    return (
      new Date(t.dueDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) === todayStr
    );
  });

  const unreadChats = notifications.filter((n) => !n.read && n.type === 'chat');

  // Greeting based on KST hour.
  const kstHour = parseInt(
    new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      hour12: false,
    }),
    10,
  );
  const firstName = userName?.split(' ')[0] || '';
  const isKo = language === 'ko';
  const greeting = kstHour < 12
    ? (isKo ? '🌅 좋은 아침' : '🌅 Good Morning')
    : kstHour < 18
      ? (isKo ? '☀️ 좋은 오후' : '☀️ Good Afternoon')
      : (isKo ? '🌙 좋은 저녁' : '🌙 Good Evening');

  // Deduplicate events by (title, startAt) and sort by start time.
  const seen = new Set<string>();
  const uniqueEvents = todayEvents
    .filter((e) => {
      const key = `${e.title}|${e.startAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''));

  const formatEventTime = (startAt: string) =>
    new Date(startAt).toLocaleTimeString(isKo ? 'ko-KR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
      hour12: !isKo,
    });

  // Build text body.
  let out = `${greeting}, ${firstName}${isKo ? '님' : ''}!\n\n`;

  if (uniqueEvents.length > 0) {
    out += `📅 ${isKo ? '오늘 일정' : "Today's Schedule"} (${uniqueEvents.length}${isKo ? '건' : ''})\n`;
    for (const e of uniqueEvents.slice(0, 5)) {
      const time = e.startAt ? formatEventTime(e.startAt) : '';
      out += `• ${time} ${e.title}\n`;
    }
    out += '\n';
  } else {
    out += `📅 ${isKo ? '오늘 예정된 일정이 없습니다.' : 'No events scheduled for today.'}\n\n`;
  }

  if (pendingTodos.length > 0) {
    out += `✅ ${isKo ? '할 일' : 'To-dos'} (${pendingTodos.length}${isKo ? '건' : ''}`;
    if (dueTodayTodos.length > 0) {
      out += `, ${isKo ? '오늘 마감' : 'due today'} ${dueTodayTodos.length}${isKo ? '건' : ''}`;
    }
    out += ')\n';
    const headlineTodos = dueTodayTodos.length > 0 ? dueTodayTodos : pendingTodos;
    for (const t of headlineTodos.slice(0, 5)) {
      out += `• ${t.title}\n`;
    }
    out += '\n';
  }

  if (unreadChats.length > 0) {
    out += `💬 ${isKo ? `읽지 않은 메시지 ${unreadChats.length}건` : `${unreadChats.length} unread message(s)`}\n\n`;
  }

  out += isKo
    ? '오늘도 좋은 하루 보내세요! 궁금한 게 있으면 언제든 물어보세요 😊'
    : 'Have a great day! Feel free to ask me anything 😊';

  return out;
}

// ── Idempotent DB persistence ─────────────────────────────────────────────

export interface EnsureBriefingResult {
  /** The briefing chat message as it lives in the DB. null when Supabase is unconfigured. */
  message: ChatMessage | null;
  /** True if this call inserted a new row, false if today's briefing already existed. */
  created: boolean;
  /** The full briefing body (no marker), useful for popups/toasts. */
  text: string;
}

/**
 * Ensure today's briefing exists as a persisted Brain→user DM. Safe to call
 * multiple times per day from any device — only the first call inserts.
 */
export async function ensureTodaysBriefing(
  currentUser: { id: string; name?: string | null },
  builderInput: Omit<BriefingBuilderInput, 'userName' | 'currentUserId'>,
): Promise<EnsureBriefingResult> {
  const text = buildBriefingText({
    ...builderInput,
    userName: currentUser.name || '',
    currentUserId: currentUser.id,
  });

  if (!isSupabaseConfigured()) {
    return { message: null, created: false, text };
  }

  const dateKey = getTodayKstDateKey();
  const marker = buildBriefingMarker(dateKey);

  // 1. Existence check — is there already a briefing for today?
  const { data: existing, error: selErr } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', BRAIN_BOT_ID)
    .eq('direct_chat_user_id', currentUser.id)
    .like('content', `${marker}%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (selErr) {
    console.warn('[Briefing] Existence check failed:', selErr);
    return { message: null, created: false, text };
  }

  if (existing && existing.length > 0) {
    const row = existing[0] as Record<string, unknown>;
    const message: ChatMessage = {
      id: row.id as string,
      projectId: (row.project_id as string) || '',
      userId: row.user_id as string,
      directChatUserId: (row.direct_chat_user_id as string) || undefined,
      content: row.content as string,
      createdAt: row.created_at as string,
      messageType: 'text',
    };
    return { message, created: false, text };
  }

  // 2. Insert a new briefing — marker prefix + blank line + body.
  const content = `${marker}\n${text}`;
  try {
    const inserted = await sendDirectMessage(BRAIN_BOT_ID, currentUser.id, content);
    return { message: inserted, created: true, text };
  } catch (err) {
    console.error('[Briefing] Insert failed:', err);
    return { message: null, created: false, text };
  }
}

/**
 * Fetch the most recent briefing for this user from Brain DM history. Returns
 * null if none exists. Used by clients that want to pin the latest briefing
 * in a dedicated display slot (e.g. mobile).
 */
export async function fetchLatestBriefing(userId: string): Promise<ChatMessage | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const history = await getDirectMessages(userId, BRAIN_BOT_ID);
    for (let i = history.length - 1; i >= 0; i--) {
      if (isBriefingContent(history[i].content)) return history[i];
    }
    return null;
  } catch (err) {
    console.error('[Briefing] fetchLatestBriefing failed:', err);
    return null;
  }
}
