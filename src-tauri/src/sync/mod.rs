/// Re-Be.io E2E Encrypted Sync Module
///
/// Provides selective, user-controlled synchronization:
/// - AES-256-GCM encryption (key derived from DID private key via HKDF)
/// - Delta change detection (updated_at based)
/// - Encrypted blob export/import (for Supabase Storage or file transfer)
///
/// Privacy guarantees:
/// - Sync is OFF by default — user must explicitly enable
/// - Server only sees encrypted blobs — cannot read content
/// - Encryption key never leaves the device
/// - Last-Write-Wins conflict resolution (timestamp-based)

pub mod encryption;
pub mod delta;
pub mod sync;
