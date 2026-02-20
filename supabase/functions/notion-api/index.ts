/**
 * notion-api — Unified Notion API proxy Edge Function.
 *
 * Handles all Notion API operations through a single endpoint
 * with action-based routing. This avoids creating many small
 * Edge Functions for each Notion operation.
 *
 * Actions:
 *   - search: Search workspace pages/databases
 *   - getPage: Get a single page
 *   - getBlocks: Get page content (blocks)
 *   - queryDatabase: Query a database
 *   - getDatabase: Get database schema
 *   - createPage: Create a new page
 *   - updatePage: Update page properties
 *   - appendBlocks: Append content blocks to a page
 *   - getComments: Get comments on a page
 *   - addComment: Add a comment to a page
 *   - disconnect: Revoke Notion connection
 *   - status: Get connection status
 *   - syncPages: Sync recently edited pages to DB cache
 *
 * Request body: { userId: string, action: string, ...params }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  searchNotion,
  getPage,
  getAllBlocks,
  queryDatabase,
  getDatabase,
  createPage,
  updatePage,
  appendBlocks,
  getComments,
  addComment,
  extractTitle,
  extractIcon,
  blocksToPlainText,
  notionPageToDbRecord,
  type NotionTokenRow,
  type NotionRichText,
} from '../_shared/notion-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return errorResponse('Missing required fields: userId, action');
    }

    // Create Supabase client (service role for token access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ─── Status check (no token needed) ─────────────
    if (action === 'status') {
      const { data: tokenRow } = await supabase
        .from('notion_tokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!tokenRow) {
        return jsonResponse({
          isConnected: false,
          syncStatus: 'DISCONNECTED',
        });
      }

      return jsonResponse({
        isConnected: true,
        syncStatus: tokenRow.sync_status,
        workspaceName: tokenRow.workspace_name,
        workspaceIcon: tokenRow.workspace_icon,
        connectedEmail: tokenRow.connected_email,
        lastSyncAt: tokenRow.last_sync_at,
        autoSync: tokenRow.auto_sync,
      });
    }

    // ─── Disconnect ─────────────────────────────────
    if (action === 'disconnect') {
      // Delete token and all synced pages
      await supabase.from('notion_brain_extractions').delete().eq('user_id', userId);
      await supabase.from('notion_synced_pages').delete().eq('user_id', userId);
      await supabase.from('notion_tokens').delete().eq('user_id', userId);

      return jsonResponse({ success: true });
    }

    // ─── Load token for all other actions ───────────
    const { data: tokenRow, error: tokenError } = await supabase
      .from('notion_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return errorResponse('Notion not connected. Please connect your Notion workspace first.', 401);
    }

    const token = (tokenRow as NotionTokenRow).access_token;

    // ─── Route actions ──────────────────────────────
    switch (action) {
      case 'search': {
        const { query, filter, startCursor, pageSize } = body;
        const results = await searchNotion(token, query, filter, startCursor, pageSize);
        return jsonResponse({
          results: results.results.map(r => ({
            id: r.id,
            object: r.object,
            title: extractTitle(r),
            icon: extractIcon(r),
            url: r.url,
            lastEditedTime: r.last_edited_time,
            parent: r.parent,
          })),
          hasMore: results.has_more,
          nextCursor: results.next_cursor,
        });
      }

      case 'getPage': {
        const { pageId } = body;
        if (!pageId) return errorResponse('Missing pageId');
        const page = await getPage(token, pageId);
        return jsonResponse({
          id: page.id,
          object: page.object,
          title: extractTitle(page),
          icon: extractIcon(page),
          url: page.url,
          properties: page.properties,
          parent: page.parent,
          lastEditedTime: page.last_edited_time,
          archived: page.archived,
        });
      }

      case 'getBlocks': {
        const { blockId, maxDepth } = body;
        if (!blockId) return errorResponse('Missing blockId');
        const blocks = await getAllBlocks(token, blockId, maxDepth || 2);
        const plainText = blocksToPlainText(blocks);
        return jsonResponse({ blocks, plainText });
      }

      case 'queryDatabase': {
        const { databaseId, filter, sorts, startCursor, pageSize } = body;
        if (!databaseId) return errorResponse('Missing databaseId');
        const results = await queryDatabase(token, databaseId, filter, sorts, startCursor, pageSize);
        return jsonResponse({
          results: results.results.map(r => ({
            id: r.id,
            object: r.object,
            title: extractTitle(r),
            icon: extractIcon(r),
            url: r.url,
            properties: r.properties,
            lastEditedTime: r.last_edited_time,
          })),
          hasMore: results.has_more,
          nextCursor: results.next_cursor,
        });
      }

      case 'getDatabase': {
        const { databaseId } = body;
        if (!databaseId) return errorResponse('Missing databaseId');
        const db = await getDatabase(token, databaseId);
        return jsonResponse({
          id: db.id,
          title: extractTitle(db),
          icon: extractIcon(db),
          url: db.url,
          properties: db.properties,
        });
      }

      case 'createPage': {
        const { parent, properties, children } = body;
        if (!parent || !properties) return errorResponse('Missing parent or properties');
        const page = await createPage(token, parent, properties, children);
        return jsonResponse({
          id: page.id,
          title: extractTitle(page),
          url: page.url,
        });
      }

      case 'updatePage': {
        const { pageId, properties } = body;
        if (!pageId || !properties) return errorResponse('Missing pageId or properties');
        const page = await updatePage(token, pageId, properties);
        return jsonResponse({
          id: page.id,
          title: extractTitle(page),
          url: page.url,
        });
      }

      case 'appendBlocks': {
        const { blockId, children } = body;
        if (!blockId || !children) return errorResponse('Missing blockId or children');
        const result = await appendBlocks(token, blockId, children);
        return jsonResponse({ results: result.results });
      }

      case 'getComments': {
        const { blockId, startCursor: commentCursor } = body;
        if (!blockId) return errorResponse('Missing blockId');
        const comments = await getComments(token, blockId, commentCursor);
        return jsonResponse(comments);
      }

      case 'addComment': {
        const { pageId, richText } = body;
        if (!pageId || !richText) return errorResponse('Missing pageId or richText');
        const comment = await addComment(token, pageId, richText as NotionRichText[]);
        return jsonResponse(comment);
      }

      case 'syncPages': {
        // Sync recently edited pages to the local cache
        await supabase
          .from('notion_tokens')
          .update({ sync_status: 'SYNCING' })
          .eq('user_id', userId);

        try {
          // Search for recently edited pages
          const results = await searchNotion(token, '', undefined, undefined, 50);

          let syncedCount = 0;
          for (const item of results.results) {
            const record = notionPageToDbRecord(item, userId);

            // Try to cache content for pages (not databases)
            if (item.object === 'page') {
              try {
                const blocks = await getAllBlocks(token, item.id, 1);
                const plainText = blocksToPlainText(blocks);
                record.cached_content = { blocks, plainText };
                record.cached_at = new Date().toISOString();
              } catch (e) {
                console.warn(`Failed to cache content for ${item.id}:`, e);
              }
            }

            const { error: upsertErr } = await supabase
              .from('notion_synced_pages')
              .upsert(record, { onConflict: 'user_id,notion_page_id' });

            if (!upsertErr) syncedCount++;
          }

          // Update sync status
          await supabase
            .from('notion_tokens')
            .update({
              sync_status: 'CONNECTED',
              last_sync_at: new Date().toISOString(),
              sync_error: null,
            })
            .eq('user_id', userId);

          return jsonResponse({ success: true, syncedCount });
        } catch (syncErr) {
          await supabase
            .from('notion_tokens')
            .update({
              sync_status: 'ERROR',
              sync_error: (syncErr as Error).message,
            })
            .eq('user_id', userId);

          throw syncErr;
        }
      }

      case 'updateAutoSync': {
        const { autoSync } = body;
        await supabase
          .from('notion_tokens')
          .update({ auto_sync: autoSync })
          .eq('user_id', userId);
        return jsonResponse({ success: true });
      }

      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('Notion API error:', err);
    return jsonResponse(
      { error: (err as Error).message },
      500,
    );
  }
});
