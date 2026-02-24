/// Re-Be.io DID (Decentralized Identifier) Module
///
/// Provides Ed25519-based identity for knowledge ownership:
/// - `did:key:z6Mk...` format (W3C DID spec)
/// - Keypair generation and persistent storage
/// - Knowledge item signing and verification
/// - Multi-device support via key export/import
///
/// The private key is stored locally on the device.
/// The DID (public key) is recorded on every knowledge item as `did_author`.

pub mod identity;
pub mod resolver;
pub mod signing;
