import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Filter,
  Package,
  RotateCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  pkgAuditOrphans,
  pkgCheckUpdates,
  pkgListInstalled,
  pkgPrepareAction,
} from "../lib/ipc";
import { PackageInfo, PackagePlan, PackageUpdate } from "../types";
import { LinearButton, LinearCard, LinearDialog } from "./linear";

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function AppsView({
  onTriggerToast,
}: {
  onTriggerToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"installed" | "updates" | "orphans">("installed");
  const [backendFilter, setBackendFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [updates, setUpdates] = useState<PackageUpdate[]>([]);
  const [orphans, setOrphans] = useState<PackageInfo[]>([]);

  const [activePlan, setActivePlan] = useState<PackagePlan | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [installedList, updatesList, orphansList] = await Promise.all([
        pkgListInstalled(),
        pkgCheckUpdates(),
        pkgAuditOrphans(),
      ]);
      setPackages(installedList);
      setUpdates(updatesList);
      setOrphans(orphansList);
    } catch (err) {
      console.error("Failed loading package data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUninstallClick = async (pkg: PackageInfo) => {
    try {
      const plan = await pkgPrepareAction("remove", pkg.backend, pkg.id);
      setActivePlan(plan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Failed preparing package removal: ${msg}`);
    }
  };

  const handlePurgeOrphansClick = async () => {
    try {
      const plan = await pkgPrepareAction("purge_orphans", "flatpak", "all_orphans");
      setActivePlan(plan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Failed preparing orphan purge: ${msg}`);
    }
  };

  const handleConfirmPlan = () => {
    if (!activePlan) return;
    onTriggerToast(
      `Package execution via atpd-helper D-Bus bridge is not wired yet (Plan #${activePlan.plan_id}).`
    );
    setActivePlan(null);
  };

  const filteredPackages = packages.filter((p) => {
    const matchesFilter =
      backendFilter === "all" || p.backend.toLowerCase() === backendFilter.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalOrphanBytes = orphans.reduce((sum, o) => sum + (o.size_bytes || 0), 0);

  const backendTagStyle = (backend: string) => {
    if (backend === "flatpak") {
      return "bg-[var(--tint-purple)] text-[var(--color-purple)] border-[var(--tint-purple-border)]";
    }
    if (backend === "appimage") {
      return "bg-[var(--tint-amber)] text-[var(--color-amber)] border-[var(--tint-amber-border)]";
    }
    return "bg-[var(--tint-sky)] text-[var(--color-sky)] border-[var(--tint-sky-border)]";
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-app)] text-[var(--text)] overflow-hidden">
      {/* Subheader Navigation */}
      <div className="h-12 shrink-0 border-b border-[var(--border)] flex items-center justify-between px-6 bg-[var(--bg-surface)]">
        <div className="flex items-center gap-1 bg-[var(--bg-surface-2)] p-0.5 rounded-md border border-[var(--border)] text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab("installed")}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-colors duration-150 cursor-pointer border ${
              tab === "installed"
                ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
            }`}
          >
            <Package className="size-3.5" aria-hidden="true" />
            <span>Installed</span>
            <span className="text-[11px] bg-[var(--bg-surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded leading-none tabular-nums">
              {packages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("updates")}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-colors duration-150 cursor-pointer border ${
              tab === "updates"
                ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
            }`}
          >
            <ArrowUpCircle
              className={`size-3.5 ${updates.length > 0 ? "text-[var(--accent)]" : ""}`}
              aria-hidden="true"
            />
            <span>Updates</span>
            {updates.length > 0 && (
              <span className="text-[11px] bg-[var(--tint-blue)] text-[var(--color-blue)] border border-[var(--tint-blue-border)] font-medium px-1.5 py-0.5 rounded leading-none tabular-nums">
                {updates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab("orphans")}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-colors duration-150 cursor-pointer border ${
              tab === "orphans"
                ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
            }`}
          >
            <Trash2
              className={`size-3.5 ${orphans.length > 0 ? "text-[var(--color-amber)]" : ""}`}
              aria-hidden="true"
            />
            <span>Orphan Dependencies</span>
            {orphans.length > 0 && (
              <span className="text-[11px] bg-[var(--tint-amber)] text-[var(--color-amber)] border border-[var(--tint-amber-border)] px-1.5 py-0.5 rounded leading-none tabular-nums">
                {orphans.length}
              </span>
            )}
          </button>
        </div>

        <LinearButton
          variant="secondary"
          size="sm"
          onClick={loadData}
          disabled={loading}
        >
          <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          <span>Refresh</span>
        </LinearButton>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
              Applications &amp; Packages
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Inspect installed Flatpak, native, and AppImage packages, updates, and orphans.
            </p>
          </div>
        </div>

        {tab === "installed" && (
          <>
            {/* Filters & Search */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="h-8 flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-3 w-80 text-xs text-[var(--text-muted)] focus-within:border-[var(--accent)]">
                <Search className="size-3.5 shrink-0" aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search packages"
                  aria-label="Filter installed packages"
                  className="bg-transparent border-0 outline-none text-[var(--text)] placeholder:text-[var(--text-faint)] w-full text-xs"
                />
              </div>

              {/* Backend Filters */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[var(--text-muted)] flex items-center gap-1 mr-1">
                  <Filter className="size-3" aria-hidden="true" /> Source:
                </span>
                {(["all", "flatpak", "pacman", "apt", "appimage"] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setBackendFilter(source)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer border ${
                      backendFilter === source
                        ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
                        : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPackages.map((pkg) => (
                <LinearCard
                  key={`${pkg.backend}-${pkg.id}`}
                  level={1}
                  className="p-5 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] truncate text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-150">
                          {pkg.name}
                        </div>
                        <div className="text-xs font-mono text-[var(--text-faint)] truncate mt-0.5">
                          {pkg.id}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded border shrink-0 ${backendTagStyle(
                          pkg.backend
                        )}`}
                      >
                        {pkg.backend}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] mt-2.5 line-clamp-2 leading-relaxed">
                      {pkg.summary}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-mono text-[var(--text-muted)]">v{pkg.version}</span>
                      {pkg.size_bytes ? (
                        <>
                          <span className="text-[var(--text-faint)]">•</span>
                          <span className="font-medium text-[var(--accent)]">
                            {formatBytes(pkg.size_bytes)}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <LinearButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleUninstallClick(pkg)}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                      <span>Uninstall</span>
                    </LinearButton>
                  </div>
                </LinearCard>
              ))}
            </div>

            {filteredPackages.length === 0 && !loading && (
              <div className="text-center py-16 text-[var(--text-muted)] text-[13px]">
                No installed packages match the filter or search query.
              </div>
            )}
          </>
        )}

        {tab === "updates" && (
          <div className="space-y-4">
            <LinearCard level={1} className="p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Software Updates</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Keep system dependencies and containerized apps secure and up to date.
                </p>
              </div>
              {updates.length > 0 && (
                <LinearButton
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    onTriggerToast(
                      "Bulk package update via atpd-helper D-Bus bridge is not wired yet."
                    )
                  }
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>Update All ({updates.length})</span>
                </LinearButton>
              )}
            </LinearCard>

            <div className="space-y-2.5">
              {updates.map((up) => (
                <LinearCard
                  key={`${up.backend}-${up.package_id}`}
                  level={1}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-[13px] text-[var(--text)]">
                      {up.package_id}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2 font-mono tabular-nums">
                      <span>{up.current_version}</span>
                      <span className="text-[var(--accent)]">→</span>
                      <span className="text-[var(--accent)] font-medium">{up.new_version}</span>
                      <span className="text-[var(--text-faint)]">•</span>
                      <span>{up.backend}</span>
                    </div>
                  </div>

                  <LinearButton
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onTriggerToast(
                        `Update for ${up.package_id} via atpd-helper D-Bus bridge is not wired yet.`
                      )
                    }
                  >
                    Update
                  </LinearButton>
                </LinearCard>
              ))}

              {updates.length === 0 && !loading && (
                <div className="text-center py-16 flex flex-col items-center gap-2">
                  <CheckCircle2 className="size-8 text-[var(--color-green)]" aria-hidden="true" />
                  <span className="text-sm font-semibold text-[var(--text)]">
                    Everything is up to date
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    All Flatpak, host native, and standalone packages are on the latest versions.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "orphans" && (
          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-[var(--tint-amber)] border border-[var(--tint-amber-border)] flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[var(--color-amber)] font-semibold text-sm">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                  <span>Orphan Dependencies &amp; Unused Runtimes</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xl">
                  Libraries and Flatpak runtimes left behind after removing parent applications.
                  They have zero reverse dependencies and consume disk space safely reclaimable.
                </p>
                {totalOrphanBytes > 0 && (
                  <div className="mt-2.5 text-xs text-[var(--accent)] tabular-nums">
                    Total Reclaimable: <strong>{formatBytes(totalOrphanBytes)}</strong>
                  </div>
                )}
              </div>

              {orphans.length > 0 && (
                <LinearButton variant="primary" size="sm" onClick={handlePurgeOrphansClick}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>Purge Unused ({orphans.length})</span>
                </LinearButton>
              )}
            </div>

            <div className="space-y-2.5">
              {orphans.map((orph) => (
                <LinearCard
                  key={`${orph.backend}-${orph.id}`}
                  level={1}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-[13px] flex items-center gap-2 text-[var(--text)]">
                      <span>{orph.name}</span>
                      <span className="text-[11px] bg-[var(--bg-surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                        {orph.backend}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{orph.summary}</div>
                  </div>

                  <span className="text-xs font-semibold text-[var(--accent)] tabular-nums">
                    {formatBytes(orph.size_bytes)}
                  </span>
                </LinearCard>
              ))}

              {orphans.length === 0 && !loading && (
                <div className="text-center py-16 flex flex-col items-center gap-2">
                  <CheckCircle2 className="size-8 text-[var(--color-green)]" aria-hidden="true" />
                  <span className="text-sm font-semibold text-[var(--text)]">
                    Zero orphan packages detected
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    No leftover runtime versions or orphaned packages exist on this host.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Plan Execution Modal */}
      <LinearDialog
        open={Boolean(activePlan)}
        onClose={() => setActivePlan(null)}
        ariaLabel="Package Action Plan"
        maxWidthClass="max-w-lg"
        className="p-5 space-y-4"
      >
        {activePlan && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono text-[var(--accent)] bg-[var(--tint-blue)] px-2 py-0.5 rounded border border-[var(--tint-blue-border)]">
                  Plan #{activePlan.plan_id}
                </span>
                <h3 className="text-base font-semibold text-[var(--text)] mt-1.5">
                  Confirm Package {activePlan.action_type.toUpperCase()}
                </h3>
              </div>
              <div className="p-2 rounded-md bg-[var(--tint-amber)] text-[var(--color-amber)] border border-[var(--tint-amber-border)]">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2.5 text-xs bg-[var(--bg-surface-2)] p-4 rounded-lg border border-[var(--border)] font-mono">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Target:</span>
                <span className="text-[var(--text)] font-medium truncate">
                  {activePlan.target_package}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Disk Delta:</span>
                <span className="text-[var(--color-green)] font-medium tabular-nums">
                  {formatBytes(Math.abs(activePlan.disk_delta_bytes))} (Free)
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Polkit Elevation:</span>
                <span
                  className={
                    activePlan.requires_polkit
                      ? "text-[var(--color-amber)] font-medium"
                      : "text-[var(--text-muted)]"
                  }
                >
                  {activePlan.requires_polkit ? "Required (Polkit prompt)" : "User Session Only"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-muted)]">Risk Tier:</span>
                <span className="text-[var(--color-red)] font-medium">
                  Tier {activePlan.risk_tier} (Mutating)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-md bg-[var(--tint-amber)] border border-[var(--tint-amber-border)] text-xs text-[var(--text)]">
              Direct D-Bus execution (`atpd-helper`) is tracked in P0-4 / P1-A and not wired yet. Clicking below closes this preview safely without mutating packages.
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <LinearButton variant="secondary" size="sm" onClick={() => setActivePlan(null)}>
                Cancel
              </LinearButton>
              <LinearButton variant="danger" size="sm" onClick={handleConfirmPlan}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Preview Plan (Not Executed)</span>
              </LinearButton>
            </div>
          </>
        )}
      </LinearDialog>
    </div>
  );
}
