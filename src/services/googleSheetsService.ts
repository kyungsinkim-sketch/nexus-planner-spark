/**
 * Google Sheets Service — Frontend integration for bidirectional budget sync.
 *
 * Handles:
 * - Spreadsheet URL parsing
 * - Link/unlink spreadsheet to project
 * - Sync trigger (pull from Sheets, push to Sheets)
 * - Budget link status
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────

export interface BudgetLink {
  id: string;
  projectId: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  lastSyncAt: string | null;
  syncStatus: 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED';
  syncError: string | null;
}

export interface SyncResult {
  success: boolean;
  title?: string;
  sheetCount?: number;
  errors?: string[];
  error?: string;
  needsReauth?: boolean;
}

// ─── URL Parsing ────────────────────────────────────

/**
 * Extract spreadsheet ID from a Google Sheets URL.
 */
export function parseSpreadsheetUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// ─── Budget Link CRUD ───────────────────────────────

/**
 * Get the budget link for a project (if any)
 */
export async function getBudgetLink(projectId: string): Promise<BudgetLink | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('project_budget_links')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      projectId: data.project_id,
      spreadsheetId: data.spreadsheet_id,
      spreadsheetUrl: data.spreadsheet_url,
      lastSyncAt: data.last_sync_at,
      syncStatus: data.sync_status || 'DISCONNECTED',
      syncError: data.sync_error,
    };
  } catch {
    return null;
  }
}

/**
 * Link a Google Spreadsheet to a project and perform initial sync.
 */
export async function linkSpreadsheet(
  userId: string,
  projectId: string,
  spreadsheetUrl: string,
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const spreadsheetId = parseSpreadsheetUrl(spreadsheetUrl);
  if (!spreadsheetId) {
    return { success: false, error: 'Invalid Google Sheets URL' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sheets-sync', {
      body: {
        userId,
        projectId,
        spreadsheetId,
        spreadsheetUrl,
        direction: 'link',
      },
    });

    if (error) {
      console.error('[GoogleSheets] Link error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error === 'SHEETS_SCOPE_MISSING') {
      return { success: false, error: 'Google Sheets permission required.', needsReauth: true };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      title: data?.title,
      sheetCount: data?.sheetCount,
      errors: data?.errors,
    };
  } catch (err) {
    console.error('[GoogleSheets] Link exception:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Sync budget data (pull from Sheets by default)
 */
export async function syncBudget(
  userId: string,
  projectId: string,
  direction: 'pull' | 'push' | 'both' = 'pull',
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sheets-sync', {
      body: { userId, projectId, direction },
    });

    if (error) {
      console.error('[GoogleSheets] Sync error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error === 'SHEETS_SCOPE_MISSING') {
      return { success: false, error: 'Google Sheets permission required.', needsReauth: true };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, errors: data?.errors };
  } catch (err) {
    console.error('[GoogleSheets] Sync exception:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Unlink spreadsheet from project (keeps DB data, removes link)
 */
export async function unlinkSpreadsheet(projectId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('project_budget_links')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
