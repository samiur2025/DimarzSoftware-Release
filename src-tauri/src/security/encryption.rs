use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::Rng;
use sha2::{Digest, Sha256};
pub fn derive_key_from_hardware(hwid: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(hwid.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}
pub fn encrypt_data(data: &[u8], hwid: &str) -> Result<Vec<u8>, String> {
    let key = derive_key_from_hardware(hwid);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut rng = rand::thread_rng();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, data).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}
pub fn decrypt_data(encrypted: &[u8], hwid: &str) -> Result<Vec<u8>, String> {
    if encrypted.len() < 12 {
        return Err("Invalid data".to_string());
    }
    let key = derive_key_from_hardware(hwid);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&encrypted[..12]);
    let ciphertext = &encrypted[12..];
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| e.to_string())?;
    Ok(plaintext)
}
