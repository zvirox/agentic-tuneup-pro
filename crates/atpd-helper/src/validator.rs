use regex::Regex;
use std::sync::LazyLock;

static PACKAGE_NAME_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_\-\.\+]+$").expect("Valid regex")
});

pub fn is_valid_package_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 128 && PACKAGE_NAME_REGEX.is_match(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_package_names() {
        assert!(is_valid_package_name("firefox"));
        assert!(is_valid_package_name("libgtk2.0-0"));
        assert!(is_valid_package_name("python3+extra"));
    }

    #[test]
    fn test_invalid_package_names() {
        assert!(!is_valid_package_name(""));
        assert!(!is_valid_package_name("pkg;rm -rf /"));
        assert!(!is_valid_package_name("pkg && echo hi"));
        assert!(!is_valid_package_name("pkg|cat"));
        assert!(!is_valid_package_name("pkg`id`"));
    }
}
