use crate::dispatcher::McpDispatcher;
use crate::protocol::{JsonRpcError, JsonRpcRequest, JsonRpcResponse};
use atp_core::CoreError;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio_util::sync::CancellationToken;

/// Runs a headless stdio JSON-RPC 2.0 processing loop.
/// Standard input is parsed for newline-delimited requests.
/// Responses are serialized and written directly to standard output.
/// Diagnostics and logging are restricted to standard error (stderr).
pub async fn run_stdio_server(
    dispatcher: Arc<McpDispatcher>,
    cancel_token: CancellationToken,
) -> Result<(), CoreError> {
    let stdin = tokio::io::stdin();
    let mut stdout = tokio::io::stdout();
    let mut lines = BufReader::new(stdin).lines();

    eprintln!("[ATP-MCP] Headless stdio loop initialized. Ready for JSON-RPC 2.0 messages.");

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                eprintln!("[ATP-MCP] Stdio loop received shutdown signal. Exiting.");
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
                            let _ = stdout.write_all(&resp_bytes).await;
                            let _ = stdout.flush().await;
                        }
                    }
                    Ok(None) => {
                        // EOF on stdin
                        break;
                    }
                    Err(e) => {
                        eprintln!("[ATP-MCP] Stdio read error: {e}");
                        break;
                    }
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_stdio_request_parsing() {
        let dispatcher = Arc::new(McpDispatcher::new());
        let req_json = r#"{"jsonrpc":"2.0","id":10,"method":"ping","params":{}}"#;

        let req: JsonRpcRequest = serde_json::from_str(req_json).expect("parse request");
        let resp = dispatcher.dispatch(req).await;

        assert_eq!(resp.id, Some(serde_json::json!(10)));
        assert_eq!(resp.result, Some(serde_json::json!({})));
    }
}
