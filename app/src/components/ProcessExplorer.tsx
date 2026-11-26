import { useEffect, useState } from "react";
import {
  AlertOctagon,
  Cpu,
  Layers,
  Play,
  Power,
  RotateCw,
  Search,
  ShieldAlert,
  Square,
  Terminal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  autostartList,
  autostartToggle,
  procKill,
  procList,
  procListGroups,
  serviceControl,
  serviceList,
} from "../lib/ipc";
import {
  AppProcessGroup,
  AutostartEntry,
  ProcessEntry,
  ServiceEntry,
} from "../types";
import {
  DataTable,
  DataTableColumn,
  LinearButton,
  LinearCard,
  LinearDialog,
  ProgressRow,
  StatusPill,
} from "./linear";

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
        setGroups(await procListGroups(sortBy));
      } else if (tab === "procs") {
        setProcs(await procList(sortBy));
      } else if (tab === "services") {
        setServices(await serviceList(false));
      } else if (tab === "autostart") {
        setAutostarts(await autostartList());
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

  const filteredGroups = groups.filter((g) =>
    g.appName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredProcs = procs.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredServices = services.filter((s) =>
    s.unitName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const maxGroupMem = Math.max(...filteredGroups.map((g) => g.totalMemoryBytes), 1);
  const maxProcMem = Math.max(...filteredProcs.map((p) => p.memoryBytes), 1);

  const groupColumns: DataTableColumn<AppProcessGroup>[] = [
    {
      key: "app",
      header: "Application",
      render: (grp) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-fg">{grp.appName}</span>
          {grp.isCritical && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-chip-red text-red-text border border-red font-medium">
              System core
            </span>
          )}
        </div>
      ),
    },
    {
      key: "workers",
      header: "Workers",
      render: (grp) => (
        <span className="font-mono text-xs bg-[var(--bg-surface-2)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] tabular-nums">
          {grp.processCount} pids
        </span>
      ),
    },
    {
      key: "cpu",
      header: "CPU Share",
      className: "min-w-[150px]",
      render: (grp) => (
        <ProgressRow
          label=""
          value={Math.min(100, grp.totalCpuPercent)}
          displayValue={`${grp.totalCpuPercent.toFixed(1)}%`}
          color="var(--primary)"
        />
      ),
    },
    {
      key: "mem",
      header: "Memory Share",
      className: "min-w-[160px]",
      render: (grp) => (
        <ProgressRow
          label=""
          value={(grp.totalMemoryBytes / maxGroupMem) * 100}
          displayValue={formatBytes(grp.totalMemoryBytes)}
          color="var(--sky)"
        />
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (grp) => (
        <LinearButton
          variant="danger"
          size="sm"
          disabled={grp.isCritical}
          onClick={() =>
            setTargetKillPid({
              pid: grp.rootPid,
              name: grp.appName,
              isCritical: grp.isCritical,
            })
          }
        >
          End Tree
        </LinearButton>
      ),
    },
  ];

  const procColumns: DataTableColumn<ProcessEntry>[] = [
    {
      key: "pid",
      header: "PID",
      render: (proc) => (
        <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
          {proc.pid}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (proc) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-fg">{proc.name}</span>
          {proc.isCritical && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-chip-red text-red-text border border-red font-medium">
              System core
            </span>
          )}
        </div>
      ),
    },
    {
      key: "cpu",
      header: "CPU%",
      className: "min-w-[140px]",
      render: (proc) => (
        <ProgressRow
          label=""
          value={Math.min(100, proc.cpuPercent)}
          displayValue={`${proc.cpuPercent.toFixed(1)}%`}
          color="var(--primary)"
        />
      ),
    },
    {
      key: "mem",
      header: "Memory",
      className: "min-w-[150px]",
      render: (proc) => (
        <ProgressRow
          label=""
          value={(proc.memoryBytes / maxProcMem) * 100}
          displayValue={formatBytes(proc.memoryBytes)}
          color="var(--sky)"
        />
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (proc) => (
        <LinearButton
          variant="danger"
          size="sm"
          disabled={proc.isCritical}
          onClick={() =>
            setTargetKillPid({
              pid: proc.pid,
              name: proc.name,
              isCritical: proc.isCritical,
            })
          }
        >
          Kill
        </LinearButton>
      ),
    },
  ];

  const serviceColumns: DataTableColumn<ServiceEntry>[] = [
    {
      key: "unit",
      header: "Service Unit",
      render: (svc) => (
        <span className="font-mono text-xs font-medium text-[var(--text)]">
          {svc.unitName}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (svc) => {
        const isRunning = svc.activeState === "active";
        return (
          <StatusPill
            label={`${svc.activeState} (${svc.subState})`}
            status={isRunning ? "online" : "idle"}
          />
        );
      },
    },
    {
      key: "desc",
      header: "Description",
      render: (svc) => (
        <span className="text-xs text-[var(--text-muted)] line-clamp-1">
          {svc.description}
        </span>
      ),
    },
    {
      key: "control",
      header: "Control",
      align: "right",
      render: (svc) => {
        const isRunning = svc.activeState === "active";
        return (
          <div className="inline-flex items-center gap-1.5">
            {isRunning ? (
              <LinearButton
                variant="danger"
                size="sm"
                onClick={() => handleServiceAction(svc.unitName, "stop")}
              >
                <Square className="size-3" aria-hidden="true" />
                <span>Stop</span>
              </LinearButton>
            ) : (
              <LinearButton
                variant="secondary"
                size="sm"
                onClick={() => handleServiceAction(svc.unitName, "start")}
              >
                <Play className="size-3 text-sky" aria-hidden="true" />
                <span>Start</span>
              </LinearButton>
            )}
            <LinearButton
              variant="secondary"
              size="sm"
              onClick={() => handleServiceAction(svc.unitName, "restart")}
            >
              Restart
            </LinearButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-app text-fg overflow-hidden">
      {/* Subheader Navigation */}
      <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-6 bg-app">
        <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-md border border-border text-xs font-medium">
          {[
            { id: "groups", label: "App Groups", icon: <Layers className="size-3.5" /> },
            { id: "procs", label: "All Processes", icon: <Cpu className="size-3.5" /> },
            { id: "services", label: "Systemd Services", icon: <Terminal className="size-3.5" /> },
            { id: "autostart", label: "Autostart Apps", icon: <Power className="size-3.5" /> },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors duration-150 cursor-pointer border ${
                tab === item.id
                  ? "bg-active text-fg border-border-strong"
                  : "text-muted hover:text-fg border-transparent"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {(tab === "groups" || tab === "procs") && (
            <div className="flex items-center bg-surface-2 p-0.5 rounded-md border border-border text-xs">
              <button
                type="button"
                onClick={() => setSortBy("cpu")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors duration-150 ${
                  sortBy === "cpu"
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                Sort: CPU%
              </button>
              <button
                type="button"
                onClick={() => setSortBy("memory")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors duration-150 ${
                  sortBy === "memory"
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                Sort: RAM
              </button>
            </div>
          )}

          <LinearButton variant="secondary" size="sm" onClick={loadData} disabled={loading}>
            <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Refresh</span>
          </LinearButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              Processes &amp; Services
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Monitor live application process trees, systemd units, and session autostart entries.
            </p>
          </div>

          <div className="h-8 flex items-center gap-2 bg-surface-2 border border-border rounded-md px-3 w-80 text-xs text-muted focus-within:border-[var(--primary)]">
            <Search className="size-3.5 shrink-0" aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search processes, units, or apps"
              aria-label="Search processes or units"
              className="bg-transparent border-0 outline-none text-[var(--text)] placeholder:text-[var(--text-faint)] w-full text-xs"
            />
          </div>
        </div>

        {tab === "groups" && (
          <DataTable
            columns={groupColumns}
            data={filteredGroups}
            rowKey={(g) => g.groupId}
            emptyMessage="No process groups matching filter."
          />
        )}

        {tab === "procs" && (
          <DataTable
            columns={procColumns}
            data={filteredProcs}
            rowKey={(p) => p.pid}
            emptyMessage="No processes matching filter."
          />
        )}

        {tab === "services" && (
          <DataTable
            columns={serviceColumns}
            data={filteredServices}
            rowKey={(s) => s.unitName}
            emptyMessage="No systemd services matching filter."
          />
        )}

        {tab === "autostart" && (
          <div className="space-y-2.5">
            {autostarts.map((item) => (
              <LinearCard
                key={item.fileName}
                level={1}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] flex items-center gap-2 text-[var(--text)]">
                    <span>{item.name}</span>
                    <span className="text-xs font-mono text-[var(--text-faint)]">
                      {item.fileName}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono truncate">
                    {item.exec}
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  onClick={() => handleAutostartToggle(item.fileName, item.enabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors duration-150 cursor-pointer shrink-0 ${
                    item.enabled
                      ? "bg-chip-sky text-sky-text border-border"
                      : "bg-surface-2 text-muted border-border"
                  }`}
                >
                  {item.enabled ? (
                    <ToggleRight className="size-4" aria-hidden="true" />
                  ) : (
                    <ToggleLeft className="size-4" aria-hidden="true" />
                  )}
                  <span>{item.enabled ? "Enabled" : "Disabled"}</span>
                </button>
              </LinearCard>
            ))}
          </div>
        )}
      </div>

      {/* Kill Process Modal */}
      <LinearDialog
        open={Boolean(targetKillPid)}
        onClose={() => setTargetKillPid(null)}
        ariaLabel="Terminate Process"
        maxWidthClass="max-w-md"
        className="p-5 space-y-4"
      >
        {targetKillPid && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">
                  Terminate Process
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Are you sure you want to terminate{" "}
                  <strong className="text-primary-text">{targetKillPid.name}</strong> (PID{" "}
                  <span className="font-mono">{targetKillPid.pid}</span>)?
                </p>
              </div>
              <div className="p-2 rounded-md bg-chip-red text-red-text border border-red">
                <AlertOctagon className="size-5" aria-hidden="true" />
              </div>
            </div>

            {targetKillPid.isCritical && (
              <div className="p-3 rounded-md bg-chip-red border border-red flex items-center gap-2 text-red-text text-xs">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                <span>This is a protected system core process and cannot be killed.</span>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={killTree}
                  onChange={(e) => setKillTree(e.target.checked)}
                  className="rounded border-border accent-[var(--primary)]"
                />
                <span>Terminate full process tree (all worker and child PIDs)</span>
              </label>

              <label className="flex items-center gap-2 text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceKill}
                  onChange={(e) => setForceKill(e.target.checked)}
                  className="rounded border-border accent-[var(--red)]"
                />
                <span className="text-red-text">
                  Force Kill (SIGKILL -9 instead of graceful SIGTERM)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <LinearButton variant="secondary" size="sm" onClick={() => setTargetKillPid(null)}>
                Cancel
              </LinearButton>
              <LinearButton
                variant="danger"
                size="sm"
                disabled={targetKillPid.isCritical}
                onClick={handleKillExecute}
              >
                Terminate Process
              </LinearButton>
            </div>
          </>
        )}
      </LinearDialog>
    </div>
  );
}
