#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
