use serde::{Deserialize, Serialize};
use atp_core::{CoreError, ErrorKind};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    #[serde(default)]
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

impl JsonRpcResponse {
    pub fn success(id: Option<serde_json::Value>, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: Some(result),
            error: None,
        }
    }

    pub fn error(id: Option<serde_json::Value>, error: JsonRpcError) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl JsonRpcError {
    pub fn parse_error(msg: impl Into<String>) -> Self {
        Self {
            code: -32700,
            message: msg.into(),
            data: None,
        }
    }

    pub fn invalid_request(msg: impl Into<String>) -> Self {
        Self {
            code: -32600,
            message: msg.into(),
            data: None,
        }
    }

    pub fn method_not_found(method: &str) -> Self {
        Self {
            code: -32601,
            message: format!("Method '{method}' not found"),
            data: Some(serde_json::json!({
                "kind": "mcp",
                "code": "mcp.tool_not_found",
                "retryable": false,
                "userMessage": format!("The requested tool or method '{method}' is not registered with Agentic Tuneup Pro."),
                "details": { "method": method }
            })),
        }
    }

    pub fn invalid_params(msg: impl Into<String>) -> Self {
        let msg_str = msg.into();
        Self {
            code: -32602,
            message: msg_str.clone(),
            data: Some(serde_json::json!({
                "kind": "mcp",
                "code": "mcp.invalid_arguments",
                "retryable": false,
                "userMessage": msg_str,
                "details": null
            })),
        }
    }

    pub fn internal_error(msg: impl Into<String>) -> Self {
        let msg_str = msg.into();
        Self {
            code: -32603,
            message: msg_str.clone(),
            data: Some(serde_json::json!({
                "kind": "mcp",
                "code": "mcp.internal_error",
                "retryable": false,
                "userMessage": msg_str,
                "details": null
            })),
        }
    }

    pub fn from_core_error(err: &CoreError) -> Self {
        Self {
            code: -32603,
            message: err.user_message.clone(),
            data: Some(serde_json::json!({
                "kind": match err.kind {
                    ErrorKind::Cleaner => "cleaner",
                    ErrorKind::Pkg => "pkg",
                    ErrorKind::Monitor => "monitor",
                    ErrorKind::Safety => "safety",
                    ErrorKind::Mcp => "mcp",
                    ErrorKind::Helper => "helper",
                    ErrorKind::Ipc => "ipc",
                    ErrorKind::Db => "db",
                },
                "code": err.code,
                "retryable": err.retryable,
                "userMessage": err.user_message,
                "details": err.details
            })),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolDefinition {
    pub name: String,
    pub description: String,
    pub risk_tier: u8,
    pub parameters: serde_json::Value,
}

/// Returns the standard set of MCP tool definitions provided by Agentic Tuneup Pro.
pub fn default_mcp_tools() -> Vec<McpToolDefinition> {
    vec![
        McpToolDefinition {
            name: "tuneup.get_health".into(),
            description: "Returns System Health Score (0-100), telemetry status, and storage breakdown".into(),
            risk_tier: 1,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
        McpToolDefinition {
            name: "tuneup.scan_junk".into(),
            description: "Scans system, browser, package, and dev caches; returns reclaimable bytes".into(),
            risk_tier: 1,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "categories": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["system", "browser", "package_cache", "dev", "app"]
                        }
                    }
                }
            }),
        },
        McpToolDefinition {
            name: "tuneup.clean_junk".into(),
            description: "Moves selected rule targets to quarantine. Generates an undo session ID.".into(),
            risk_tier: 2,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "ruleIds": {
                        "type": "array",
                        "items": { "type": "string" }
                    }
                },
                "required": ["ruleIds"]
            }),
        },
        McpToolDefinition {
            name: "tuneup.restore_quarantine".into(),
            description: "Restores a previous quarantine session's files back to original paths".into(),
            risk_tier: 2,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" }
                },
                "required": ["sessionId"]
            }),
        },
        McpToolDefinition {
            name: "tuneup.purge_quarantine".into(),
            description: "Permanently deletes quarantined files for a specific session or older than N days".into(),
            risk_tier: 3,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" },
                    "signatureToken": { "type": "string" }
                }
            }),
        },
        McpToolDefinition {
            name: "tuneup.list_packages".into(),
            description: "Lists installed packages across active backends (flatpak, native, appimage)".into(),
            risk_tier: 1,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "backendFilter": { "type": "string" }
                }
            }),
        },
        McpToolDefinition {
            name: "tuneup.list_orphans".into(),
            description: "Scans package managers for unused dependencies and flatpak runtimes".into(),
            risk_tier: 1,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
        McpToolDefinition {
            name: "tuneup.remove_packages".into(),
            description: "Removes packages from system (Requires confirmation/root helper)".into(),
            risk_tier: 3,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "packageIds": {
                        "type": "array",
                        "items": { "type": "string" }
                    },
                    "backend": { "type": "string" }
                },
                "required": ["packageIds"]
            }),
        },
        McpToolDefinition {
            name: "tuneup.purge_orphans".into(),
            description: "Removes unused package dependencies and unused Flatpak runtimes (Root action)".into(),
            risk_tier: 3,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "backend": {
                        "type": "string",
                        "enum": ["flatpak", "native", "all"]
                    }
                },
                "required": ["backend"]
            }),
        },
        McpToolDefinition {
            name: "atp.system.clean_package_cache".into(),
            description: "Purges obsolete package caches and orphaned libraries to reclaim disk space.".into(),
            risk_tier: 3,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "aggressive": { "type": "boolean", "default": false }
                }
            }),
        },
        McpToolDefinition {
            name: "tuneup.list_processes".into(),
            description: "Lists running processes sorted by resource consumption".into(),
            risk_tier: 1,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "sortBy": {
                        "type": "string",
                        "enum": ["cpu", "memory", "disk"]
                    },
                    "limit": { "type": "integer" }
                }
            }),
        },
        McpToolDefinition {
            name: "tuneup.kill_process".into(),
            description: "Terminates a runaway process or process tree".into(),
            risk_tier: 3,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "pid": { "type": "integer" },
                    "killTree": { "type": "boolean" }
                },
                "required": ["pid"]
            }),
        },
        McpToolDefinition {
            name: "tuneup.get_audit_log".into(),
            description: "Retrieves recent audit log entries of cleaner and administrative actions".into(),
            risk_tier: 1,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "limit": { "type": "integer" }
                }
            }),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_mcp_tools_list() {
        let tools = default_mcp_tools();
        assert!(tools.len() >= 10);
        assert!(tools.iter().any(|t| t.name == "tuneup.get_health"));
        assert!(tools.iter().any(|t| t.name == "tuneup.clean_junk"));
        assert!(tools.iter().any(|t| t.name == "tuneup.restore_quarantine"));
    }

    #[test]
    fn test_jsonrpc_serialization() {
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(serde_json::json!(1)),
            method: "starship/hello".into(),
            params: serde_json::json!({}),
        };
        let s = serde_json::to_string(&req).expect("serialize");
        let parsed: JsonRpcRequest = serde_json::from_str(&s).expect("deserialize");
        assert_eq!(req, parsed);

        let err = JsonRpcError::method_not_found("unknown.tool");
        let resp = JsonRpcResponse::error(Some(serde_json::json!(1)), err);
        let resp_json = serde_json::to_string(&resp).expect("serialize response");
        assert!(resp_json.contains("unknown.tool"));
    }
}
