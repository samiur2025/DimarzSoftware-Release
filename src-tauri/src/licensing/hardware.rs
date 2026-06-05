use sha2::{Digest, Sha256};
use std::process::Command;

pub struct HardwareFingerprint;

impl HardwareFingerprint {
    pub fn generate() -> Result<String, String> {
        let mut components = Vec::new();

        // 1. Get Machine ID / UUID
        if let Ok(id) = Self::get_machine_id() {
            components.push(id);
        }

        // 2. Get CPU Info (fallback)
        if let Ok(cpu) = Self::get_cpu_id() {
            components.push(cpu);
        }

        // 3. Get MAC Address (fallback)
        if let Ok(mac) = Self::get_mac_address() {
            components.push(mac);
        }

        if components.is_empty() {
            return Err("Could not collect any hardware identifiers".to_string());
        }

        let combined = components.join("|");
        let mut hasher = Sha256::new();
        hasher.update(combined.as_bytes());
        Ok(format!("{:x}", hasher.finalize()))
    }

    fn get_machine_id() -> Result<String, String> {
        #[cfg(target_os = "windows")]
        {
            let output = Command::new("wmic")
                .args(["csproduct", "get", "uuid", "/value"])
                .output()
                .map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.starts_with("UUID=") {
                    let uuid = line.replace("UUID=", "").trim().to_string();
                    if uuid != "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF" {
                        return Ok(uuid);
                    }
                }
            }
            Err("UUID not found".to_string())
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(content) = std::fs::read_to_string("/etc/machine-id") {
                return Ok(content.trim().to_string());
            }
            if let Ok(content) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
                return Ok(content.trim().to_string());
            }
            if let Ok(content) = std::fs::read_to_string("/sys/class/dmi/id/product_uuid") {
                return Ok(content.trim().to_string());
            }
            Err("Machine ID not found".to_string())
        }
        #[cfg(target_os = "macos")]
        {
            let output = Command::new("ioreg")
                .args(["-rd1", "-c", "IOPlatformExpertDevice"])
                .output()
                .map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("IOPlatformUUID") {
                    let parts: Vec<&str> = line.split('"').collect();
                    if parts.len() >= 4 {
                        return Ok(parts[3].to_string());
                    }
                }
            }
            Err("UUID not found".to_string())
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            Err("Unsupported OS".to_string())
        }
    }

    fn get_cpu_id() -> Result<String, String> {
        #[cfg(target_os = "windows")]
        {
            let output = Command::new("wmic")
                .args(["cpu", "get", "ProcessorId", "/value"])
                .output()
                .map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.starts_with("ProcessorId=") {
                    return Ok(line.replace("ProcessorId=", "").trim().to_string());
                }
            }
            Err("CPU ID not found".to_string())
        }
        #[cfg(target_os = "linux")]
        {
            let content = std::fs::read_to_string("/proc/cpuinfo").map_err(|e| e.to_string())?;
            for line in content.lines() {
                if line.starts_with("Serial") || line.starts_with("Hardware") {
                    let parts: Vec<&str> = line.split(':').collect();
                    if parts.len() == 2 {
                        return Ok(parts[1].trim().to_string());
                    }
                }
            }
            Err("CPU ID not found in /proc/cpuinfo".to_string())
        }
        #[cfg(target_os = "macos")]
        {
            Err("CPU ID not available on macOS without extra privileges".to_string())
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            Err("Unsupported OS".to_string())
        }
    }

    fn get_mac_address() -> Result<String, String> {
        #[cfg(target_os = "windows")]
        {
            let output = Command::new("wmic")
                .args(["nic", "where", "NetConnectionStatus=2", "get", "MACAddress", "/value"])
                .output()
                .map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.starts_with("MACAddress=") {
                    return Ok(line.replace("MACAddress=", "").trim().to_string());
                }
            }
            Err("MAC Address not found".to_string())
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(entries) = std::fs::read_dir("/sys/class/net") {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy();
                    if name != "lo" {
                        let addr_path = path.join("address");
                        if let Ok(mac) = std::fs::read_to_string(addr_path) {
                            return Ok(mac.trim().to_string());
                        }
                    }
                }
            }
            Err("MAC Address not found".to_string())
        }
        #[cfg(target_os = "macos")]
        {
            let output = Command::new("ifconfig")
                .args(["en0"])
                .output()
                .map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("ether ") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        return Ok(parts[1].to_string());
                    }
                }
            }
            Err("MAC Address not found".to_string())
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            Err("Unsupported OS".to_string())
        }
    }

    pub fn is_virtual_machine() -> bool {
        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("wmic")
                .args(["computersystem", "get", "model", "/value"])
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                return ["VMware", "VirtualBox", "Hyper-V", "KVM", "Parallels"]
                    .iter()
                    .any(|&vm| stdout.contains(vm));
            }
            false
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(content) = std::fs::read_to_string("/sys/class/dmi/id/sys_vendor") {
                let vendor = content.trim();
                return ["VMware", "innotek GmbH", "QEMU", "Microsoft Corporation"]
                    .iter()
                    .any(|&vm| vendor.contains(vm));
            }
            false
        }
        #[cfg(target_os = "macos")]
        {
            false
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            false
        }
    }
}
