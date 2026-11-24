use crate::dispatcher::McpDispatcher;
use crate::protocol::{JsonRpcError, JsonRpcRequest, JsonRpcResponse};
use crate::security::verify_peer_cred;
use atp_core::{CoreError, ErrorKind};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio_util::sync::CancellationToken;

pub struct UnixSocketServer {
    socket_path: PathBuf,
    dispatcher: Arc<McpDispatcher>,
    cancel_token: CancellationToken,
}

impl UnixSocketServer {
    pub fn new(
        socket_path: PathBuf,
        dispatcher: Arc<McpDispatcher>,
        cancel_token: CancellationToken,
    ) -> Self {
        Self {
            socket_path,
            dispatcher,
            cancel_token,
        }
    }

    /// Prepares directory, clears stale socket, and binds UnixListener.
    pub fn bind_listener(socket_path: &Path) -> Result<UnixListener, CoreError> {
        if let Some(parent) = socket_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                CoreError::new(
                    ErrorKind::Mcp,
                    "mcp.socket_dir_create_failed",
                    false,
                    format!(
                        "Failed creating bridge socket directory {}: {e}",
                        parent.display()
                    ),
                    None,
                )
            })?;

            #[cfg(target_os = "linux")]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
            }
        }

        if socket_path.exists() {
            let _ = fs::remove_file(socket_path);
        }

        let listener = UnixListener::bind(socket_path).map_err(|e| {
            CoreError::new(
                ErrorKind::Mcp,
                "mcp.socket_bind_failed",
                false,
                format!(
                    "Failed binding Unix domain socket at {}: {e}",
                    socket_path.display()
                ),
                None,
            )
        })?;

        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(socket_path, fs::Permissions::from_mode(0o700));
        }

        Ok(listener)
    }

    /// Runs the Unix socket listener loop until cancellation.
    pub async fn run(&self) -> Result<(), CoreError> {
        let listener = Self::bind_listener(&self.socket_path)?;
        eprintln!("[ATP-Bridge] Listening on {}", self.socket_path.display());

        loop {
            tokio::select! {
                _ = self.cancel_token.cancelled() => {
                    eprintln!("[ATP-Bridge] Server received shutdown signal. Exiting socket loop.");
                    break;
                }
                accept_res = listener.accept() => {
                    match accept_res {
                        Ok((stream, _)) => {
                            let dispatcher = self.dispatcher.clone();
                            let cancel_token = self.cancel_token.clone();
                            tokio::spawn(async move {
                                Self::handle_connection(stream, dispatcher, cancel_token).await;
                            });
                        }
                        Err(e) => {
                            eprintln!("[ATP-Bridge] Socket accept error: {e}");
                        }
                    }
                }
            }
        }

        // Cleanup socket on exit
        if self.socket_path.exists() {
            let _ = fs::remove_file(&self.socket_path);
        }

        Ok(())
    }

    async fn handle_connection(
        mut stream: UnixStream,
        dispatcher: Arc<McpDispatcher>,
        cancel_token: CancellationToken,
    ) {
        // 1. Authenticate peer credentials via SO_PEERCRED
        if let Err(auth_err) = verify_peer_cred(&stream) {
            eprintln!(
                "[ATP-Bridge] Connection rejected: {}",
                auth_err.user_message
            );
            let err_resp = JsonRpcResponse::error(None, JsonRpcError::from_core_error(&auth_err));
            if let Ok(err_bytes) = serde_json::to_vec(&err_resp) {
                let _ = stream.write_all(&err_bytes).await;
                let _ = stream.write_all(b"\n").await;
            }
            return;
        }

        // 2. Split stream into reader and writer
        let (read_half, mut write_half) = stream.into_split();
        let mut lines = BufReader::new(read_half).lines();

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    break;
                }
                line_res = lines.next_line() => {
                    match line_res {
                        Ok(Some(line)) => {
                            let trimmed = line.trim();
                            if trimmed.is_empty() {
                                continue;
                            }

                            let response = match serde_json::from_str::<JsonRpcRequest>(trimmed) {
                                Ok(req) => dispatcher.dispatch(req).await,
                                Err(parse_err) => {
                                    JsonRpcResponse::error(
                                        None,
                                        JsonRpcError::parse_error(format!("Invalid JSON-RPC format: {parse_err}")),
                                    )
                                }
                            };

                            if let Ok(mut resp_bytes) = serde_json::to_vec(&response) {
                                resp_bytes.push(b'\n');
                                if let Err(e) = write_half.write_all(&resp_bytes).await {
                                    eprintln!("[ATP-Bridge] Failed writing socket response: {e}");
                                    break;
                                }
                                let _ = write_half.flush().await;
                            }
                        }
                        Ok(None) => {
                            // Client closed connection cleanly
                            break;
                        }
                        Err(e) => {
                            eprintln!("[ATP-Bridge] Socket read line error: {e}");
                            break;
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncWriteExt;

    #[tokio::test]
    async fn test_unix_socket_server_handshake() {
        let temp_dir = std::env::temp_dir().join(format!("atp_sock_test_{}", fastrand::u32(..)));
        let sock_path = temp_dir.join("test_bridge.sock");
        let dispatcher = Arc::new(McpDispatcher::new());
        let cancel_token = CancellationToken::new();

        let server = UnixSocketServer::new(sock_path.clone(), dispatcher, cancel_token.clone());

        let server_token = cancel_token.clone();
        let server_handle = tokio::spawn(async move {
            let _ = server.run().await;
        });

        // Give listener a moment to bind
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        // Connect as client
        let mut client = UnixStream::connect(&sock_path)
            .await
            .expect("connect to socket");

        // Send starship/hello
        let req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "starship/hello",
            "params": {}
        });
        let mut req_bytes = serde_json::to_vec(&req).unwrap();
        req_bytes.push(b'\n');
        client.write_all(&req_bytes).await.expect("send request");

        // Read response
        let (read_half, _) = client.into_split();
        let mut lines = BufReader::new(read_half).lines();
        let line = lines
            .next_line()
            .await
            .expect("read line")
            .expect("has line");

        let resp: JsonRpcResponse = serde_json::from_str(&line).expect("parse response");
        assert_eq!(resp.id, Some(serde_json::json!(1)));
        let result = resp.result.expect("has result");
        assert_eq!(result.get("appId").and_then(|v| v.as_str()), Some("atp"));

        // Shutdown server
        server_token.cancel();
        let _ = server_handle.await;

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
