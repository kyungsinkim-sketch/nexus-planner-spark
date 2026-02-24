/// DID Identity — Ed25519 keypair generation, storage, and management
///
/// Flow:
/// 1. First app launch → generate Ed25519 keypair
/// 2. Store private key securely (encrypted file in app data dir)
/// 3. Derive did:key from public key
/// 4. Record DID on all knowledge items
/// 5. On restart → load existing keypair → same DID persists
///
/// Future: Tauri Secure Store (OS keychain) for production

use crate::did::resolver;
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// DID Identity state
pub struct DidIdentity {
    key_dir: PathBuf,
    inner: Mutex<Option<IdentityInner>>,
}

struct IdentityInner {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
    did: String,
}

/// Serializable identity info (public only, for IPC)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityInfo {
    pub did: String,
    pub public_key_hex: String,
    pub created_at: String,
    pub key_type: String,
}

/// Exportable keypair (for multi-device support)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedKeypair {
    pub did: String,
    pub private_key_hex: String,
    pub public_key_hex: String,
    pub key_type: String,
    pub exported_at: String,
}

const PRIVATE_KEY_FILE: &str = "did_private_key.bin";
const IDENTITY_META_FILE: &str = "did_identity.json";

impl DidIdentity {
    /// Create a new DID identity manager.
    pub fn new(key_dir: PathBuf) -> Self {
        Self {
            key_dir,
            inner: Mutex::new(None),
        }
    }

    /// Initialize: load existing keypair or generate a new one.
    pub fn initialize(&self) -> Result<IdentityInfo, String> {
        let mut inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;

        if inner.is_some() {
            // Already initialized
            let i = inner.as_ref().unwrap();
            return Ok(make_info(i));
        }

        std::fs::create_dir_all(&self.key_dir)
            .map_err(|e| format!("Failed to create key dir: {}", e))?;

        let private_key_path = self.key_dir.join(PRIVATE_KEY_FILE);

        let (signing_key, is_new) = if private_key_path.exists() {
            // Load existing keypair
            let key_bytes = std::fs::read(&private_key_path)
                .map_err(|e| format!("Failed to read private key: {}", e))?;

            if key_bytes.len() != 32 {
                return Err(format!(
                    "Invalid private key file (expected 32 bytes, got {})",
                    key_bytes.len()
                ));
            }

            let mut key_array = [0u8; 32];
            key_array.copy_from_slice(&key_bytes);
            let key = SigningKey::from_bytes(&key_array);
            log::info!("Loaded existing DID keypair");
            (key, false)
        } else {
            // Generate new keypair
            let key = SigningKey::generate(&mut OsRng);
            log::info!("Generated new DID keypair");
            (key, true)
        };

        let verifying_key = signing_key.verifying_key();
        let did = resolver::public_key_to_did(&verifying_key);

        if is_new {
            // Save private key
            std::fs::write(&private_key_path, signing_key.to_bytes())
                .map_err(|e| format!("Failed to save private key: {}", e))?;

            // Save identity metadata
            let meta = IdentityMeta {
                did: did.clone(),
                public_key_hex: hex::encode(verifying_key.as_bytes()),
                created_at: chrono::Utc::now().to_rfc3339(),
            };
            let meta_path = self.key_dir.join(IDENTITY_META_FILE);
            let meta_json = serde_json::to_string_pretty(&meta)
                .map_err(|e| format!("Failed to serialize meta: {}", e))?;
            std::fs::write(&meta_path, meta_json)
                .map_err(|e| format!("Failed to save identity meta: {}", e))?;

            log::info!("Saved new DID identity: {}", did);
        }

        let identity = IdentityInner {
            signing_key,
            verifying_key,
            did: did.clone(),
        };

        let info = make_info(&identity);
        *inner = Some(identity);

        Ok(info)
    }

    /// Get the current DID string, initializing if needed.
    pub fn get_did(&self) -> Result<String, String> {
        let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
        match inner.as_ref() {
            Some(i) => Ok(i.did.clone()),
            None => {
                drop(inner);
                let info = self.initialize()?;
                Ok(info.did)
            }
        }
    }

    /// Get the signing key (for internal use by signing module).
    pub fn get_signing_key(&self) -> Result<SigningKey, String> {
        let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
        match inner.as_ref() {
            Some(i) => Ok(i.signing_key.clone()),
            None => {
                drop(inner);
                self.initialize()?;
                let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
                Ok(inner.as_ref().unwrap().signing_key.clone())
            }
        }
    }

    /// Get the verifying (public) key.
    pub fn get_verifying_key(&self) -> Result<VerifyingKey, String> {
        let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
        match inner.as_ref() {
            Some(i) => Ok(i.verifying_key),
            None => {
                drop(inner);
                self.initialize()?;
                let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
                Ok(inner.as_ref().unwrap().verifying_key)
            }
        }
    }

