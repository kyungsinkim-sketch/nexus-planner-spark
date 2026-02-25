// Phone & Contacts — Tauri IPC commands for mobile Smart Call feature
//
// Platform-specific implementations:
// - Android: ContentResolver for contacts, Intent for calls, MediaRecorder for audio
// - iOS: CNContactStore for contacts, tel: URL for calls, AVAudioRecorder for audio
// - Desktop: Returns mock data / not supported
//
// The actual native implementations live in Kotlin/Swift via Tauri's mobile plugin system.
// These commands serve as the IPC bridge.

pub mod contacts;
pub mod call;
