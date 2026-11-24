pub mod dispatcher;
pub mod manifest;
pub mod protocol;
pub mod security;
pub mod server;
pub mod stdio;

pub use dispatcher::McpDispatcher;
pub use manifest::{
    default_manifest_path, default_socket_path, register_starship_manifest,
    unregister_starship_manifest,
};
pub use protocol::{
    JsonRpcError, JsonRpcRequest, JsonRpcResponse, McpToolDefinition, default_mcp_tools,
};
pub use security::verify_peer_cred;
pub use server::UnixSocketServer;
pub use stdio::run_stdio_server;
pub use tokio_util::sync::CancellationToken;
