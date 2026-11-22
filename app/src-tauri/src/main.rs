#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use atp_monitor::TelemetryMonitor;
use tauri::Emitter;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|arg| arg == "--mcp") {
        eprintln!("Starting Agentic Tuneup Pro in headless MCP mode...");
        // Headless MCP stdio loop is initialized here
        return;
    }

    let monitor = TelemetryMonitor::new();
    monitor.start_sampling_loop(1000);

    let monitor_for_setup = monitor.clone();

    tauri::Builder::default()
        .manage(monitor)
        .setup(move |app| {
            let handle = app.handle().clone();
            let mut rx = monitor_for_setup.subscribe();
            tauri::async_runtime::spawn(async move {
                while let Ok(tick) = rx.recv().await {
                    let _ = handle.emit("evt://telemetry/tick", tick);
                }
            });

            println!("Agentic Tuneup Pro GUI initializing on Linux...");
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
