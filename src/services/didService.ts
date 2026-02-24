/**
 * DID Service — Tauri IPC bridge for Decentralized Identity
 *
 * Provides TypeScript interface to the Rust DID module.
 * Falls back gracefully when not running in Tauri (web/PWA mode).
 *
 * Key features:
 * - Ed25519 keypair generation and persistent storage
 * - did:key format (W3C DID specification)
 * - Knowledge item signing and verification
 * - Multi-device keypair export/import
 *
 * The private key never leaves the device (stored locally).
 * The DID (public key) is recorded on every knowledge item as `did_author`.
 */

import { invokeTauri, isTauriApp } from '@/lib/platform';

// ─── Types ──────────────────────────────────────────────

export interface IdentityInfo {
  did: string;
  public_key_hex: string;
  created_at: string;
  key_type: string; // "Ed25519"
}

export interface ExportedKeypair {
  did: string;
  private_key_hex: string;
  public_key_hex: string;
  key_type: string;
  exported_at: string;
}

export interface KnowledgeSignature {
  did_author: string;
  signature: string;
  content_hash: string;
  signed_at: string;
}

// ─── Identity ───────────────────────────────────────────

/**
 * Get or create the DID identity.
 * On first call, generates a new Ed25519 keypair.
 * On subsequent calls, returns the existing identity.
 */
export async function getIdentity(): Promise<IdentityInfo | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('did_get_identity');
  return result ? JSON.parse(result) : null;
}

/**
 * Check if a DID identity exists on this device.
 */
export async function hasIdentity(): Promise<boolean> {
  if (!isTauriApp()) return false;

  return (await invokeTauri<boolean>('did_has_identity')) ?? false;
}

/**
 * Get the current DID string (e.g., "did:key:z6Mk...").
 */
export async function getDid(): Promise<string | null> {
  if (!isTauriApp()) return null;

  return invokeTauri<string>('did_get_did');
}

// ─── Signing ────────────────────────────────────────────

/**
 * Sign a knowledge item with the user's Ed25519 private key.
 *
 * @param content - The knowledge item content
 * @param knowledgeType - The knowledge type (e.g., "budget_decision")
 * @param createdAt - ISO 8601 timestamp of creation
 * @returns Signature object with DID, signature hex, and content hash
 */
export async function signKnowledge(
  content: string,
  knowledgeType: string,
  createdAt: string,
): Promise<KnowledgeSignature | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('did_sign_knowledge', {
    content,
    knowledge_type: knowledgeType,
    created_at: createdAt,
  });

  return result ? JSON.parse(result) : null;
}

/**
 * Verify a knowledge item signature.
 * Uses the DID public key embedded in the signature to verify.
 *
 * @param signature - The KnowledgeSignature object (or JSON string)
 * @param content - Original content to verify
 * @param knowledgeType - Original knowledge type
 * @param createdAt - Original timestamp
 * @returns true if signature is valid, false if tampered
 */
export async function verifyKnowledge(
  signature: KnowledgeSignature | string,
  content: string,
  knowledgeType: string,
  createdAt: string,
): Promise<boolean> {
  if (!isTauriApp()) return false;

  const sigJson = typeof signature === 'string'
    ? signature
    : JSON.stringify(signature);

  const result = await invokeTauri<boolean>('did_verify_knowledge', {
    sig_json: sigJson,
    content,
    knowledge_type: knowledgeType,
    created_at: createdAt,
  });

  return result ?? false;
}

// ─── Multi-device ───────────────────────────────────────

/**
 * Export the keypair for transfer to another device.
 * ⚠️ Contains the private key — handle with extreme care!
 * The user should be warned about the security implications.
 */
export async function exportKeypair(): Promise<ExportedKeypair | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('did_export_keypair');
  return result ? JSON.parse(result) : null;
}

/**
 * Import a keypair from another device.
 * Replaces the current identity with the imported one.
 *
 * @param privateKeyHex - 64-character hex string of the Ed25519 private key
 */
export async function importKeypair(
  privateKeyHex: string,
): Promise<IdentityInfo | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('did_import_keypair', {
    private_key_hex: privateKeyHex,
  });

  return result ? JSON.parse(result) : null;
}

// ─── Utility ────────────────────────────────────────────

/**
 * Get a short display form of a DID.
 * e.g., "did:key:z6MkhaXg...2doK"
 */
export function didShort(did: string): string {
  if (did.length <= 20) return did;
  const keyPart = did.slice(8); // Skip "did:key:"
  if (keyPart.length > 12) {
    return `did:key:${keyPart.slice(0, 8)}...${keyPart.slice(-4)}`;
  }
  return did;
}

/**
 * Check if a string looks like a valid did:key.
 */
export function isDidKey(value: string): boolean {
  return /^did:key:z6Mk[A-Za-z0-9]+$/.test(value);
}
