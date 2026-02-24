/**
 * Sync Service — Tauri IPC bridge for E2E Encrypted Sync
 *
 * Provides TypeScript interface to the Rust sync module.
 * Falls back gracefully when not running in Tauri (web/PWA mode).
 *
 * Key features:
 * - Export local knowledge as AES-256-GCM encrypted blobs
 * - Import encrypted blobs with Last-Write-Wins merge
 * - Delta sync (only changed items since last sync)
 * - Full export/import for initial device setup
 * - Sync status tracking (enabled, pending changes, last sync)
 *
 * Privacy guarantees:
 * - Sync is OFF by default — user must explicitly enable
 * - Encryption key derived from DID private key (never leaves device)
 * - Server only sees encrypted blobs — cannot read content
 * - Only devices with the same DID can decrypt
 */

import { invokeTauri, isTauriApp } from '@/lib/platform';

// ─── Types ──────────────────────────────────────────────

export interface ExportResult {
  /** Base64-encoded encrypted blob */
  blob: string;
  /** Number of items in the export */
  item_count: number;
  /** Total items in local DB */
  total_count: number;
  /** Whether this was a delta (true) or full export (false) */
  is_delta: boolean;
  /** The `since` timestamp used (null = full export) */
  since: string | null;
  /** Timestamp of this export */
  exported_at: string;
  /** Unencrypted size in bytes */
  raw_size_bytes: number;
  /** Encrypted blob size in bytes */
  blob_size_bytes: number;
}

export interface ImportResult {
  /** Number of items successfully upserted */
  upserted: number;
  /** Number of items skipped (local is newer) */
  skipped: number;
  /** Total items in the incoming delta */
  incoming_count: number;
  /** Timestamp of the import */
  imported_at: string;
}

export interface SyncStatus {
  /** Whether sync is enabled by user */
  enabled: boolean;
  /** Last successful sync timestamp */
  last_sync_at: string | null;
  /** Number of items synced last time */
  last_sync_item_count: number;
  /** Number of items changed since last sync */
  pending_changes: number;
  /** Total items in local DB */
  total_items: number;
  /** The user's DID (for display) */
  did: string | null;
}

// ─── Export ─────────────────────────────────────────────

/**
 * Export knowledge items as an encrypted blob.
 *
 * @param since - If provided, only exports items updated after this ISO timestamp (delta).
 *                If omitted, exports ALL items (full export).
 * @returns Encrypted blob + metadata, or null if not in desktop mode.
 *
 * The blob is AES-256-GCM encrypted with a key derived from the DID private key.
 * Only devices with the same DID (same keypair) can decrypt.
 */
export async function syncExport(since?: string): Promise<ExportResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('sync_export', {
    since: since ?? null,
  });

  return result ? JSON.parse(result) : null;
}

/**
 * Export only items changed since the last sync (delta export).
 * Convenience wrapper around syncExport.
 */
export async function syncExportDelta(): Promise<ExportResult | null> {
  const status = await syncGetStatus();
  if (!status) return null;

  return syncExport(status.last_sync_at ?? undefined);
}

/**
 * Export ALL items (full export for initial device setup).
 * Convenience wrapper around syncExport.
 */
export async function syncExportFull(): Promise<ExportResult | null> {
  return syncExport();
}

// ─── Import ─────────────────────────────────────────────

/**
 * Import an encrypted blob into the local database.
 *
 * Decrypts the blob using the DID private key, then applies
 * Last-Write-Wins merge: items where local is newer are skipped.
 *
 * @param encryptedBlob - Base64-encoded encrypted blob from syncExport
 * @returns Import result with upserted/skipped counts
 */
export async function syncImport(encryptedBlob: string): Promise<ImportResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('sync_import', {
    encrypted_blob: encryptedBlob,
  });

  return result ? JSON.parse(result) : null;
}

// ─── Status & Settings ──────────────────────────────────

/**
 * Get current sync status.
 * Includes enabled state, last sync time, pending changes, etc.
 */
export async function syncGetStatus(): Promise<SyncStatus | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('sync_status');
  return result ? JSON.parse(result) : null;
}

/**
 * Enable or disable sync.
 * Sync is OFF by default. User must explicitly enable it.
 */
export async function syncSetEnabled(enabled: boolean): Promise<void> {
  if (!isTauriApp()) return;

  await invokeTauri<void>('sync_set_enabled', { enabled });
}

/**
 * Get the number of items changed since the last sync.
 */
