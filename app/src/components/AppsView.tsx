import { useState, useEffect } from "react";
import {
  Package,
  ArrowUpCircle,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import {
  pkgListInstalled,
  pkgCheckUpdates,
  pkgAuditOrphans,
  pkgPrepareAction,
} from "../lib/ipc";
import { PackageInfo, PackageUpdate, PackagePlan } from "../types";

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

  // Action plan modal state
  const [activePlan, setActivePlan] = useState<PackagePlan | null>(null);
  const [executingPlan, setExecutingPlan] = useState(false);

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

  const handleConfirmPlan = async () => {
    if (!activePlan) return;
    setExecutingPlan(true);
    try {
      // Simulate/trigger execution through helper
      await new Promise((res) => setTimeout(res, 800));
      onTriggerToast(`Action '${activePlan.action_type}' completed successfully!`);
      setActivePlan(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Execution failed: ${msg}`);
    } finally {
      setExecutingPlan(false);
    }
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

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas text-text-primary overflow-hidden">
      {/* Subheader Navigation */}
      <div className="h-14 border-b border-border-subtle flex items-center justify-between px-6 bg-raised/40">
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-border-subtle text-xs font-semibold">
          <button
            onClick={() => setTab("installed")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "installed"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Package size={14} />
            <span>Installed</span>
            <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded">
              {packages.length}
            </span>
          </button>

          <button
            onClick={() => setTab("updates")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "updates"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <ArrowUpCircle size={14} className={updates.length > 0 ? "text-accent" : ""} />
            <span>Updates</span>
            {updates.length > 0 && (
              <span className="text-[10px] font-mono bg-accent/20 text-accent font-bold px-1.5 py-0.5 rounded border border-accent/30 animate-pulse">
                {updates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab("orphans")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "orphans"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Trash2 size={14} className={orphans.length > 0 ? "text-amber-400" : ""} />
            <span>Orphan Dependencies</span>
            {orphans.length > 0 && (
              <span className="text-[10px] font-mono bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30">
                {orphans.length}
              </span>
            )}
          </button>
        </div>

        {/* Right refresh & actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle bg-surface-glass text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tab === "installed" && (
          <>
            {/* Filters & Search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-black/30 border border-border-subtle rounded-xl px-3 py-1.5 w-80 text-xs text-text-secondary focus-within:border-accent">
                <Search size={14} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter packages by name, ID, or summary..."
                  className="bg-transparent border-0 outline-none text-text-primary placeholder:text-text-disabled w-full"
                />
              </div>

              {/* Backend Filter Pills */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-disabled flex items-center gap-1 mr-1">
                  <Filter size={12} /> Source:
                </span>
                {(["all", "flatpak", "pacman", "apt", "appimage"] as const).map((source) => (
                  <button
                    key={source}
                    onClick={() => setBackendFilter(source)}
                    className={`px-2.5 py-1 rounded-lg uppercase font-mono text-[11px] transition-all cursor-pointer ${
                      backendFilter === source
                        ? "bg-accent text-accent-text font-bold shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                        : "bg-surface-glass border border-border-subtle text-text-secondary hover:text-text-primary"
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
                <div
                  key={`${pkg.backend}-${pkg.id}`}
                  className="p-4 rounded-2xl bg-surface-glass border border-border-subtle hover:border-accent/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate text-text-primary group-hover:text-accent transition-colors">
                          {pkg.name}
                        </div>
                        <div className="text-[11px] font-mono text-text-disabled truncate">
                          {pkg.id}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          pkg.backend === "flatpak"
                            ? "bg-purple-950/40 text-purple-300 border-purple-800/40"
                            : pkg.backend === "appimage"
                            ? "bg-amber-950/40 text-amber-300 border-amber-800/40"
                            : "bg-sky-950/40 text-sky-300 border-sky-800/40"
                        }`}
                      >
                        {pkg.backend}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary mt-2.5 line-clamp-2 leading-relaxed">
                      {pkg.summary}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-text-muted">
                        v{pkg.version}
                      </span>
                      {pkg.size_bytes ? (
                        <>
                          <span className="text-border-subtle">•</span>
                          <span className="font-mono text-[11px] text-accent">
                            {formatBytes(pkg.size_bytes)}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <button
                      onClick={() => handleUninstallClick(pkg)}
                      className="opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded-lg bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={11} />
                      <span>Uninstall</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredPackages.length === 0 && !loading && (
              <div className="text-center py-16 text-text-disabled text-sm">
                No installed packages match the filter or search query.
              </div>
            )}
          </>
        )}

        {tab === "updates" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-glass border border-border-subtle">
              <div>
                <h3 className="text-base font-bold text-text-primary">Software Updates</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Keep system dependencies and containerized apps secure and performant.
                </p>
              </div>
              {updates.length > 0 && (
                <button
                  onClick={() => onTriggerToast("Bulk package update dispatching...")}
                  className="px-4 py-2 rounded-xl bg-accent text-accent-text text-xs font-bold shadow-[0_0_15px_rgba(56,189,248,0.5)] hover:bg-accent-active transition-all cursor-pointer flex items-center gap-2"
                >
                  <Sparkles size={14} />
                  <span>Update All ({updates.length})</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {updates.map((up) => (
                <div
                  key={`${up.backend}-${up.package_id}`}
                  className="p-4 rounded-xl bg-surface-glass border border-border-subtle flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm">{up.package_id}</div>
                    <div className="text-xs text-text-secondary mt-1 flex items-center gap-2 font-mono">
                      <span>{up.current_version}</span>
                      <span className="text-accent">→</span>
                      <span className="text-accent font-bold">{up.new_version}</span>
                      <span className="text-border-subtle">•</span>
                      <span className="uppercase text-[10px] text-text-muted">{up.backend}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onTriggerToast(`Updating ${up.package_id}...`)}
                    className="px-3 py-1.5 rounded-lg bg-surface-glass-strong border border-border-glass hover:border-accent text-xs font-semibold text-text-primary transition-all cursor-pointer"
                  >
                    Update
                  </button>
                </div>
              ))}

              {updates.length === 0 && !loading && (
                <div className="text-center py-16 flex flex-col items-center gap-2">
                  <CheckCircle2 size={36} className="text-emerald-400" />
                  <span className="text-sm font-semibold">Everything is up to date!</span>
                  <span className="text-xs text-text-disabled">
                    All Flatpak, host native, and standalone packages are on the latest versions.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "orphans" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-900/40 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <AlertTriangle size={16} />
                  <span>Orphan Dependencies & Unused Runtimes</span>
                </div>
                <p className="text-xs text-text-secondary mt-1 max-w-xl">
                  Libraries and Flatpak runtimes left behind after removing parent applications.
                  They have zero reverse dependencies and consume disk space safely reclaimable.
                </p>
                {totalOrphanBytes > 0 && (
                  <div className="mt-3 text-xs font-mono text-accent">
                    Total Reclaimable: <strong className="font-bold">{formatBytes(totalOrphanBytes)}</strong>
                  </div>
                )}
              </div>

              {orphans.length > 0 && (
                <button
                  onClick={handlePurgeOrphansClick}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black text-xs font-bold shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-amber-300 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  <span>Purge Unused ({orphans.length})</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {orphans.map((orph) => (
                <div
                  key={`${orph.backend}-${orph.id}`}
                  className="p-4 rounded-xl bg-surface-glass border border-border-subtle flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span>{orph.name}</span>
                      <span className="text-[10px] font-mono uppercase bg-white/10 px-1.5 py-0.5 rounded text-text-muted">
                        {orph.backend}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary mt-1">{orph.summary}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-accent">
                      {formatBytes(orph.size_bytes)}
                    </span>
                  </div>
                </div>
              ))}

              {orphans.length === 0 && !loading && (
                <div className="text-center py-16 flex flex-col items-center gap-2">
                  <CheckCircle2 size={36} className="text-emerald-400" />
                  <span className="text-sm font-semibold">Zero orphan packages detected!</span>
                  <span className="text-xs text-text-disabled">
                    No leftover runtime versions or orphaned packages exist on this host.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Plan Execution Modal */}
      {activePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl bg-raised border border-border-glass shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                  Plan #{activePlan.plan_id}
                </span>
                <h3 className="text-base font-bold text-text-primary mt-1">
                  Confirm Package {activePlan.action_type.toUpperCase()}
                </h3>
              </div>
              <div className="p-2 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
                <ShieldAlert size={20} />
              </div>
            </div>

            <div className="space-y-3 text-xs bg-black/40 p-4 rounded-xl border border-border-subtle font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Target:</span>
                <span className="text-text-primary font-bold">{activePlan.target_package}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Disk Delta:</span>
                <span className="text-emerald-400 font-bold">
                  {formatBytes(Math.abs(activePlan.disk_delta_bytes))} (Free)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Polkit Elevation:</span>
                <span className={activePlan.requires_polkit ? "text-amber-400 font-bold" : "text-text-muted"}>
                  {activePlan.requires_polkit ? "Required (Polkit prompt)" : "User Session Only"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Risk Tier:</span>
                <span className="text-red-400 font-bold">Tier {activePlan.risk_tier} (Mutating)</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActivePlan(null)}
                disabled={executingPlan}
                className="px-4 py-2 rounded-xl border border-border-subtle bg-surface-glass text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPlan}
                disabled={executingPlan}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {executingPlan ? (
                  <RotateCw size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span>Confirm & Execute</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
