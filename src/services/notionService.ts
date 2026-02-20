/**
 * Notion Service — Frontend integration for Notion OAuth and API.
 *
 * Handles:
 * - OAuth consent URL generation
 * - OAuth callback processing (via Edge Function)
 * - Workspace search, page reading, content editing
 * - Page sync and caching
 * - Connection status and disconnect
 *
 * Pattern follows googleCalendarService.ts
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ─── Configuration ──────────────────────────────────

const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID || '';

/**
 * Check if Notion OAuth is configured
 */
export function isNotionConfigured(): boolean {
  return Boolean(NOTION_CLIENT_ID);
}

/**
 * Get the OAuth redirect URI
 */
function getRedirectUri(): string {
  return `${window.location.origin}/settings`;
}

// ─── Types ──────────────────────────────────────────

export interface NotionConnectionStatus {
  isConnected: boolean;
  syncStatus: 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED';
  workspaceName?: string;
  workspaceIcon?: string;
  connectedEmail?: string;
  lastSyncAt?: string;
  autoSync?: boolean;
}

export interface NotionPageItem {
  id: string;
  object: 'page' | 'database';
  title: string;
  icon: string | null;
  url: string;
  lastEditedTime: string;
  parent?: { type: string; workspace?: boolean; page_id?: string; database_id?: string };
}

export interface NotionPageContent {
  blocks: unknown[];
  plainText: string;
}

export interface NotionPageDetail {
  id: string;
  object: string;
  title: string;
  icon: string | null;
  url: string;
  properties: Record<string, unknown>;
  parent: Record<string, unknown>;
  lastEditedTime: string;
  archived: boolean;
}

export interface NotionDatabaseSchema {
  id: string;
  title: string;
  icon: string | null;
  url: string;
  properties: Record<string, { id: string; type: string; name: string }>;
}

export interface NotionSyncedPage {
  id: string;
  notion_page_id: string;
  notion_object_type: 'page' | 'database';
  title: string;
  icon: string | null;
  url: string;
  is_pinned: boolean;
  project_id: string | null;
  last_edited_at: string | null;
  cached_content: { blocks: unknown[]; plainText: string } | null;
  cached_at: string | null;
}

// ─── Helper ─────────────────────────────────────────

