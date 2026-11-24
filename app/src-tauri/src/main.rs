#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent;
mod commands;

use agent::AgentEngine;
use atp_mcp::{
    McpDispatcher, UnixSocketServer, default_socket_path, register_starship_manifest,
    unregister_starship_manifest,
};
use atp_monitor::TelemetryMonitor;
use atp_voice::AudioCaptureSession;
use std::sync::Arc;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // 1. Headless MCP Stdio Mode (--mcp flag)
    if args.iter().any(|arg| arg == "--mcp") {
        eprintln!("[ATP] Launching in headless MCP stdio mode...");
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to initialize tokio runtime for headless MCP");

        let dispatcher = Arc::new(McpDispatcher::new());
        let cancel_token = CancellationToken::new();

        if let Err(e) = rt.block_on(atp_mcp::run_stdio_server(dispatcher, cancel_token)) {
            eprintln!("[ATP-MCP] Stdio server error: {e}");
            std::process::exit(1);
        }
        return;
    }

    // 2. Full Desktop GUI + Starship Unix Domain Socket Bridge Mode
    let monitor = TelemetryMonitor::new();
    let monitor_for_setup = monitor.clone();

    // Starship bridge setup
    let socket_path = default_socket_path();
    let manifest_path = match register_starship_manifest(&socket_path) {
        Ok(path) => {
            eprintln!(
                "[ATP-Bridge] Registered Starship capability manifest at {}",
                path.display()
            );
            Some(path)
        }
        Err(e) => {
            eprintln!("[ATP-Bridge] Warning: Could not register Starship manifest: {e}");
            None
        }
    };

    let bridge_socket_path = socket_path.clone();
    let bridge_cancel_token = CancellationToken::new();
    let cleanup_cancel_token = bridge_cancel_token.clone();
    let cleanup_manifest = manifest_path.clone();
    let cleanup_socket = socket_path.clone();

    let dispatcher = Arc::new(McpDispatcher::new());
    let agent_engine = Arc::new(AgentEngine::new(dispatcher.clone()));
    let voice_session = Arc::new(AudioCaptureSession::new());

    tauri::Builder::default()
        .manage(monitor)
        .manage(agent_engine)
        .manage(voice_session)
        .setup(move |app| {
            let monitor_sampling = monitor_for_setup.clone();
            tauri::async_runtime::spawn(async move {
                monitor_sampling.start_sampling_loop(1000);
            });
            let handle = app.handle().clone();
            let mut rx = monitor_for_setup.subscribe();
            tauri::async_runtime::spawn(async move {
                while let Ok(tick) = rx.recv().await {
                    let _ = handle.emit("evt://telemetry/tick", tick);
                }
            });

            // Start Starship Unix Domain Socket listener in background
            let bridge_server =
                UnixSocketServer::new(bridge_socket_path, dispatcher, bridge_cancel_token);

            tauri::async_runtime::spawn(async move {
                if let Err(e) = bridge_server.run().await {
                    eprintln!("[ATP-Bridge] Socket server stopped with error: {e}");
                }
            });

            println!("Agentic Tuneup Pro GUI initializing on Linux with Starship Bridge...");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cleaner_scan,
            commands::cleaner_execute_clean,
            commands::cleaner_list_quarantine,
            commands::cleaner_restore_quarantine,
            commands::cleaner_purge_quarantine,
            commands::safety_get_audit_log,
            commands::telemetry_get_snapshot,
            commands::telemetry_get_history,
            commands::health_get_score,
            commands::pkg_list_installed,
            commands::pkg_check_updates,
            commands::pkg_audit_orphans,
            commands::pkg_prepare_action,
            commands::proc_list,
            commands::proc_list_groups,
            commands::proc_kill,
            commands::service_list,
            commands::service_control,
            commands::autostart_list,
            commands::autostart_toggle,
            commands::agent_send_prompt,
            commands::agent_get_active_plan,
            commands::agent_approve_step,
            commands::agent_reject_step,
            commands::agent_abort,
            commands::agent_get_config,
            commands::agent_update_config,
            commands::diagnostic_run_analysis,
            commands::diagnostic_apply_fix,
            commands::snapshot_detect,
            commands::snapshot_create,
            commands::voice_start_capture,
            commands::voice_stop_capture,
            commands::voice_get_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                eprintln!("[ATP] Exiting. Cleaning up Starship manifest and bridge socket...");
                cleanup_cancel_token.cancel();
                if let Some(m_path) = &cleanup_manifest {
                    let _ = unregister_starship_manifest(m_path, Some(&cleanup_socket));
                }
            }
        });
}