export async function syncGetPendingCount(): Promise<number> {
  if (!isTauriApp()) return 0;

  return (await invokeTauri<number>('sync_pending_count')) ?? 0;
}

// ─── Utility ────────────────────────────────────────────

/**
 * Check if sync is available (desktop mode + DID identity exists).
 */
export async function isSyncAvailable(): Promise<boolean> {
  if (!isTauriApp()) return false;

  const status = await syncGetStatus();
  return status !== null && status.did !== null;
}

/**
 * Format blob size for display.
 * e.g., "1.2 KB", "3.4 MB"
 */
export function formatBlobSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a sync timestamp for display.
 * Shows relative time (e.g., "5분 전", "2시간 전", "어제")
 */
export function formatSyncTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── Supabase Cloud Sync (Desktop ↔ Mobile) ─────────

const SYNC_BUCKET = 'knowledge-sync';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _syncIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Upload encrypted blob to Supabase Storage.
 * Path: knowledge-sync/{did}/{timestamp}.enc
 */
export async function uploadSyncBlob(
  supabaseClient: { storage: { from: (bucket: string) => { upload: (path: string, data: Blob, options?: object) => Promise<{ data: unknown; error: unknown }> } } },
  did: string,
  exportResult: ExportResult
): Promise<{ path: string } | null> {
  if (!exportResult.blob || exportResult.item_count === 0) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${did}/${timestamp}.enc`;

  const blob = new Blob([exportResult.blob], { type: 'application/octet-stream' });
  const { error } = await supabaseClient.storage
    .from(SYNC_BUCKET)
    .upload(path, blob, { upsert: true });

  if (error) {
    console.error('[Sync] Upload failed:', error);
    return null;
  }

  return { path };
}

/**
 * Download the latest sync blob from Supabase Storage.
 */
export async function downloadLatestSyncBlob(
  supabaseClient: { storage: { from: (bucket: string) => { list: (path: string, options?: object) => Promise<{ data: { name: string }[] | null; error: unknown }>; download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  did: string,
): Promise<string | null> {
  const { data: files, error } = await supabaseClient.storage
    .from(SYNC_BUCKET)
    .list(did, { sortBy: { column: 'created_at', order: 'desc' }, limit: 1 });

  if (error || !files || files.length === 0) return null;

  const latestFile = files[0];
  const { data: blob } = await supabaseClient.storage
    .from(SYNC_BUCKET)
    .download(`${did}/${latestFile.name}`);

  if (!blob) return null;

  return await blob.text();
}

/**
 * Perform a full sync cycle: export → upload → download latest → import.
 * This enables desktop ↔ mobile synchronization.
 */
export async function performCloudSync(
  supabaseClient: { storage: { from: (bucket: string) => unknown } },
): Promise<{ exported: number; imported: number } | null> {
  if (!isTauriApp()) return null;

  const status = await syncGetStatus();
  if (!status?.enabled || !status.did) return null;

  try {
    // 1. Export delta
    const exportResult = await syncExportDelta();
    let exported = 0;

    if (exportResult && exportResult.item_count > 0) {
      await uploadSyncBlob(
        supabaseClient as Parameters<typeof uploadSyncBlob>[0],
        status.did,
        exportResult
      );
      exported = exportResult.item_count;
    }

    // 2. Download and import latest from other devices
    const latestBlob = await downloadLatestSyncBlob(
      supabaseClient as Parameters<typeof downloadLatestSyncBlob>[0],
      status.did
    );
    let imported = 0;

    if (latestBlob) {
      const importResult = await syncImport(latestBlob);
      imported = importResult?.upserted ?? 0;
    }

    return { exported, imported };
  } catch (error) {
    console.error('[Sync] Cloud sync failed:', error);
    return null;
  }
}

/**
 * Start automatic cloud sync at regular intervals.
 * Only runs when sync is enabled and in Tauri app mode.
 */
export function startAutoSync(
  supabaseClient: { storage: { from: (bucket: string) => unknown } },
): void {
  if (_syncIntervalId) return; // Already running

  _syncIntervalId = setInterval(async () => {
    await performCloudSync(supabaseClient);
  }, SYNC_INTERVAL_MS);

  // Run immediately on start
  performCloudSync(supabaseClient);
}

/**
 * Stop automatic cloud sync.
 */
export function stopAutoSync(): void {
  if (_syncIntervalId) {
    clearInterval(_syncIntervalId);
    _syncIntervalId = null;
  }
}
