/**
 * Notion API client utility for Edge Functions.
 * Handles OAuth token exchange, API calls, and data transformation.
 *
 * Notion API v1 (2022-06-28) — uses Bearer token auth.
 * Unlike Google, Notion uses a single access_token (no refresh_token).
 * The token is valid indefinitely until the user revokes access.
 */

// ─── Types ──────────────────────────────────────────

export interface NotionTokenRow {
  id: string;
  user_id: string;
  access_token: string;
  bot_id: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_icon: string | null;
  connected_email: string | null;
  token_type: string;
  last_sync_at: string | null;
  sync_status: string;
  sync_error: string | null;
  auto_sync: boolean;
}

export interface NotionOAuthResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  duplicated_template_id: string | null;
  request_id: string;
  owner: {
    type: string;
    user?: {
      id: string;
      name: string;
      avatar_url: string | null;
      type: string;
      person?: { email: string };
    };
  };
}

export interface NotionPage {
  id: string;
  object: 'page' | 'database';
  created_time: string;
  last_edited_time: string;
  parent: {
    type: string;
    workspace?: boolean;
    page_id?: string;
    database_id?: string;
  };
  archived: boolean;
  url: string;
  icon?: { type: string; emoji?: string; external?: { url: string } };
  properties: Record<string, NotionProperty>;
}

export interface NotionDatabase {
  id: string;
  object: 'database';
  title: NotionRichText[];
  created_time: string;
  last_edited_time: string;
  parent: {
    type: string;
    workspace?: boolean;
    page_id?: string;
  };
  archived: boolean;
  url: string;
  icon?: { type: string; emoji?: string; external?: { url: string } };
  properties: Record<string, { id: string; type: string; name: string }>;
}

export interface NotionRichText {
  type: string;
  text?: { content: string; link?: { url: string } | null };
  plain_text: string;
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
}

export interface NotionBlock {
  id: string;
  object: 'block';
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  // Dynamic block type content
  [key: string]: unknown;
}

export interface NotionProperty {
  id: string;
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  number?: number;
  select?: { name: string; color: string } | null;
  multi_select?: { name: string; color: string }[];
  date?: { start: string; end?: string | null } | null;
  checkbox?: boolean;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  status?: { name: string; color: string } | null;
}

