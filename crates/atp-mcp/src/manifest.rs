#![allow(unsafe_code)]

use atp_core::{CoreError, ErrorKind};
use starship_plugin::{AppManifest, bridge_dir, manifest_dir};
use std::fs;
use std::path::{Path, PathBuf};

/// Computes the default Starship manifest path:
/// `$XDG_DATA_HOME/starship/plugins/atp.json` (fallback `~/.local/share/starship/plugins/atp.json`).
pub fn default_manifest_path() -> PathBuf {
    manifest_dir().join("atp.json")
}

/// Computes the default Unix domain bridge socket path:
/// `$XDG_RUNTIME_DIR/starship/bridges/atp.sock`.
pub fn default_socket_path() -> PathBuf {
    bridge_dir().join("atp.sock")
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
                format!(
                    "Failed creating Starship manifest directory {}: {e}",
                    parent.display()
                ),
                None,
            )
        })?;
    }

    let manifest = AppManifest {
        schema_version: "1.0".to_string(),
        app_id: "atp".to_string(),
        name: "Agentic Tuneup Pro".to_string(),
        version: "0.1.0".to_string(),
        binary_path: "/usr/bin/agentic-tuneup-pro".to_string(),
        launch_args: vec![],
        mcp_cli_args: vec!["--mcp".to_string()],
        socket_path: Some(socket_path.to_string_lossy().to_string()),
        capabilities: serde_json::json!({
            "packageCleaner": true,
            "memoryOptimizer": true,
            "cacheCleaner": true,
            "serviceManager": true,
            "tools": true,
            "telemetry": true
        }),
    };

    let json_bytes = manifest.to_json().map_err(|e| {
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
            format!(
                "Failed writing Starship manifest to {}: {e}",
                manifest_path.display()
            ),
            None,
        )
    })?;

    Ok(manifest_path)
}

/// Unregisters the Starship manifest and cleans up the bridge socket.
pub fn unregister_starship_manifest(
    manifest_path: &Path,
    socket_path: Option<&Path>,
) -> Result<(), CoreError> {
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

        // Test real register_starship_manifest produces valid AppManifest
        let registered_path = register_starship_manifest(&test_socket).unwrap();
        let content = fs::read_to_string(&registered_path).unwrap();
        let parsed = AppManifest::from_json(&content).unwrap();
        assert_eq!(parsed.app_id, "atp");
        assert_eq!(parsed.name, "Agentic Tuneup Pro");
        assert_eq!(
            parsed.socket_path.as_deref(),
            Some(test_socket.to_string_lossy().as_ref())
        );

        let _ = unregister_starship_manifest(&registered_path, None);
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
