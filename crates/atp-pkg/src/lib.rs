pub mod appimage;
pub mod backend;
pub mod detector;
pub mod flatpak;
pub mod manager;
pub mod native;

pub use appimage::AppImageBackend;
pub use backend::{PackageBackend, PackageInfo, PackagePlan, PackageUpdate};
pub use detector::{DistroFamily, HostSystemProfile};
pub use flatpak::FlatpakBackend;
pub use manager::PackageManagerManager;
pub use native::NativeBackend;