export interface NotionSearchResult {
  object: 'list';
  results: (NotionPage | NotionDatabase)[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionBlockChildren {
  object: 'list';
  results: NotionBlock[];
  next_cursor: string | null;
  has_more: boolean;
}

// ─── Environment ────────────────────────────────────

export function getNotionConfig() {
  const clientId = Deno.env.get('NOTION_CLIENT_ID');
  const clientSecret = Deno.env.get('NOTION_CLIENT_SECRET');
  const redirectUri = Deno.env.get('NOTION_REDIRECT_URI');

  if (!clientId || !clientSecret) {
    throw new Error('Notion OAuth credentials not configured (NOTION_CLIENT_ID, NOTION_CLIENT_SECRET)');
  }

  return { clientId, clientSecret, redirectUri: redirectUri || '' };
}

// ─── OAuth Token Exchange ───────────────────────────

/**
 * Exchange authorization code for Notion access token.
 * Notion uses HTTP Basic Auth (client_id:client_secret) for token exchange.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<NotionOAuthResponse> {
  const { clientId, clientSecret } = getNotionConfig();

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion token exchange failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionOAuthResponse;
}

// ─── Notion API Helpers ─────────────────────────────

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

function notionHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  };
}

/**
 * Search across all pages and databases the integration has access to.
 */
export async function searchNotion(
  accessToken: string,
  query: string = '',
  filter?: { property: 'object'; value: 'page' | 'database' },
  startCursor?: string,
  pageSize: number = 20,
): Promise<NotionSearchResult> {
  const body: Record<string, unknown> = { page_size: pageSize };
  if (query) body.query = query;
  if (filter) body.filter = filter;
  if (startCursor) body.start_cursor = startCursor;

  const res = await fetch(`${NOTION_API_BASE}/search`, {
    method: 'POST',
    headers: notionHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion search failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionSearchResult;
}

/**
 * Get a single page by ID.
 */
export async function getPage(
  accessToken: string,
  pageId: string,
): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
    headers: notionHeaders(accessToken),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion get page failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionPage;
}

/**
 * Get page content (blocks / children).
 */
export async function getBlockChildren(
  accessToken: string,
  blockId: string,
  startCursor?: string,
  pageSize: number = 100,
): Promise<NotionBlockChildren> {
  const params = new URLSearchParams({ page_size: pageSize.toString() });
  if (startCursor) params.set('start_cursor', startCursor);

  const res = await fetch(
    `${NOTION_API_BASE}/blocks/${blockId}/children?${params}`,
    { headers: notionHeaders(accessToken) },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion get blocks failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionBlockChildren;
}

/**
 * Get all blocks for a page (handles pagination).
 */
export async function getAllBlocks(
  accessToken: string,
  blockId: string,
  maxDepth: number = 2,
  currentDepth: number = 0,
): Promise<NotionBlock[]> {
  const allBlocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await getBlockChildren(accessToken, blockId, cursor);
    allBlocks.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // Recursively fetch children for nested blocks
  if (currentDepth < maxDepth) {
    for (const block of allBlocks) {
      if (block.has_children) {
        const children = await getAllBlocks(accessToken, block.id, maxDepth, currentDepth + 1);
        (block as Record<string, unknown>)._children = children;
      }
    }
  }

  return allBlocks;
}

/**
 * Query a database.
 */
export async function queryDatabase(
  accessToken: string,
  databaseId: string,
  filter?: Record<string, unknown>,
  sorts?: Array<{ property?: string; timestamp?: string; direction: string }>,
  startCursor?: string,
  pageSize: number = 50,
): Promise<NotionSearchResult> {
  const body: Record<string, unknown> = { page_size: pageSize };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;
  if (startCursor) body.start_cursor = startCursor;

  const res = await fetch(`${NOTION_API_BASE}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: notionHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query database failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionSearchResult;
}

/**
 * Get a database schema.
 */
export async function getDatabase(
  accessToken: string,
  databaseId: string,
): Promise<NotionDatabase> {
  const res = await fetch(`${NOTION_API_BASE}/databases/${databaseId}`, {
    headers: notionHeaders(accessToken),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion get database failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionDatabase;
}

/**
 * Create a new page in a parent (page or database).
 */
export async function createPage(
  accessToken: string,
  parent: { page_id: string } | { database_id: string },
  properties: Record<string, unknown>,
  children?: unknown[],
): Promise<NotionPage> {
  const body: Record<string, unknown> = { parent, properties };
  if (children?.length) body.children = children;

  const res = await fetch(`${NOTION_API_BASE}/pages`, {
    method: 'POST',
    headers: notionHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion create page failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionPage;
}

/**
 * Update page properties.
 */
export async function updatePage(
  accessToken: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(accessToken),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion update page failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionPage;
}

/**
 * Append blocks (content) to a page.
 */
export async function appendBlocks(
  accessToken: string,
  blockId: string,
  children: unknown[],
): Promise<NotionBlockChildren> {
  const res = await fetch(`${NOTION_API_BASE}/blocks/${blockId}/children`, {
    method: 'PATCH',
    headers: notionHeaders(accessToken),
    body: JSON.stringify({ children }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion append blocks failed: ${res.status} ${err}`);
  }

  return await res.json() as NotionBlockChildren;
}

/**
 * Get comments on a page or block.
 */
export async function getComments(
  accessToken: string,
  blockId: string,
  startCursor?: string,
): Promise<{ results: unknown[]; has_more: boolean; next_cursor: string | null }> {
  const params = new URLSearchParams({ block_id: blockId });
  if (startCursor) params.set('start_cursor', startCursor);

  const res = await fetch(`${NOTION_API_BASE}/comments?${params}`, {
    headers: notionHeaders(accessToken),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion get comments failed: ${res.status} ${err}`);
  }

  return await res.json();
}

/**
 * Add a comment to a page.
 */
export async function addComment(
  accessToken: string,
  pageId: string,
  richText: NotionRichText[],
): Promise<unknown> {
  const res = await fetch(`${NOTION_API_BASE}/comments`, {
    method: 'POST',
    headers: notionHeaders(accessToken),
    body: JSON.stringify({
      parent: { page_id: pageId },
      rich_text: richText,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion add comment failed: ${res.status} ${err}`);
  }

  return await res.json();
}

// ─── Data Extraction Helpers ────────────────────────

/**
 * Extract plain text title from a Notion page or database.
 */
export function extractTitle(item: NotionPage | NotionDatabase): string {
  // Database — has a top-level title array
  if ('title' in item && Array.isArray((item as NotionDatabase).title)) {
    return (item as NotionDatabase).title.map(t => t.plain_text).join('') || 'Untitled';
  }

  // Page — title is in properties
  for (const prop of Object.values(item.properties || {})) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map((t: NotionRichText) => t.plain_text).join('') || 'Untitled';
    }
  }

  return 'Untitled';
}

/**
 * Extract icon (emoji or URL) from a Notion page/database.
 */
export function extractIcon(item: NotionPage | NotionDatabase): string | null {
  if (!item.icon) return null;
  if (item.icon.type === 'emoji') return item.icon.emoji || null;
  if (item.icon.type === 'external') return item.icon.external?.url || null;
  return null;
}

/**
 * Convert Notion blocks to plain text (for caching and Brain analysis).
 */
export function blocksToPlainText(blocks: NotionBlock[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const typedContent = block[block.type] as Record<string, unknown> | undefined;
    if (!typedContent) continue;

    // Extract rich_text from common block types
    const richText = typedContent.rich_text as NotionRichText[] | undefined;
    if (richText?.length) {
      const text = richText.map(t => t.plain_text).join('');

      switch (block.type) {
        case 'heading_1':
          lines.push(`# ${text}`);
          break;
        case 'heading_2':
          lines.push(`## ${text}`);
          break;
        case 'heading_3':
          lines.push(`### ${text}`);
          break;
        case 'bulleted_list_item':
          lines.push(`- ${text}`);
          break;
        case 'numbered_list_item':
          lines.push(`1. ${text}`);
          break;
        case 'to_do': {
          const checked = (typedContent.checked as boolean) ? '[x]' : '[ ]';
          lines.push(`${checked} ${text}`);
          break;
        }
        case 'toggle':
          lines.push(`> ${text}`);
          break;
        case 'quote':
          lines.push(`> ${text}`);
          break;
        case 'callout':
          lines.push(`> ${text}`);
          break;
        default:
          lines.push(text);
      }
    }

    // Handle child blocks recursively
    const children = (block as Record<string, unknown>)._children as NotionBlock[] | undefined;
    if (children?.length) {
      const childText = blocksToPlainText(children);
      if (childText) {
        lines.push(childText.split('\n').map(l => `  ${l}`).join('\n'));
      }
    }
  }

  return lines.join('\n');
}

/**
 * Convert a Notion page to a DB-ready synced page record.
 */
export function notionPageToDbRecord(
  page: NotionPage | NotionDatabase,
  userId: string,
): Record<string, unknown> {
  return {
    user_id: userId,
    notion_page_id: page.id.replace(/-/g, ''),
    notion_object_type: page.object,
    title: extractTitle(page),
    icon: extractIcon(page),
    parent_type: page.parent.type,
    parent_id: page.parent.page_id || page.parent.database_id || (page.parent.workspace ? 'workspace' : null),
    url: page.url,
    last_edited_at: 'last_edited_time' in page ? page.last_edited_time : null,
  };
}
