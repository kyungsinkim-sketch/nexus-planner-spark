/// DID Signing — Knowledge item signing and verification
///
/// Signs knowledge items with the user's Ed25519 private key.
/// Verification uses the did:key public key (no private key needed).
///
/// Signed content format: SHA-256(content + knowledge_type + created_at)
/// This ensures:
/// - The knowledge was created by the DID owner
/// - The content hasn't been tampered with
/// - The timestamp is authentic

use crate::did::identity::DidIdentity;
use crate::did::resolver;
use ed25519_dalek::{Signature, Signer, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Signed knowledge item metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSignature {
    /// The DID of the signer
    pub did_author: String,
    /// Hex-encoded Ed25519 signature
    pub signature: String,
    /// SHA-256 hash of the signed content (hex)
    pub content_hash: String,
    /// ISO 8601 timestamp of signing
    pub signed_at: String,
}

/// Create the canonical content hash for signing.
/// Hash = SHA-256(content || knowledge_type || created_at)
fn canonical_hash(content: &str, knowledge_type: &str, created_at: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hasher.update(b"|");
    hasher.update(knowledge_type.as_bytes());
    hasher.update(b"|");
    hasher.update(created_at.as_bytes());
    hasher.finalize().to_vec()
}

/// Sign a knowledge item with the user's DID private key.
pub fn sign_knowledge(
    identity: &DidIdentity,
    content: &str,
    knowledge_type: &str,
    created_at: &str,
) -> Result<KnowledgeSignature, String> {
    let signing_key = identity.get_signing_key()?;
    let did = identity.get_did()?;

    let hash = canonical_hash(content, knowledge_type, created_at);
    let signature = signing_key.sign(&hash);

    Ok(KnowledgeSignature {
        did_author: did,
        signature: hex::encode(signature.to_bytes()),
        content_hash: hex::encode(&hash),
        signed_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Verify a knowledge item signature.
/// Returns Ok(true) if valid, Ok(false) if invalid, Err on error.
pub fn verify_knowledge(
    sig: &KnowledgeSignature,
    content: &str,
    knowledge_type: &str,
    created_at: &str,
) -> Result<bool, String> {
    // Reconstruct the content hash
    let expected_hash = canonical_hash(content, knowledge_type, created_at);
    let expected_hash_hex = hex::encode(&expected_hash);

    // Check hash matches
    if sig.content_hash != expected_hash_hex {
        return Ok(false); // Content was modified
    }

    // Resolve the DID to get the public key
    let verifying_key = resolver::did_to_verifying_key(&sig.did_author)?;

    // Decode the signature
    let sig_bytes = hex::decode(&sig.signature)
        .map_err(|e| format!("Invalid signature hex: {}", e))?;

    if sig_bytes.len() != 64 {
        return Err(format!(
            "Invalid signature length: {} (expected 64)",
            sig_bytes.len()
        ));
    }

    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_array);

    // Verify
    match verifying_key.verify(&expected_hash, &signature) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Verify a signature using a specific public key (not from DID resolution).
pub fn verify_with_key(
    verifying_key: &VerifyingKey,
    sig_hex: &str,
    content: &str,
    knowledge_type: &str,
    created_at: &str,
) -> Result<bool, String> {
    let hash = canonical_hash(content, knowledge_type, created_at);

    let sig_bytes = hex::decode(sig_hex)
        .map_err(|e| format!("Invalid signature hex: {}", e))?;

    if sig_bytes.len() != 64 {
        return Err(format!(
            "Invalid signature length: {} (expected 64)",
            sig_bytes.len()
        ));
    }

    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_array);

    match verifying_key.verify(&hash, &signature) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_identity() -> DidIdentity {
        let temp_dir = std::env::temp_dir().join(format!(
            "rebe_did_sign_test_{}",
            uuid::Uuid::new_v4()
        ));
        let identity = DidIdentity::new(temp_dir);
        identity.initialize().unwrap();
        identity
    }

    #[test]
    fn test_sign_and_verify() {
        let identity = test_identity();

        let content = "예산 3000만원으로 확정";
        let knowledge_type = "budget_decision";
        let created_at = "2026-02-23T10:00:00Z";

        let sig = sign_knowledge(&identity, content, knowledge_type, created_at).unwrap();

        assert!(sig.did_author.starts_with("did:key:z6Mk"));
        assert!(!sig.signature.is_empty());
        assert!(!sig.content_hash.is_empty());

        // Verify
        let valid = verify_knowledge(&sig, content, knowledge_type, created_at).unwrap();
        assert!(valid);
    }

    #[test]
    fn test_tampered_content_fails() {
        let identity = test_identity();

        let content = "예산 3000만원으로 확정";
        let knowledge_type = "budget_decision";
        let created_at = "2026-02-23T10:00:00Z";

        let sig = sign_knowledge(&identity, content, knowledge_type, created_at).unwrap();

        // Tamper with content
        let valid = verify_knowledge(&sig, "예산 5000만원으로 변경", knowledge_type, created_at).unwrap();
        assert!(!valid, "Tampered content should fail verification");
    }

    #[test]
    fn test_tampered_type_fails() {
        let identity = test_identity();

        let content = "테스트 내용";
        let knowledge_type = "decision_pattern";
        let created_at = "2026-02-23T10:00:00Z";

        let sig = sign_knowledge(&identity, content, knowledge_type, created_at).unwrap();

        let valid = verify_knowledge(&sig, content, "budget_decision", created_at).unwrap();
        assert!(!valid, "Tampered knowledge_type should fail verification");
    }

    #[test]
    fn test_different_identity_fails() {
        let identity1 = test_identity();
        let identity2 = test_identity();

        let content = "테스트";
        let kt = "context";
        let ca = "2026-02-23T10:00:00Z";

        let sig = sign_knowledge(&identity1, content, kt, ca).unwrap();

        // Signature was made by identity1, but sig.did_author points to identity1's DID
        // So verification with the correct DID should pass
        let valid = verify_knowledge(&sig, content, kt, ca).unwrap();
        assert!(valid);

        // But verifying with identity2's public key should fail
        let vk2 = identity2.get_verifying_key().unwrap();
        let valid2 = verify_with_key(&vk2, &sig.signature, content, kt, ca).unwrap();
        assert!(!valid2, "Different key should fail verification");
    }

    #[test]
    fn test_canonical_hash_deterministic() {
        let h1 = canonical_hash("content", "type", "time");
        let h2 = canonical_hash("content", "type", "time");
        assert_eq!(h1, h2);

        let h3 = canonical_hash("different", "type", "time");
        assert_ne!(h1, h3);
    }
}
