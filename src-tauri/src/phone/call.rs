use serde::{Deserialize, Serialize};

/// Call state tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CallState {
    Idle,
    Dialing,
    Active,
    Ended,
}

/// Call record with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallRecord {
    pub phone_number: String,
    pub contact_name: Option<String>,
    pub state: CallState,
    pub started_at: Option<String>,   // ISO timestamp
    pub ended_at: Option<String>,
    pub duration_seconds: u32,
    pub recording_path: Option<String>,
}

/// Initiate a phone call and start recording
/// On mobile: opens system dialer + starts mic recording
/// On desktop: not supported
#[tauri::command]
pub async fn phone_make_call(phone_number: String, contact_name: Option<String>) -> Result<CallRecord, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        // Native implementation:
        // 1. Request CALL_PHONE + RECORD_AUDIO permissions
        // 2. Start mic recording (background service)
        // 3. Launch system dialer with phone_number
        // 4. Monitor call state via PhoneStateListener (Android) / CXCallObserver (iOS)
        // 5. When call ends, stop recording
        Err("Native call feature requires mobile plugin bridge".into())
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = (&phone_number, &contact_name);
        Err("Phone calls are only available on mobile".into())
    }
}

/// Get current call state
#[tauri::command]
pub async fn phone_get_call_state() -> Result<CallState, String> {
    Ok(CallState::Idle)
}

/// Stop recording and return the audio file path
#[tauri::command]
pub async fn phone_stop_recording() -> Result<Option<String>, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Native recording stop requires mobile plugin bridge".into())
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        Ok(None)
    }
}
