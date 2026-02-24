/// AES-256-GCM Encryption — E2E encryption for sync blobs
///
/// Key derivation: HKDF-SHA256(DID private key, salt="rebe-sync-v1")
/// Encryption: AES-256-GCM with random 96-bit nonce
///
/// Format: [12-byte nonce][encrypted data][16-byte tag]
/// All concatenated into a single blob for storage.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, AeadCore, Nonce,
};
use hkdf::Hkdf;
use sha2::Sha256;

/// HKDF salt for sync key derivation
const HKDF_SALT: &[u8] = b"rebe-sync-v1";

/// HKDF info context for sync encryption key
const HKDF_INFO: &[u8] = b"rebe-e2e-sync-aes256gcm";

/// Nonce size for AES-256-GCM (96 bits = 12 bytes)
const NONCE_SIZE: usize = 12;

/// Derive an AES-256-GCM encryption key from the DID private key.
///
/// Uses HKDF-SHA256 with a fixed salt to derive a 256-bit key.
/// This ensures the same DID private key always produces the same encryption key.
pub fn derive_sync_key(did_private_key: &[u8]) -> Result<[u8; 32], String> {
    let hk = Hkdf::<Sha256>::new(Some(HKDF_SALT), did_private_key);
    let mut key = [0u8; 32];
    hk.expand(HKDF_INFO, &mut key)
        .map_err(|e| format!("HKDF expand failed: {}", e))?;
    Ok(key)
}

/// Encrypt data with AES-256-GCM.
///
/// Returns: [12-byte nonce][ciphertext + 16-byte auth tag]
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Invalid key: {}", e))?;

    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypt data encrypted with AES-256-GCM.
///
/// Input format: [12-byte nonce][ciphertext + 16-byte auth tag]
pub fn decrypt(key: &[u8; 32], encrypted: &[u8]) -> Result<Vec<u8>, String> {
    if encrypted.len() < NONCE_SIZE + 16 {
        return Err("Encrypted data too short (need nonce + tag at minimum)".to_string());
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Invalid key: {}", e))?;

    let nonce = Nonce::from_slice(&encrypted[..NONCE_SIZE]);
    let ciphertext = &encrypted[NONCE_SIZE..];

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed (wrong key or tampered data): {}", e))
}

/// Encrypt a JSON string and return base64-encoded blob.
pub fn encrypt_json(key: &[u8; 32], json: &str) -> Result<String, String> {
    let encrypted = encrypt(key, json.as_bytes())?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &encrypted,
    ))
}

/// Decrypt a base64-encoded blob back to JSON string.
pub fn decrypt_json(key: &[u8; 32], base64_blob: &str) -> Result<String, String> {
    let encrypted = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        base64_blob,
    )
    .map_err(|e| format!("Base64 decode failed: {}", e))?;

    let plaintext = decrypt(key, &encrypted)?;
    String::from_utf8(plaintext)
        .map_err(|e| format!("Decrypted data is not valid UTF-8: {}", e))
}

use base64::Engine as _;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_sync_key_deterministic() {
        let private_key = [42u8; 32];
        let key1 = derive_sync_key(&private_key).unwrap();
        let key2 = derive_sync_key(&private_key).unwrap();
        assert_eq!(key1, key2);
        assert_ne!(key1, [0u8; 32]); // Not all zeros
    }

    #[test]
    fn test_different_keys_different_output() {
        let key1 = derive_sync_key(&[1u8; 32]).unwrap();
        let key2 = derive_sync_key(&[2u8; 32]).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = derive_sync_key(&[99u8; 32]).unwrap();
        let plaintext = b"Hello, encrypted world!";

        let encrypted = encrypt(&key, plaintext).unwrap();
        assert_ne!(encrypted, plaintext.to_vec()); // Not plaintext
        assert!(encrypted.len() > plaintext.len()); // Nonce + tag overhead

        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext.to_vec());
    }

    #[test]
    fn test_encrypt_decrypt_korean() {
        let key = derive_sync_key(&[77u8; 32]).unwrap();
        let plaintext = "예산 3000만원 확정. 크리에이티브 방향성 논의 필요.";

        let encrypted = encrypt(&key, plaintext.as_bytes()).unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(String::from_utf8(decrypted).unwrap(), plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = derive_sync_key(&[1u8; 32]).unwrap();
        let key2 = derive_sync_key(&[2u8; 32]).unwrap();

        let encrypted = encrypt(&key1, b"secret data").unwrap();
        let result = decrypt(&key2, &encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_data_fails() {
        let key = derive_sync_key(&[55u8; 32]).unwrap();
        let mut encrypted = encrypt(&key, b"important data").unwrap();

        // Tamper with ciphertext
        if let Some(byte) = encrypted.last_mut() {
            *byte ^= 0xFF;
        }

        let result = decrypt(&key, &encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_json_roundtrip() {
        let key = derive_sync_key(&[88u8; 32]).unwrap();
        let json = r#"{"decisions":["예산 확정"],"summary":"회의 결과"}"#;

        let blob = encrypt_json(&key, json).unwrap();
        assert!(!blob.is_empty());

        let decrypted = decrypt_json(&key, &blob).unwrap();
        assert_eq!(decrypted, json);
    }

    #[test]
    fn test_empty_data() {
        let key = derive_sync_key(&[11u8; 32]).unwrap();
        let encrypted = encrypt(&key, b"").unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert!(decrypted.is_empty());
    }

    #[test]
    fn test_large_data() {
        let key = derive_sync_key(&[33u8; 32]).unwrap();
        let large_data = vec![0xABu8; 100_000]; // 100KB

        let encrypted = encrypt(&key, &large_data).unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, large_data);
    }
}