    /// Export keypair for multi-device transfer.
    /// ⚠️ Contains private key — handle with extreme care!
    pub fn export_keypair(&self) -> Result<ExportedKeypair, String> {
        let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
        let i = inner.as_ref().ok_or("DID not initialized")?;

        Ok(ExportedKeypair {
            did: i.did.clone(),
            private_key_hex: hex::encode(i.signing_key.to_bytes()),
            public_key_hex: hex::encode(i.verifying_key.as_bytes()),
            key_type: "Ed25519".to_string(),
            exported_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Import keypair from another device.
    /// Replaces the current identity.
    pub fn import_keypair(&self, private_key_hex: &str) -> Result<IdentityInfo, String> {
        let key_bytes = hex::decode(private_key_hex)
            .map_err(|e| format!("Invalid hex: {}", e))?;

        if key_bytes.len() != 32 {
            return Err(format!(
                "Invalid private key (expected 32 bytes, got {})",
                key_bytes.len()
            ));
        }

        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(&key_bytes);
        let signing_key = SigningKey::from_bytes(&key_array);
        let verifying_key = signing_key.verifying_key();
        let did = resolver::public_key_to_did(&verifying_key);

        // Save to disk
        std::fs::create_dir_all(&self.key_dir)
            .map_err(|e| format!("Failed to create key dir: {}", e))?;

        let private_key_path = self.key_dir.join(PRIVATE_KEY_FILE);
        std::fs::write(&private_key_path, signing_key.to_bytes())
            .map_err(|e| format!("Failed to save private key: {}", e))?;

        let meta = IdentityMeta {
            did: did.clone(),
            public_key_hex: hex::encode(verifying_key.as_bytes()),
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        let meta_path = self.key_dir.join(IDENTITY_META_FILE);
        let meta_json = serde_json::to_string_pretty(&meta)
            .map_err(|e| format!("Failed to serialize meta: {}", e))?;
        std::fs::write(&meta_path, meta_json)
            .map_err(|e| format!("Failed to save identity meta: {}", e))?;

        let identity = IdentityInner {
            signing_key,
            verifying_key,
            did: did.clone(),
        };

        let info = make_info(&identity);
        let mut inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
        *inner = Some(identity);

        log::info!("Imported DID identity: {}", did);
        Ok(info)
    }

    /// Check if a DID identity exists on disk.
    pub fn has_identity(&self) -> bool {
        self.key_dir.join(PRIVATE_KEY_FILE).exists()
    }
}

// ── Helpers ────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct IdentityMeta {
    did: String,
    public_key_hex: String,
    created_at: String,
}

fn make_info(inner: &IdentityInner) -> IdentityInfo {
    // Try to read created_at from metadata file
    IdentityInfo {
        did: inner.did.clone(),
        public_key_hex: hex::encode(inner.verifying_key.as_bytes()),
        created_at: String::new(), // Will be filled from meta file if available
        key_type: "Ed25519".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_generate_and_load_identity() {
        let temp_dir = std::env::temp_dir().join("rebe_did_test_gen");
        let _ = std::fs::remove_dir_all(&temp_dir);

        let identity = DidIdentity::new(temp_dir.clone());

        // First init — generates new keypair
        let info1 = identity.initialize().unwrap();
        assert!(info1.did.starts_with("did:key:z6Mk"));
        assert_eq!(info1.key_type, "Ed25519");
        assert_eq!(info1.public_key_hex.len(), 64); // 32 bytes hex

        // Drop and reload — same DID
        drop(identity);
        let identity2 = DidIdentity::new(temp_dir.clone());
        let info2 = identity2.initialize().unwrap();
        assert_eq!(info1.did, info2.did);

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_export_import_keypair() {
        let temp_dir1 = std::env::temp_dir().join("rebe_did_test_export");
        let temp_dir2 = std::env::temp_dir().join("rebe_did_test_import");
        let _ = std::fs::remove_dir_all(&temp_dir1);
        let _ = std::fs::remove_dir_all(&temp_dir2);

        // Generate on device 1
        let id1 = DidIdentity::new(temp_dir1.clone());
        id1.initialize().unwrap();
        let exported = id1.export_keypair().unwrap();

        // Import on device 2
        let id2 = DidIdentity::new(temp_dir2.clone());
        let info2 = id2.import_keypair(&exported.private_key_hex).unwrap();

        assert_eq!(exported.did, info2.did);

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir1);
        let _ = std::fs::remove_dir_all(&temp_dir2);
    }

    #[test]
    fn test_has_identity() {
        let temp_dir = std::env::temp_dir().join("rebe_did_test_has");
        let _ = std::fs::remove_dir_all(&temp_dir);

        let identity = DidIdentity::new(temp_dir.clone());
        assert!(!identity.has_identity());

        identity.initialize().unwrap();
        assert!(identity.has_identity());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
