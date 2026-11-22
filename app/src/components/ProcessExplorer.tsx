import { useState, useEffect } from "react";
import {
  Cpu,
  Layers,
  Terminal,
  Play,
  Square,
  RotateCw,
  Search,
  ShieldAlert,
  Power,
  ToggleLeft,
  ToggleRight,
  AlertOctagon,
} from "lucide-react";
import {
  procList,
  procListGroups,
  procKill,
  serviceList,
  serviceControl,
  autostartList,
  autostartToggle,
} from "../lib/ipc";
import {
  ProcessEntry,
  AppProcessGroup,
  ServiceEntry,
  AutostartEntry,
} from "../types";

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ProcessExplorer({
  onTriggerToast,
}: {
  onTriggerToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"groups" | "procs" | "services" | "autostart">("groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"cpu" | "memory">("cpu");
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState<AppProcessGroup[]>([]);
  const [procs, setProcs] = useState<ProcessEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [autostarts, setAutostarts] = useState<AutostartEntry[]>([]);

  // Kill modal state
  const [targetKillPid, setTargetKillPid] = useState<{
    pid: number;
    name: string;
    isCritical: boolean;
  } | null>(null);
  const [killTree, setKillTree] = useState(true);
  const [forceKill, setForceKill] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === "groups") {
        const res = await procListGroups(sortBy);
        setGroups(res);
      } else if (tab === "procs") {
        const res = await procList(sortBy);
        setProcs(res);
      } else if (tab === "services") {
        const res = await serviceList(false);
        setServices(res);
      } else if (tab === "autostart") {
        const res = await autostartList();
        setAutostarts(res);
      }
    } catch (err) {
      console.error("Failed loading process explorer data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab, sortBy]);

  const handleKillExecute = async () => {
    if (!targetKillPid) return;
    try {
      const sig = forceKill ? 9 : 15;
      const killed = await procKill(targetKillPid.pid, killTree, sig);
      onTriggerToast(`Sent signal to ${killed.length} process(es) successfully.`);
      setTargetKillPid(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Kill failed: ${msg}`);
    }
  };

  const handleServiceAction = async (unitName: string, action: string) => {
    try {
      await serviceControl(unitName, action);
      onTriggerToast(`Service '${unitName}' ${action}ed.`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Service action failed: ${msg}`);
    }
  };

  const handleAutostartToggle = async (fileName: string, currentEnabled: boolean) => {
    try {
      await autostartToggle(fileName, !currentEnabled);
      onTriggerToast(`Autostart for '${fileName}' set to ${!currentEnabled}.`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Autostart toggle failed: ${msg}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas text-text-primary overflow-hidden">
      {/* Subheader Navigation */}
      <div className="h-14 border-b border-border-subtle flex items-center justify-between px-6 bg-raised/40">
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-border-subtle text-xs font-semibold">
          <button
            onClick={() => setTab("groups")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "groups"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Layers size={14} />
            <span>App Groups</span>
          </button>

          <button
            onClick={() => setTab("procs")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "procs"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Cpu size={14} />
            <span>All Processes</span>
          </button>

          <button
            onClick={() => setTab("services")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "services"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Terminal size={14} />
            <span>Systemd Services</span>
          </button>

          <button
            onClick={() => setTab("autostart")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              tab === "autostart"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Power size={14} />
            <span>Autostart Apps</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {(tab === "groups" || tab === "procs") && (
            <div className="flex items-center bg-black/30 p-1 rounded-xl border border-border-subtle text-xs">
              <button
                onClick={() => setSortBy("cpu")}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] cursor-pointer ${
                  sortBy === "cpu"
                    ? "bg-accent text-accent-text font-bold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Sort: CPU%
              </button>
              <button
                onClick={() => setSortBy("memory")}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] cursor-pointer ${
                  sortBy === "memory"
                    ? "bg-accent text-accent-text font-bold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Sort: RAM
              </button>
            </div>
          )}

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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-black/30 border border-border-subtle rounded-xl px-3 py-1.5 w-80 text-xs text-text-secondary focus-within:border-accent">
          <Search size={14} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search processes, units, or commands..."
            className="bg-transparent border-0 outline-none text-text-primary placeholder:text-text-disabled w-full"
          />
        </div>

        {tab === "groups" && (
          <div className="border border-border-subtle rounded-2xl overflow-hidden bg-surface-glass">
            <table className="w-full text-left text-xs">
              <thead className="bg-raised/60 text-text-secondary border-b border-border-subtle font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Application</th>
                  <th className="p-3.5">Workers</th>
                  <th className="p-3.5">Total CPU%</th>
                  <th className="p-3.5">Total Memory</th>
                  <th className="p-3.5 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/40">
                {groups
                  .filter((g) => g.appName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((grp) => (
                    <tr
                      key={grp.groupId}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="p-3.5 pl-5 font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          <span>{grp.appName}</span>
                          {grp.isCritical && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/40">
                              System Core
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-text-muted">
                        <span className="bg-black/30 px-2 py-0.5 rounded border border-border-subtle">
                          {grp.processCount} pids
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-accent">
                        {grp.totalCpuPercent.toFixed(1)}%
                      </td>
                      <td className="p-3.5 font-mono text-text-secondary">
                        {formatBytes(grp.totalMemoryBytes)}
                      </td>
                      <td className="p-3.5 text-right pr-5">
                        <button
                          disabled={grp.isCritical}
                          onClick={() =>
                            setTargetKillPid({
                              pid: grp.rootPid,
                              name: grp.appName,
                              isCritical: grp.isCritical,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          End Tree
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "procs" && (
          <div className="border border-border-subtle rounded-2xl overflow-hidden bg-surface-glass">
            <table className="w-full text-left text-xs">
              <thead className="bg-raised/60 text-text-secondary border-b border-border-subtle font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">PID</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">CPU%</th>
                  <th className="p-3.5">Memory</th>
                  <th className="p-3.5 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/40">
                {procs
                  .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((proc) => (
                    <tr
                      key={proc.pid}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="p-3.5 pl-5 font-mono text-text-muted">{proc.pid}</td>
                      <td className="p-3.5 font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          <span>{proc.name}</span>
                          {proc.isCritical && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/40">
                              System Core
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-accent">
                        {proc.cpuPercent.toFixed(1)}%
                      </td>
                      <td className="p-3.5 font-mono text-text-secondary">
                        {formatBytes(proc.memoryBytes)}
                      </td>
                      <td className="p-3.5 text-right pr-5">
                        <button
                          disabled={proc.isCritical}
                          onClick={() =>
                            setTargetKillPid({
                              pid: proc.pid,
                              name: proc.name,
                              isCritical: proc.isCritical,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-900/40 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Kill
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "services" && (
          <div className="border border-border-subtle rounded-2xl overflow-hidden bg-surface-glass">
            <table className="w-full text-left text-xs">
              <thead className="bg-raised/60 text-text-secondary border-b border-border-subtle font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Service Unit</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5 text-right pr-5">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/40">
                {services
                  .filter((s) => s.unitName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((svc) => {
                    const isRunning = svc.activeState === "active";
                    return (
                      <tr key={svc.unitName} className="hover:bg-white/[0.03] transition-colors">
                        <td className="p-3.5 pl-5 font-mono font-semibold text-text-primary">
                          {svc.unitName}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${
                              isRunning
                                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
                                : "bg-neutral-900 text-text-disabled border-border-subtle"
                            }`}
                          >
                            {svc.activeState} ({svc.subState})
                          </span>
                        </td>
                        <td className="p-3.5 text-text-secondary line-clamp-1">
                          {svc.description}
                        </td>
                        <td className="p-3.5 text-right pr-5 space-x-1.5">
                          {isRunning ? (
                            <button
                              onClick={() => handleServiceAction(svc.unitName, "stop")}
                              className="px-2 py-1 rounded bg-black/40 border border-border-subtle hover:border-red-500 text-[10px] text-red-400 font-semibold cursor-pointer"
                            >
                              <Square size={10} className="inline mr-1" /> Stop
                            </button>
                          ) : (
                            <button
                              onClick={() => handleServiceAction(svc.unitName, "start")}
                              className="px-2 py-1 rounded bg-black/40 border border-border-subtle hover:border-emerald-500 text-[10px] text-emerald-400 font-semibold cursor-pointer"
                            >
                              <Play size={10} className="inline mr-1" /> Start
                            </button>
                          )}
                          <button
                            onClick={() => handleServiceAction(svc.unitName, "restart")}
                            className="px-2 py-1 rounded bg-black/40 border border-border-subtle hover:border-accent text-[10px] text-accent font-semibold cursor-pointer"
                          >
                            Restart
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "autostart" && (
          <div className="space-y-3">
            {autostarts.map((item) => (
              <div
                key={item.fileName}
                className="p-4 rounded-xl bg-surface-glass border border-border-subtle flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span>{item.name}</span>
                    <span className="text-[10px] font-mono text-text-disabled">
                      {item.fileName}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5 font-mono">
                    {item.exec}
                  </div>
                </div>

                <button
                  onClick={() => handleAutostartToggle(item.fileName, item.enabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    item.enabled
                      ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                      : "bg-surface-glass text-text-disabled border-border-subtle"
                  }`}
                >
                  {item.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  <span>{item.enabled ? "Enabled" : "Disabled"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kill Process Modal */}
      {targetKillPid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-raised border border-border-glass shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Terminate Process
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Are you sure you want to terminate <strong className="text-accent">{targetKillPid.name}</strong> (PID {targetKillPid.pid})?
                </p>
              </div>
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertOctagon size={20} />
              </div>
            </div>

            {targetKillPid.isCritical && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2 text-red-300 text-xs">
                <ShieldAlert size={16} />
                <span>This is a protected system core process and cannot be killed.</span>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={killTree}
                  onChange={(e) => setKillTree(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Terminate full process tree (all worker and child PIDs)</span>
              </label>

              <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceKill}
                  onChange={(e) => setForceKill(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span className="text-red-400">Force Kill (SIGKILL -9 instead of graceful SIGTERM)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setTargetKillPid(null)}
                className="px-4 py-2 rounded-xl border border-border-subtle bg-surface-glass text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={targetKillPid.isCritical}
                onClick={handleKillExecute}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Terminate Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
