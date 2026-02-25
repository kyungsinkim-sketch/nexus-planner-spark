use serde::{Deserialize, Serialize};

/// A phone contact entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub phone_numbers: Vec<String>,
    pub email: Option<String>,
    pub company: Option<String>,
    pub thumbnail: Option<String>,  // base64 encoded thumbnail
}

/// Get all contacts from the device
/// On desktop: returns empty vec (not supported)
/// On mobile: bridges to native contact store
#[tauri::command]
pub async fn phone_get_contacts() -> Result<Vec<Contact>, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        // Native implementation will be called via Tauri mobile plugin
        // For now, return error indicating native bridge needed
        Err("Native contact access requires mobile plugin bridge".into())
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop: return empty contacts (feature not available)
        Ok(vec![])
    }
}

/// Search contacts by name or phone number
#[tauri::command]
pub async fn phone_search_contacts(query: String) -> Result<Vec<Contact>, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Native contact search requires mobile plugin bridge".into())
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = query;
        Ok(vec![])
    }
}
