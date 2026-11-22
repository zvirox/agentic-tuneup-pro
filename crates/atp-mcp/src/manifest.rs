#![allow(unsafe_code)]

use std::fs;
use std::path::{Path, PathBuf};
use atp_core::{CoreError, ErrorKind};

/// Computes the default Starship manifest path:
/// `$XDG_DATA_HOME/starship/plugins/atp.json` (fallback `~/.local/share/starship/plugins/atp.json`).
pub fn default_manifest_path() -> PathBuf {
    let base_data = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            PathBuf::from(home).join(".local/share")
        });

    base_data.join("starship/plugins/atp.json")
}

/// Computes the default Unix domain bridge socket path:
/// `$XDG_RUNTIME_DIR/starship/bridges/atp.sock` (fallback `/tmp/starship-<uid>/bridges/atp.sock`).
pub fn default_socket_path() -> PathBuf {
    if let Ok(runtime_dir) = std::env::var("XDG_RUNTIME_DIR") {
        PathBuf::from(runtime_dir).join("starship/bridges/atp.sock")
    } else {
        #[cfg(target_os = "linux")]
        let uid = unsafe { libc::getuid() };
        #[cfg(not(target_os = "linux"))]
        let uid = 1000;

        PathBuf::from(format!("/tmp/starship-{uid}/bridges/atp.sock"))
    }
}

/// Registers the Starship capability manifest so Starship Control can discover ATP.
pub fn register_starship_manifest(socket_path: &Path) -> Result<PathBuf, CoreError> {
    let manifest_path = default_manifest_path();

    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            CoreError::new(
                ErrorKind::Mcp,
                "mcp.manifest_dir_create_failed",
                false,
                format!("Failed creating Starship manifest directory {}: {e}", parent.display()),
                None,
            )
        })?;
    }

    let manifest_data = serde_json::json!({
        "id": "atp",
        "name": "Agentic Tuneup Pro",
        "description": "Sovereign glass system cleaner, package manager, and performance tune-up suite",
        "version": "0.1.0",
        "socketPath": socket_path.to_string_lossy(),
        "transport": "unix_socket",
        "capabilities": {
            "tools": true,
            "telemetry": true
        }
    });

    let json_bytes = serde_json::to_vec_pretty(&manifest_data).map_err(|e| {
        CoreError::new(
            ErrorKind::Mcp,
            "mcp.manifest_serialize_failed",
            false,
            format!("Failed serializing Starship manifest: {e}"),
            None,
        )
    })?;

    fs::write(&manifest_path, json_bytes).map_err(|e| {
        CoreError::new(
            ErrorKind::Mcp,
            "mcp.manifest_write_failed",
            false,
            format!("Failed writing Starship manifest to {}: {e}", manifest_path.display()),
            None,
        )
    })?;

    Ok(manifest_path)
}

/// Unregisters the Starship manifest and cleans up the bridge socket.
pub fn unregister_starship_manifest(manifest_path: &Path, socket_path: Option<&Path>) -> Result<(), CoreError> {
    if manifest_path.exists() {
        let _ = fs::remove_file(manifest_path);
    }

    if let Some(sock) = socket_path {
        if sock.exists() {
            let _ = fs::remove_file(sock);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_registration_lifecycle() {
        let temp_dir = std::env::temp_dir().join(format!("atp_mcp_test_{}", fastrand::u32(..)));
        let test_socket = temp_dir.join("test.sock");
        let test_manifest = temp_dir.join("plugins/atp.json");

        fs::create_dir_all(test_manifest.parent().unwrap()).unwrap();

        // Write test socket
        fs::write(&test_socket, b"").unwrap();

        // Register custom manifest
        let manifest_data = serde_json::json!({
            "id": "atp",
            "socketPath": test_socket.to_string_lossy()
        });
        fs::write(&test_manifest, serde_json::to_vec(&manifest_data).unwrap()).unwrap();

        assert!(test_manifest.exists());
        assert!(test_socket.exists());

        unregister_starship_manifest(&test_manifest, Some(&test_socket)).unwrap();
        assert!(!test_manifest.exists());
        assert!(!test_socket.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
