#![allow(unsafe_code)]

use crate::protocol::{JsonRpcError, JsonRpcRequest, JsonRpcResponse, default_mcp_tools};
use atp_cleaner::{CleanerExecutor, ParallelScanner, RuleEngine};
use atp_core::{CoreError, ErrorKind};
use atp_monitor::{HealthScore, Sampler};
use atp_safety::{AuditStore, QuarantineStore};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

/// Central dispatcher for MCP and Starship JSON-RPC requests.
pub struct McpDispatcher {
    active_tokens: Arc<RwLock<HashMap<String, CancellationToken>>>,
}

impl Default for McpDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl McpDispatcher {
    pub fn new() -> Self {
        Self {
            active_tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Dispatches an incoming JSON-RPC request and returns the serialized response.
    pub async fn dispatch(&self, req: JsonRpcRequest) -> JsonRpcResponse {
        let req_id = req.id.clone();

        match req.method.as_str() {
            "starship/hello" => {
                let payload = serde_json::json!({
                    "appId": "atp",
                    "name": "Agentic Tuneup Pro",
                    "version": "0.1.0",
                    "tools": default_mcp_tools()
                });
                JsonRpcResponse::success(req_id, payload)
            }
            "initialize" => {
                let payload = serde_json::json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": { "listChanged": false }
                    },
                    "serverInfo": {
                        "name": "Agentic Tuneup Pro",
                        "version": "0.1.0"
                    }
                });
                JsonRpcResponse::success(req_id, payload)
            }
            "tools/list" => {
                let payload = serde_json::json!({
                    "tools": default_mcp_tools()
                });
                JsonRpcResponse::success(req_id, payload)
            }
            "ping" => JsonRpcResponse::success(req_id, serde_json::json!({})),
            "tools/call" => self.handle_tool_call(req_id, req.params).await,
            "tools/cancel" => self.handle_tool_cancel(req_id, req.params).await,
            unknown_method => {
                JsonRpcResponse::error(req_id, JsonRpcError::method_not_found(unknown_method))
            }
        }
    }

    async fn handle_tool_call(
        &self,
        req_id: Option<serde_json::Value>,
        params: serde_json::Value,
    ) -> JsonRpcResponse {
        let tool_name = match params.get("name").and_then(|v| v.as_str()) {
            Some(name) => name,
            None => {
                return JsonRpcResponse::error(
                    req_id,
                    JsonRpcError::invalid_params(
                        "Missing required 'name' field in tools/call params",
                    ),
                );
            }
        };

        let empty_obj = serde_json::json!({});
        let arguments = params.get("arguments").unwrap_or(&empty_obj);
        let lease_timeout_ms = params
            .get("leaseTimeoutMs")
            .and_then(|v| v.as_u64())
            .unwrap_or(30_000);

        let cancel_token = CancellationToken::new();
        let call_key = req_id
            .as_ref()
            .map(|id| id.to_string())
            .unwrap_or_else(|| tool_name.to_string());

        {
            let mut tokens = self.active_tokens.write().await;
            tokens.insert(call_key.clone(), cancel_token.clone());
        }

        let execute_fut = self.execute_named_tool(tool_name, arguments, cancel_token.clone());
        let timed_fut = tokio::time::timeout(Duration::from_millis(lease_timeout_ms), execute_fut);

        let res = tokio::select! {
            _ = cancel_token.cancelled() => {
                Err(CoreError::new(
                    ErrorKind::Mcp,
                    "mcp.cancelled",
                    false,
                    "Tool execution was cancelled by client.",
                    None,
                ))
            }
            outcome = timed_fut => {
                match outcome {
                    Ok(inner_res) => inner_res,
                    Err(_) => Err(CoreError::new(
                        ErrorKind::Mcp,
                        "mcp.lease_timeout",
                        true,
                        format!("Tool '{tool_name}' timed out after {lease_timeout_ms}ms."),
                        Some(serde_json::json!({ "leaseTimeoutMs": lease_timeout_ms })),
                    )),
                }
            }
        };

        {
            let mut tokens = self.active_tokens.write().await;
            tokens.remove(&call_key);
        }

        match res {
            Ok(output) => JsonRpcResponse::success(req_id, output),
            Err(core_err) => {
                JsonRpcResponse::error(req_id, JsonRpcError::from_core_error(&core_err))
            }
        }
    }

    async fn handle_tool_cancel(
        &self,
        req_id: Option<serde_json::Value>,
        params: serde_json::Value,
    ) -> JsonRpcResponse {
        let call_id = match params.get("callId") {
            Some(cid) => cid.to_string(),
            None => {
                return JsonRpcResponse::error(
                    req_id,
                    JsonRpcError::invalid_params(
                        "Missing required 'callId' in tools/cancel params",
                    ),
                );
            }
        };

        let tokens = self.active_tokens.read().await;
        if let Some(token) = tokens.get(&call_id) {
            token.cancel();
            JsonRpcResponse::success(
                req_id,
                serde_json::json!({ "cancelled": true, "callId": call_id }),
            )
        } else {
            JsonRpcResponse::success(
                req_id,
                serde_json::json!({ "cancelled": false, "reason": "call not active" }),
            )
        }
    }

    async fn execute_named_tool(
        &self,
        name: &str,
        args: &serde_json::Value,
        _cancel_token: CancellationToken,
    ) -> Result<serde_json::Value, CoreError> {
        match name {
            "tuneup.get_health" => self.tool_get_health().await,
            "tuneup.scan_junk" => self.tool_scan_junk(args).await,
            "tuneup.clean_junk" => self.tool_clean_junk(args).await,
            "tuneup.restore_quarantine" => self.tool_restore_quarantine(args).await,
            "tuneup.purge_quarantine" => self.tool_purge_quarantine(args).await,
            "tuneup.list_processes" => self.tool_list_processes(args).await,
            "tuneup.kill_process" => self.tool_kill_process(args).await,
            "tuneup.get_audit_log" => self.tool_get_audit_log(args).await,
            "tuneup.list_packages" => self.tool_list_packages(args).await,
            "tuneup.list_orphans" => self.tool_list_orphans().await,
            "tuneup.remove_packages" => self.tool_remove_packages(args).await,
            "tuneup.purge_orphans" => self.tool_purge_orphans(args).await,
            "atp.system.clean_package_cache" => self.tool_clean_package_cache(args).await,
            _ => Err(CoreError::new(
                ErrorKind::Mcp,
                "mcp.tool_not_found",
                false,
                format!("Tool '{name}' is not registered."),
                Some(serde_json::json!({ "toolName": name })),
            )),
        }
    }

    async fn tool_get_health(&self) -> Result<serde_json::Value, CoreError> {
        let mut sampler = Sampler::new();
        let snapshot = sampler.sample();

        let disk_pct = if snapshot.disk.total_bytes > 0 {
            (snapshot.disk.used_bytes as f32 / snapshot.disk.total_bytes as f32) * 100.0
        } else {
            0.0
        };

        let mem_pct = if snapshot.memory.total_bytes > 0 {
            (snapshot.memory.used_bytes as f32 / snapshot.memory.total_bytes as f32) * 100.0
        } else {
            0.0
        };

        let health =
            HealthScore::calculate(disk_pct, mem_pct, snapshot.cpu.temperature_celsius, 0, 0);

        Ok(serde_json::json!({
            "score": health.score,
            "rating": health.rating,
            "deductions": health.deductions,
            "snapshot": snapshot,
        }))
    }

    async fn tool_scan_junk(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let engine = RuleEngine::discover_and_load()?;
        let mut rules = engine.rules().to_vec();

        if let Some(cat_filter) = args.get("categories").and_then(|v| v.as_array()) {
            let filter_strings: Vec<String> = cat_filter
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            if !filter_strings.is_empty() {
                rules.retain(|r| filter_strings.contains(&r.category));
            }
        }

        let summary = ParallelScanner::scan_rules(&rules);

        Ok(serde_json::json!({
            "totalReclaimableBytes": summary.total_reclaimable_bytes,
            "totalFiles": summary.total_file_count,
            "blockedByRunningApps": summary.blocked_by_running_apps,
            "categories": summary.categories,
        }))
    }

    async fn tool_clean_junk(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let rule_ids = args
            .get("ruleIds")
            .and_then(|v| v.as_array())
            .ok_or_else(|| {
                CoreError::new(
                    ErrorKind::Mcp,
                    "mcp.invalid_arguments",
                    false,
                    "tuneup.clean_junk requires a 'ruleIds' array.",
                    None,
                )
            })?;

        let rule_ids_strings: Vec<String> = rule_ids
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        if rule_ids_strings.is_empty() {
            return Err(CoreError::new(
                ErrorKind::Mcp,
                "mcp.invalid_arguments",
                false,
                "'ruleIds' array must not be empty.",
                None,
            ));
        }

        let engine = RuleEngine::discover_and_load()?;
        let q_store = QuarantineStore::default_store();
        let audit_store = AuditStore::default_store()?;

        let output = CleanerExecutor::execute_clean(
            &rule_ids_strings,
            engine.rules(),
            &q_store,
            &audit_store,
        )?;

        Ok(serde_json::json!({
            "status": "success",
            "sessionId": output.session_id,
            "bytesReclaimed": output.bytes_freed,
            "filesMoved": output.files_count,
            "quarantinePath": output.quarantine_path.to_string_lossy(),
            "undoAvailable": true,
        }))
    }

    async fn tool_clean_package_cache(
        &self,
        _args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let engine = RuleEngine::discover_and_load()?;
        let pkg_rule_ids: Vec<serde_json::Value> = engine
            .rules()
            .iter()
            .filter(|r| r.category == "package_cache" || r.category == "package")
            .map(|r| serde_json::Value::String(r.id.clone()))
            .collect();

        if pkg_rule_ids.is_empty() {
            return Ok(serde_json::json!({
                "status": "success",
                "bytesReclaimed": 0,
                "filesMoved": 0,
                "message": "No package cache rules found or cache is already clean",
            }));
        }

        let clean_args = serde_json::json!({ "ruleIds": pkg_rule_ids });
        self.tool_clean_junk(&clean_args).await
    }

    async fn tool_restore_quarantine(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let session_id = args
            .get("sessionId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                CoreError::new(
                    ErrorKind::Mcp,
                    "mcp.invalid_arguments",
                    false,
                    "tuneup.restore_quarantine requires a 'sessionId' string.",
                    None,
                )
            })?;

        let q_store = QuarantineStore::default_store();
        let audit_store = AuditStore::default_store()?;

        let count = q_store.restore_session(session_id)?;

        let details_json = serde_json::json!({ "files_restored": count }).to_string();
        let _ = audit_store.record(
            "mcp",
            "cleaner.restore_quarantine",
            session_id,
            2,
            "restored",
            &details_json,
        );

        Ok(serde_json::json!({
            "sessionId": session_id,
            "status": "restored",
            "filesRestored": count,
        }))
    }

    async fn tool_purge_quarantine(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let q_store = QuarantineStore::default_store();
        let audit_store = AuditStore::default_store()?;

        let bytes_deleted = if let Some(session_id) = args.get("sessionId").and_then(|v| v.as_str())
        {
            let bytes = q_store.purge_session(session_id)?;
            let details_json = serde_json::json!({ "bytes_deleted": bytes }).to_string();
            let _ = audit_store.record(
                "mcp",
                "cleaner.purge_quarantine",
                session_id,
                3,
                "purged",
                &details_json,
            );
            bytes
        } else {
            let count = q_store.purge_expired_sessions(0)?;
            let details_json = serde_json::json!({ "sessions_purged": count }).to_string();
            let _ = audit_store.record(
                "mcp",
                "cleaner.purge_quarantine_all",
                "all",
                3,
                "purged",
                &details_json,
            );
            count as u64
        };

        Ok(serde_json::json!({
            "purged": true,
            "bytesDeleted": bytes_deleted,
        }))
    }

    async fn tool_list_processes(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let limit = args
            .get("limit")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize)
            .unwrap_or(25);

        let sort_by = args.get("sortBy").and_then(|v| v.as_str()).unwrap_or("cpu");

        let mut sys = sysinfo::System::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let mut procs: Vec<serde_json::Value> = sys
            .processes()
            .iter()
            .map(|(pid, proc_info)| {
                serde_json::json!({
                    "pid": pid.as_u32(),
                    "name": proc_info.name().to_string_lossy(),
                    "cpuPercent": proc_info.cpu_usage(),
                    "memoryBytes": proc_info.memory(),
                })
            })
            .collect();

        if sort_by == "memory" {
            procs.sort_by(|a, b| {
                let m_a = a.get("memoryBytes").and_then(|v| v.as_u64()).unwrap_or(0);
                let m_b = b.get("memoryBytes").and_then(|v| v.as_u64()).unwrap_or(0);
                m_b.cmp(&m_a)
            });
        } else {
            procs.sort_by(|a, b| {
                let c_a = a.get("cpuPercent").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let c_b = b.get("cpuPercent").and_then(|v| v.as_f64()).unwrap_or(0.0);
                c_b.partial_cmp(&c_a).unwrap_or(std::cmp::Ordering::Equal)
            });
        }

        procs.truncate(limit);

        Ok(serde_json::json!({
            "processes": procs,
            "count": procs.len(),
        }))
    }

    async fn tool_kill_process(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let pid = args.get("pid").and_then(|v| v.as_u64()).ok_or_else(|| {
            CoreError::new(
                ErrorKind::Mcp,
                "mcp.invalid_arguments",
                false,
                "tuneup.kill_process requires a numeric 'pid'.",
                None,
            )
        })? as u32;

        // Reject values that would wrap to pid 0 / -1 (process group / every process) after
        // the i32 cast, and PID 1; then go through the guarded ProcessManager path.
        if pid <= 1 || pid > i32::MAX as u32 {
            return Err(CoreError::new(
                ErrorKind::Safety,
                "safety.invalid_pid",
                false,
                format!("Refusing to signal PID {pid}: out of the allowed range."),
                Some(serde_json::json!({ "pid": pid })),
            ));
        }

        atp_procs::ProcessManager::send_signal(pid, libc::SIGTERM)?;

        if let Ok(audit_store) = AuditStore::default_store() {
            let _ = audit_store.record(
                "mcp",
                "procs.kill_process",
                &pid.to_string(),
                3,
                "success",
                r#"{"signal":"SIGTERM","via":"mcp"}"#,
            );
        }

        Ok(serde_json::json!({
            "status": "terminated",
            "pid": pid,
            "signal": "SIGTERM",
        }))
    }

    async fn tool_get_audit_log(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let limit = args
            .get("limit")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize)
            .unwrap_or(50);

        let audit_store = AuditStore::default_store()?;
        let entries = audit_store.list_recent(limit)?;

        Ok(serde_json::json!({
            "entries": entries,
            "count": entries.len(),
        }))
    }

    async fn tool_list_packages(
        &self,
        _args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        // Query flatpak if available on the system
        let mut packages = Vec::new();

        if let Ok(output) = tokio::process::Command::new("flatpak")
            .args(["list", "--app", "--columns=application,name,version,size"])
            .output()
            .await
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if !parts.is_empty() && !parts[0].trim().is_empty() {
                        let id = parts[0].trim().to_string();
                        let name = parts.get(1).map(|s| s.trim()).unwrap_or(&id).to_string();
                        let version = parts.get(2).map(|s| s.trim()).unwrap_or("").to_string();
                        let size = parts.get(3).map(|s| s.trim()).unwrap_or("").to_string();

                        packages.push(serde_json::json!({
                            "id": id,
                            "name": name,
                            "version": version,
                            "size": size,
                            "backend": "flatpak",
                        }));
                    }
                }
            }
        }

        Ok(serde_json::json!({
            "packages": packages,
            "count": packages.len(),
        }))
    }

    async fn tool_list_orphans(&self) -> Result<serde_json::Value, CoreError> {
        let mut orphans = Vec::new();

        if let Ok(output) = tokio::process::Command::new("flatpak")
            .args([
                "list",
                "--runtime",
                "--columns=application,name,version,size",
            ])
            .output()
            .await
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if !parts.is_empty() && !parts[0].trim().is_empty() {
                        orphans.push(serde_json::json!({
                            "id": parts[0].trim(),
                            "name": parts.get(1).map(|s| s.trim()).unwrap_or(""),
                            "backend": "flatpak",
                            "reason": "Unreferenced runtime",
                        }));
                    }
                }
            }
        }

        Ok(serde_json::json!({
            "orphans": orphans,
            "count": orphans.len(),
        }))
    }

    async fn tool_remove_packages(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let package_ids = args
            .get("packageIds")
            .and_then(|v| v.as_array())
            .ok_or_else(|| {
                CoreError::new(
                    ErrorKind::Mcp,
                    "mcp.invalid_arguments",
                    false,
                    "Missing 'packageIds'",
                    None,
                )
            })?;

        Ok(serde_json::json!({
            "status": "prepared",
            "requiresApproval": true,
            "riskTier": 3,
            "targetPackages": package_ids,
        }))
    }

    async fn tool_purge_orphans(
        &self,
        args: &serde_json::Value,
    ) -> Result<serde_json::Value, CoreError> {
        let backend = args
            .get("backend")
            .and_then(|v| v.as_str())
            .unwrap_or("flatpak");

        Ok(serde_json::json!({
            "status": "prepared",
            "requiresApproval": true,
            "riskTier": 3,
            "backend": backend,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_dispatcher_starship_hello() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(1)),
            method: "starship/hello".into(),
            params: serde_json::json!({}),
        };

        let resp = dispatcher.dispatch(req).await;
        assert_eq!(resp.jsonrpc, "2.0");
        assert_eq!(resp.id, Some(serde_json::json!(1)));
        assert!(resp.error.is_none());
        let res = resp.result.expect("result");
        assert_eq!(res.get("appId").and_then(|v| v.as_str()), Some("atp"));
    }

    #[tokio::test]
    async fn test_dispatcher_tools_list() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(2)),
            method: "tools/list".into(),
            params: serde_json::json!({}),
        };

        let resp = dispatcher.dispatch(req).await;
        let res = resp.result.expect("result");
        let tools = res
            .get("tools")
            .and_then(|v| v.as_array())
            .expect("tools array");
        assert!(tools.len() >= 10);
        let has_pkg_clean = tools.iter().any(|t| {
            t.get("name").and_then(|n| n.as_str()) == Some("atp.system.clean_package_cache")
        });
        assert!(
            has_pkg_clean,
            "Expected atp.system.clean_package_cache in tools list"
        );
    }

    #[tokio::test]
    async fn test_dispatcher_tool_call_get_health() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(3)),
            method: "tools/call".into(),
            params: serde_json::json!({
                "name": "tuneup.get_health",
                "arguments": {}
            }),
        };

        let resp = dispatcher.dispatch(req).await;
        assert!(resp.error.is_none(), "Unexpected error: {:?}", resp.error);
        let res = resp.result.expect("result");
        assert!(res.get("score").is_some());
        assert!(res.get("rating").is_some());
    }

    #[tokio::test]
    async fn test_dispatcher_tool_call_unknown_tool() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(4)),
            method: "tools/call".into(),
            params: serde_json::json!({
                "name": "tuneup.non_existent",
                "arguments": {}
            }),
        };

        let resp = dispatcher.dispatch(req).await;
        assert!(resp.result.is_none());
        let err = resp.error.expect("error");
        assert_eq!(err.code, -32603);
    }

    #[tokio::test]
    async fn test_dispatcher_tool_call_scan_junk() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(5)),
            method: "tools/call".into(),
            params: serde_json::json!({
                "name": "tuneup.scan_junk",
                "arguments": { "categories": ["system"] }
            }),
        };

        let resp = dispatcher.dispatch(req).await;
        assert!(resp.error.is_none(), "Unexpected error: {:?}", resp.error);
        let res = resp.result.expect("result");
        assert!(res.get("categories").is_some());
        assert!(res.get("totalReclaimableBytes").is_some());
    }

    #[tokio::test]
    async fn test_dispatcher_tool_call_get_audit_log() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(6)),
            method: "tools/call".into(),
            params: serde_json::json!({
                "name": "tuneup.get_audit_log",
                "arguments": { "limit": 10 }
            }),
        };

        let resp = dispatcher.dispatch(req).await;
        assert!(resp.error.is_none(), "Unexpected error: {:?}", resp.error);
        let res = resp.result.expect("result");
        assert!(res.get("entries").is_some());
    }

    #[tokio::test]
    async fn test_dispatcher_tool_cancel() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(7)),
            method: "tools/cancel".into(),
            params: serde_json::json!({
                "callId": 999
            }),
        };

        let resp = dispatcher.dispatch(req).await;
        assert!(resp.error.is_none());
        let res = resp.result.expect("result");
        assert_eq!(res.get("cancelled"), Some(&serde_json::json!(false)));
    }

    #[tokio::test]
    async fn test_dispatcher_unknown_method() {
        let dispatcher = McpDispatcher::new();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(5)),
            method: "random/unknown".into(),
            params: serde_json::json!({}),
        };

        let resp = dispatcher.dispatch(req).await;
        assert!(resp.result.is_none());
        let err = resp.error.expect("error");
        assert_eq!(err.code, -32601);
    }

    #[tokio::test]
    async fn test_kill_process_rejects_wrapping_and_init_pids() {
        let dispatcher = McpDispatcher::new();
        for bad in [0u64, 1, 4_294_967_295, 2_147_483_648] {
            let res = dispatcher
                .tool_kill_process(&serde_json::json!({ "pid": bad }))
                .await;
            assert!(res.is_err(), "pid {bad} must be rejected");
        }
    }
}
