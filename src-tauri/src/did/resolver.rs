/// DID Resolver — did:key method encoding/decoding
///
/// Implements the did:key method specification:
/// https://w3c-ccg.github.io/did-method-key/
///
/// Format: did:key:z6Mk{base58btc-encoded-multicodec-public-key}
///
/// Multicodec prefix for Ed25519: 0xed01
/// Multibase prefix for base58btc: 'z'
///
/// Example: did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK

use ed25519_dalek::VerifyingKey;

/// Ed25519 multicodec prefix (varint encoded)
const ED25519_MULTICODEC_PREFIX: [u8; 2] = [0xed, 0x01];

/// Convert an Ed25519 public key to a did:key string.
///
/// Format: did:key:z{base58btc(multicodec_prefix + public_key_bytes)}
pub fn public_key_to_did(verifying_key: &VerifyingKey) -> String {
    let pub_bytes = verifying_key.as_bytes();

    // Prepend multicodec prefix (0xed01 for Ed25519)
    let mut multicodec_bytes = Vec::with_capacity(2 + 32);
    multicodec_bytes.extend_from_slice(&ED25519_MULTICODEC_PREFIX);
    multicodec_bytes.extend_from_slice(pub_bytes);

    // Encode with base58btc, prefix with 'z' (multibase)
    let encoded = bs58::encode(&multicodec_bytes).into_string();
    format!("did:key:z{}", encoded)
}

/// Parse a did:key string and extract the Ed25519 public key bytes.
///
/// Returns the 32-byte public key if valid, or an error.
pub fn did_to_public_key_bytes(did: &str) -> Result<[u8; 32], String> {
    // Validate format
    if !did.starts_with("did:key:z") {
        return Err(format!("Invalid did:key format: {}", did));
    }

    // Strip "did:key:z" prefix
    let encoded = &did[9..]; // "did:key:z" is 9 chars

    // Decode base58btc
    let decoded = bs58::decode(encoded)
        .into_vec()
        .map_err(|e| format!("Base58 decode failed: {}", e))?;

    // Check multicodec prefix
    if decoded.len() < 2 {
        return Err("Decoded DID too short".to_string());
    }

    if decoded[0] != ED25519_MULTICODEC_PREFIX[0] || decoded[1] != ED25519_MULTICODEC_PREFIX[1] {
        return Err(format!(
            "Unexpected multicodec prefix: [{:#04x}, {:#04x}] (expected Ed25519 [{:#04x}, {:#04x}])",
            decoded[0], decoded[1], ED25519_MULTICODEC_PREFIX[0], ED25519_MULTICODEC_PREFIX[1]
        ));
    }

    // Extract 32-byte public key
    let key_bytes = &decoded[2..];
    if key_bytes.len() != 32 {
        return Err(format!(
            "Invalid public key length: {} (expected 32)",
            key_bytes.len()
        ));
    }

    let mut result = [0u8; 32];
    result.copy_from_slice(key_bytes);
    Ok(result)
}

/// Parse a did:key string and return the VerifyingKey.
pub fn did_to_verifying_key(did: &str) -> Result<VerifyingKey, String> {
    let key_bytes = did_to_public_key_bytes(did)?;
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|e| format!("Invalid Ed25519 public key: {}", e))
}

/// Validate a did:key string format.
pub fn is_valid_did_key(did: &str) -> bool {
    did_to_public_key_bytes(did).is_ok()
}

/// Get a short display form of a DID (first 8 + last 4 chars of the key part).
pub fn did_short(did: &str) -> String {
    if did.len() > 20 {
        let key_part = &did[8..]; // Skip "did:key:"
        if key_part.len() > 12 {
            return format!("did:key:{}...{}", &key_part[..8], &key_part[key_part.len()-4..]);
        }
    }
    did.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    #[test]
    fn test_roundtrip_did_key() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        let did = public_key_to_did(&verifying_key);
        assert!(did.starts_with("did:key:z6Mk"), "DID = {}", did);

        // Roundtrip
        let recovered_bytes = did_to_public_key_bytes(&did).unwrap();
        assert_eq!(recovered_bytes, *verifying_key.as_bytes());

        let recovered_key = did_to_verifying_key(&did).unwrap();
        assert_eq!(recovered_key, verifying_key);
    }

    #[test]
    fn test_did_format() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let did = public_key_to_did(&signing_key.verifying_key());

        // did:key starts with z6Mk for Ed25519
        assert!(did.starts_with("did:key:z6Mk"));
        // Total length should be around 56 chars
        assert!(did.len() > 50 && did.len() < 70, "DID length = {}", did.len());
    }

    #[test]
    fn test_invalid_did() {
        assert!(did_to_public_key_bytes("not-a-did").is_err());
        assert!(did_to_public_key_bytes("did:key:abc").is_err());
        assert!(did_to_public_key_bytes("did:web:example.com").is_err());
    }

    #[test]
    fn test_is_valid_did_key() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let did = public_key_to_did(&signing_key.verifying_key());

        assert!(is_valid_did_key(&did));
        assert!(!is_valid_did_key("did:key:invalid"));
        assert!(!is_valid_did_key("not-a-did"));
    }

    #[test]
    fn test_did_short() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let did = public_key_to_did(&signing_key.verifying_key());

        let short = did_short(&did);
        assert!(short.contains("..."));
        assert!(short.starts_with("did:key:z6Mk"));
    }

    #[test]
    fn test_deterministic_did() {
        // Same key → same DID
        let key_bytes = [42u8; 32];
        let signing_key = SigningKey::from_bytes(&key_bytes);
        let vk = signing_key.verifying_key();

        let did1 = public_key_to_did(&vk);
        let did2 = public_key_to_did(&vk);
        assert_eq!(did1, did2);
    }
}
