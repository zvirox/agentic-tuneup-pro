use regex::Regex;
use std::sync::LazyLock;

static PACKAGE_NAME_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-zA-Z0-9_\-\.\+]+$").expect("Valid regex"));

static SERVICE_UNIT_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_\-\.\@]+\.(service|socket|timer)$").expect("Valid regex")
});

pub fn is_valid_package_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 128 && PACKAGE_NAME_REGEX.is_match(name)
}

pub fn is_valid_package_action(action: &str) -> bool {
    matches!(
        action,
        "install" | "remove" | "update" | "clean" | "autoremove"
    )
}

pub fn is_valid_backend(backend: &str) -> bool {
    matches!(backend, "flatpak" | "apt" | "pacman" | "dnf")
}

pub fn is_valid_service_unit(unit: &str) -> bool {
    !unit.is_empty() && unit.len() <= 128 && SERVICE_UNIT_REGEX.is_match(unit)
}

pub fn is_valid_service_action(action: &str) -> bool {
    matches!(
        action,
        "start" | "stop" | "restart" | "enable" | "disable" | "status"
    )
}

pub fn is_valid_signal(sig: i32) -> bool {
    sig == 15 || sig == 9
}

pub fn is_valid_keep_days(days: u32) -> bool {
    (1..=365).contains(&days)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_package_names() {
        assert!(is_valid_package_name("firefox"));
        assert!(is_valid_package_name("libgtk2.0-0"));
        assert!(is_valid_package_name("python3+extra"));
        assert!(is_valid_package_name("org.mozilla.firefox"));
    }

    #[test]
    fn test_invalid_package_names() {
        assert!(!is_valid_package_name(""));
        assert!(!is_valid_package_name("pkg;rm -rf /"));
        assert!(!is_valid_package_name("pkg && echo hi"));
        assert!(!is_valid_package_name("pkg|cat"));
        assert!(!is_valid_package_name("pkg`id`"));
        assert!(!is_valid_package_name("pkg$(id)"));
    }

    #[test]
    fn test_package_actions_and_backends() {
        assert!(is_valid_package_action("install"));
        assert!(is_valid_package_action("remove"));
        assert!(!is_valid_package_action("destroy"));

        assert!(is_valid_backend("flatpak"));
        assert!(is_valid_backend("apt"));
        assert!(is_valid_backend("pacman"));
        assert!(!is_valid_backend("curl_pipe_sh"));
    }

    #[test]
    fn test_service_units_and_actions() {
        assert!(is_valid_service_unit("pipewire.service"));
        assert!(is_valid_service_unit("cups.socket"));
        assert!(is_valid_service_unit("fstrim.timer"));
        assert!(!is_valid_service_unit("evil.sh"));
        assert!(!is_valid_service_unit("../etc/systemd/system/evil.service"));

        assert!(is_valid_service_action("restart"));
        assert!(is_valid_service_action("stop"));
        assert!(!is_valid_service_action("drop-tables"));
    }

    #[test]
    fn test_signals_and_keep_days() {
        assert!(is_valid_signal(15));
        assert!(is_valid_signal(9));
        assert!(!is_valid_signal(1));
        assert!(!is_valid_signal(0));

        assert!(is_valid_keep_days(7));
        assert!(is_valid_keep_days(1));
        assert!(!is_valid_keep_days(0));
        assert!(!is_valid_keep_days(500));
    }
}
