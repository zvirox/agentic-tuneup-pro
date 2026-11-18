use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorKind {
    Cleaner,
    Pkg,
    Monitor,
    Safety,
    Mcp,
    Helper,
    Ipc,
    Db,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Error)]
#[error("{user_message} ({code})")]
pub struct CoreError {
    pub kind: ErrorKind,
    pub code: String,
    pub retryable: bool,
    #[serde(rename = "userMessage")]
    pub user_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl CoreError {
    pub fn new(
        kind: ErrorKind,
        code: impl Into<String>,
        retryable: bool,
        user_message: impl Into<String>,
        details: Option<serde_json::Value>,
    ) -> Self {
        Self {
            kind,
            code: code.into(),
            retryable,
            user_message: user_message.into(),
            details,
        }
    }

    pub fn cleaner(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Cleaner, code, false, message, None)
    }

    pub fn safety(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Safety, code, false, message, None)
    }

    pub fn pkg(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Pkg, code, false, message, None)
    }

    pub fn mcp(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Mcp, code, false, message, None)
    }
}
