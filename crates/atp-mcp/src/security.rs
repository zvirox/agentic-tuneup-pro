#![allow(unsafe_code)]

use std::os::unix::io::AsRawFd;
use atp_core::{CoreError, ErrorKind};

/// Verifies that the peer connected to the Unix domain socket shares the same UID as current process.
#[cfg(target_os = "linux")]
pub fn verify_peer_cred<T: AsRawFd>(stream: &T) -> Result<u32, CoreError> {
    let fd = stream.as_raw_fd();
    let mut ucred = libc::ucred {
        pid: 0,
        uid: 0,
        gid: 0,
    };
    let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;

    let res = unsafe {
        libc::getsockopt(
            fd,
            libc::SOL_SOCKET,
            libc::SO_PEERCRED,
            &mut ucred as *mut _ as *mut libc::c_void,
            &mut len,
        )
    };

    if res != 0 {
        return Err(CoreError::new(
            ErrorKind::Mcp,
            "mcp.so_peercred_failed",
            false,
            "Failed to retrieve SO_PEERCRED from incoming socket stream.",
            None,
        ));
    }

    let current_uid = unsafe { libc::getuid() };
    if ucred.uid != current_uid {
        return Err(CoreError::new(
            ErrorKind::Safety,
            "safety.unauthorized_peer_uid",
            false,
            format!("Rejected connection: Peer UID ({}) != Host UID ({}).", ucred.uid, current_uid),
            Some(serde_json::json!({ "peer_uid": ucred.uid, "host_uid": current_uid })),
        ));
    }

    Ok(ucred.uid)
}

#[cfg(not(target_os = "linux"))]
pub fn verify_peer_cred<T: AsRawFd>(_stream: &T) -> Result<u32, CoreError> {
    Ok(0)
}
