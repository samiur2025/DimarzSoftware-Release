use crate::models::{ActivationRequest, ActivationResponse};
use base64::{engine::general_purpose, Engine as _};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

const SERVER_URL: &str = "https://script.google.com/macros/s/AKfycbwStHcfWqBTFIJ_dSSRw9h8mY6hYu2ONbTU2tWtzWBIOv1hDxP5CyjFqCwY-oanITvmxw/exec";

#[derive(Clone)]
pub struct LicenseManager {
    app_data_dir: PathBuf,
}

impl LicenseManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn validate_local(&self) -> Result<bool, String> {
        if crate::licensing::hardware::HardwareFingerprint::is_virtual_machine() {
            log::warn!("VM detected");
        }

        let license_path = self.app_data_dir.join("license.dat");
        if !license_path.exists() {
            return Ok(false);
        }

        let encrypted_data = std::fs::read_to_string(&license_path).map_err(|e| e.to_string())?;
        let data: serde_json::Value = serde_json::from_str(&Self::decrypt(&encrypted_data)?).map_err(|e| e.to_string())?;

        let stored_token = data["token"].as_str().ok_or("No token")?;
        let stored_hwid = data["hwid"].as_str().ok_or("No hwid")?;
        let stored_key = data["key"].as_str().ok_or("No key")?;

        let current_hwid = crate::licensing::hardware::HardwareFingerprint::generate()?;
        if stored_hwid != current_hwid {
            return Ok(false);
        }

        Self::verify_token(stored_token, stored_key, stored_hwid)
    }

    pub async fn activate_online(
        &self,
        license_key: String,
        device_code: String,
    ) -> Result<ActivationResponse, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;

        let request = ActivationRequest {
            license_key: license_key.clone(),
            device_code: device_code.clone(),
        };

        let response = client
            .post(SERVER_URL)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let result: ActivationResponse = response
            .json()
            .await
            .map_err(|e| format!("Invalid response: {}", e))?;

        if result.status == "success" {
            let token = result.token.clone().unwrap_or_else(|| "default-token".to_string());
            self.store_locally(&license_key, &device_code, &token)?;
        } else if result.status == "expired" {
            return Err("Trial Period Expired".to_string());
        } else if result.status == "failed" || result.status == "error" {
            let msg = result.message.clone().unwrap_or_else(|| "Activation failed".to_string());
            return Err(msg);
        }

        Ok(result)
    }

    fn store_locally(&self, key: &str, hwid: &str, token: &str) -> Result<(), String> {
        let license_path = self.app_data_dir.join("license.dat");
        let data = serde_json::json!({
            "token": token,
            "hwid": hwid,
            "key": key
        });
        
        let encrypted = Self::encrypt(&data.to_string())?;
        std::fs::write(&license_path, encrypted).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn encrypt(data: &str) -> Result<String, String> {
        let key = Self::derive_key()?;
        let mut out = Vec::new();
        for (i, b) in data.bytes().enumerate() {
            out.push(b ^ key[i % key.len()]);
        }
        Ok(general_purpose::STANDARD.encode(&out))
    }

    fn decrypt(data: &str) -> Result<String, String> {
        let key = Self::derive_key()?;
        let decoded = general_purpose::STANDARD
            .decode(data)
            .map_err(|e| e.to_string())?;

        let mut out = Vec::new();
        for (i, b) in decoded.iter().enumerate() {
            out.push(b ^ key[i % key.len()]);
        }
        String::from_utf8(out).map_err(|e| e.to_string())
    }

    fn derive_key() -> Result<Vec<u8>, String> {
        let hwid = crate::licensing::hardware::HardwareFingerprint::generate().unwrap_or_else(|_| "dimrz-fallback-hwid".to_string());
        let mut hasher = Sha256::new();
        hasher.update(hwid.as_bytes());
        hasher.update(b"dimrz-secret-salt-2026");
        Ok(hasher.finalize().to_vec())
    }

    fn verify_token(token: &str, key: &str, _hwid: &str) -> Result<bool, String> {
        if token.is_empty() || key.is_empty() {
            return Ok(false);
        }
        Ok(true)
    }
}