async function notionApiCall<T>(
  action: string,
  userId: string,
  params: Record<string, unknown> = {},
): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('notion-api', {
      body: { userId, action, ...params },
    });

    if (error) {
      console.error(`[Notion] ${action} error:`, error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, data: data as T };
  } catch (err) {
    console.error(`[Notion] ${action} exception:`, err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── OAuth Flow ─────────────────────────────────────

/**
 * Generate the Notion OAuth consent URL and redirect the user.
 * Notion uses a simpler OAuth flow with public integration.
 */
export function startNotionOAuth(userId: string): void {
  if (!NOTION_CLIENT_ID) {
    throw new Error('Notion not configured. Set VITE_NOTION_CLIENT_ID in .env');
  }

  const params = new URLSearchParams({
    client_id: NOTION_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    owner: 'user',
    state: userId,
  });

  window.location.href = `https://api.notion.com/v1/oauth/authorize?${params}`;
}

/**
 * Handle the OAuth callback by exchanging the authorization code.
 */
export async function handleNotionOAuthCallback(
  code: string,
  userId: string,
): Promise<{ success: boolean; workspaceName?: string; email?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('notion-auth-callback', {
      body: {
        code,
        redirectUri: getRedirectUri(),
        userId,
      },
    });

    if (error) {
      console.error('[Notion] OAuth callback error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      workspaceName: data?.workspaceName,
      email: data?.email,
    };
  } catch (err) {
    console.error('[Notion] OAuth callback exception:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── Connection Status ──────────────────────────────

/**
 * Get Notion connection status.
 */
export async function getNotionStatus(userId: string): Promise<NotionConnectionStatus> {
  const defaultStatus: NotionConnectionStatus = {
    isConnected: false,
    syncStatus: 'DISCONNECTED',
  };

  const result = await notionApiCall<NotionConnectionStatus>('status', userId);
  return result.success && result.data ? result.data : defaultStatus;
}

/**
 * Disconnect Notion integration.
 */
export async function disconnectNotion(userId: string): Promise<{ success: boolean; error?: string }> {
  return notionApiCall('disconnect', userId);
}

// ─── Workspace Search ───────────────────────────────

/**
 * Search across workspace pages and databases.
 */
export async function searchNotionWorkspace(
  userId: string,
  query: string = '',
  objectType?: 'page' | 'database',
  startCursor?: string,
): Promise<{ results: NotionPageItem[]; hasMore: boolean; nextCursor: string | null }> {
  const filter = objectType ? { property: 'object', value: objectType } : undefined;
  const result = await notionApiCall<{
    results: NotionPageItem[];
    hasMore: boolean;
    nextCursor: string | null;
  }>('search', userId, { query, filter, startCursor });

  return result.success && result.data
    ? result.data
    : { results: [], hasMore: false, nextCursor: null };
}

// ─── Page Operations ────────────────────────────────

/**
 * Get a single page with its properties.
 */
export async function getNotionPage(userId: string, pageId: string): Promise<NotionPageDetail | null> {
  const result = await notionApiCall<NotionPageDetail>('getPage', userId, { pageId });
  return result.success ? result.data || null : null;
}

/**
 * Get page content (blocks) as structured data + plain text.
 */
export async function getNotionPageContent(
  userId: string,
  blockId: string,
  maxDepth: number = 2,
): Promise<NotionPageContent | null> {
  const result = await notionApiCall<NotionPageContent>('getBlocks', userId, { blockId, maxDepth });
  return result.success ? result.data || null : null;
}

/**
 * Create a new page.
 */
export async function createNotionPage(
  userId: string,
  parent: { page_id: string } | { database_id: string },
  properties: Record<string, unknown>,
  children?: unknown[],
): Promise<{ id: string; title: string; url: string } | null> {
  const result = await notionApiCall<{ id: string; title: string; url: string }>(
    'createPage', userId, { parent, properties, children },
  );
  return result.success ? result.data || null : null;
}

/**
 * Update page properties.
 */
export async function updateNotionPage(
  userId: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<{ id: string; title: string; url: string } | null> {
  const result = await notionApiCall<{ id: string; title: string; url: string }>(
    'updatePage', userId, { pageId, properties },
  );
  return result.success ? result.data || null : null;
}

/**
 * Append content blocks to a page.
 */
export async function appendNotionBlocks(
  userId: string,
  blockId: string,
  children: unknown[],
): Promise<boolean> {
  const result = await notionApiCall('appendBlocks', userId, { blockId, children });
  return result.success;
}

// ─── Database Operations ────────────────────────────

/**
 * Get database schema.
 */
export async function getNotionDatabase(
  userId: string,
  databaseId: string,
): Promise<NotionDatabaseSchema | null> {
  const result = await notionApiCall<NotionDatabaseSchema>('getDatabase', userId, { databaseId });
  return result.success ? result.data || null : null;
}

/**
 * Query a database with optional filters and sorts.
 */
export async function queryNotionDatabase(
  userId: string,
  databaseId: string,
  filter?: Record<string, unknown>,
  sorts?: Array<{ property?: string; timestamp?: string; direction: string }>,
  startCursor?: string,
): Promise<{ results: NotionPageItem[]; hasMore: boolean; nextCursor: string | null }> {
  const result = await notionApiCall<{
    results: NotionPageItem[];
    hasMore: boolean;
    nextCursor: string | null;
  }>('queryDatabase', userId, { databaseId, filter, sorts, startCursor });

  return result.success && result.data
    ? result.data
    : { results: [], hasMore: false, nextCursor: null };
}

// ─── Comments ───────────────────────────────────────

/**
 * Get comments on a page or block.
 */
export async function getNotionComments(
  userId: string,
  blockId: string,
): Promise<unknown[]> {
  const result = await notionApiCall<{ results: unknown[] }>('getComments', userId, { blockId });
  return result.success && result.data ? result.data.results : [];
}

/**
 * Add a comment to a page.
 */
export async function addNotionComment(
  userId: string,
  pageId: string,
  text: string,
): Promise<boolean> {
  const richText = [{
    type: 'text',
    text: { content: text },
  }];
  const result = await notionApiCall('addComment', userId, { pageId, richText });
  return result.success;
}

// ─── Sync & Cache ───────────────────────────────────

/**
 * Trigger a full sync of recently edited pages.
 */
export async function syncNotionPages(
  userId: string,
): Promise<{ success: boolean; syncedCount?: number; error?: string }> {
  return notionApiCall<{ syncedCount: number }>('syncPages', userId);
}

/**
 * Get locally cached/pinned pages from DB.
 */
export async function getSyncedPages(
  userId: string,
  projectId?: string,
): Promise<NotionSyncedPage[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    let query = supabase
      .from('notion_synced_pages')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('last_edited_at', { ascending: false, nullsFirst: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Notion] getSyncedPages error:', error);
      return [];
    }

    return (data || []) as NotionSyncedPage[];
  } catch (err) {
    console.error('[Notion] getSyncedPages exception:', err);
    return [];
  }
}

/**
 * Pin/unpin a synced page.
 */
export async function togglePinPage(
  userId: string,
  notionPageId: string,
  isPinned: boolean,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('notion_synced_pages')
    .update({ is_pinned: isPinned })
    .eq('user_id', userId)
    .eq('notion_page_id', notionPageId);

  return !error;
}

/**
 * Link a synced page to a Re-Be project.
 */
export async function linkPageToProject(
  userId: string,
  notionPageId: string,
  projectId: string | null,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('notion_synced_pages')
    .update({ project_id: projectId })
    .eq('user_id', userId)
    .eq('notion_page_id', notionPageId);

  return !error;
}

/**
 * Update auto-sync setting.
 */
export async function updateNotionAutoSync(userId: string, autoSync: boolean): Promise<boolean> {
  const result = await notionApiCall('updateAutoSync', userId, { autoSync });
  return result.success;
}
