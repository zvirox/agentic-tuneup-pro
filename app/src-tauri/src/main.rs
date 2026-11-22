#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|arg| arg == "--mcp") {
        eprintln!("Starting Agentic Tuneup Pro in headless MCP mode...");
        // Headless MCP stdio loop is initialized here
        return;
    }

    tauri::Builder::default()
        .setup(|_app| {
            println!("Agentic Tuneup Pro GUI initializing on Linux...");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cleaner_list_quarantine,
            commands::cleaner_restore_quarantine,
            commands::cleaner_purge_quarantine,
            commands::safety_get_audit_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
