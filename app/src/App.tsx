import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  Camera,
  Cpu,
  HardDrive,
  HeartPulse,
  MemoryStick,
  Package,
  Play,
  Settings,
  Trash2,
} from "lucide-react";
import { QuarantineView } from "./components/QuarantineView";
import { AuditTimeline } from "./components/AuditTimeline";
import { UndoButton } from "./components/UndoButton";
import { HealthGauge } from "./components/HealthGauge";
import { TelemetrySparkline } from "./components/TelemetrySparkline";
import { TopConsumersCard } from "./components/TopConsumersCard";
import { CategoryTree } from "./components/CategoryTree";
import { SamplePathsModal } from "./components/SamplePathsModal";
import { AppsView } from "./components/AppsView";
import { ProcessExplorer } from "./components/ProcessExplorer";
import { AgentDrawer } from "./components/AgentDrawer";
import { DiagnosticModal } from "./components/DiagnosticModal";
import { CommandPalette } from "./components/CommandPalette";
import { AriaAnnouncer } from "./components/AriaAnnouncer";
import { TuneupTelemetryChart } from "./components/TuneupTelemetryChart";
import {
  Breadcrumb,
  LINEAR_SERIES_TOKENS,
  LinearButton,
  LinearCard,
  ProgressRow,
  Sidebar,
  SidebarNavItem,
  SidebarWorkspace,
  StatCard,
  StatusPill,
  TitleBar,
  applyTheme,
  readCurrentTheme,
} from "./components/linear";
import {
  cleanerExecuteClean,
  cleanerScan,
  getHealthScore,
  getTelemetryHistory,
  getTelemetrySnapshot,
  procListGroups,
  snapshotCreate,
  snapshotDetect,
  subscribeTelemetry,
} from "./lib/ipc";
import {
  AppProcessGroup,
  CategoryScanResult,
  HealthScore,
  Page,
  RuleScanResult,
  ScanSummary,
  SnapshotCapability,
  TelemetrySnapshot,
} from "./types";

const PAGE_LABELS: Record<Page, string> = {
  dash: "Dashboard",
  clean: "System Cleaner",
  apps: "Applications",
  proc: "Processes & Services",
  set: "Settings & Audit",
};

const WORKSPACE_LABELS: Record<SidebarWorkspace, string> = {
  daily: "Daily Workspace",
  dev: "Developer Workspace",
  server: "Server Workspace",
};

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dash");
  const [workspace, setWorkspace] = useState<SidebarWorkspace>("daily");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [cleanerTab, setCleanerTab] = useState<"scan" | "quarantine">("scan");
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string | null>(null);
  const [snapshotCap, setSnapshotCap] = useState<SnapshotCapability | null>(null);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [recentSessionId, setRecentSessionId] = useState<string | null>(null);

  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [inspectingRule, setInspectingRule] = useState<RuleScanResult | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [topGroups, setTopGroups] = useState<AppProcessGroup[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([20, 22, 25, 24, 26, 23, 24]);
  const [memHistory, setMemHistory] = useState<number[]>([38, 38, 39, 39, 38, 39, 39]);
  const [diskHistory, setDiskHistory] = useState<number[]>([45, 48, 52, 49, 53, 56, 54]);
  const [netHistory, setNetHistory] = useState<number[]>([120, 340, 850, 420, 150, 600, 280]);
  const [health, setHealth] = useState<HealthScore>({
    score: 100,
    rating: "good",
    deductions: [],
  });

  useEffect(() => {
    getTelemetrySnapshot().then((snap) => setTelemetry(snap)).catch(() => {});
    getTelemetryHistory(30)
      .then((history) => {
        if (history.length > 0) {
          setCpuHistory(history.map((h) => h.cpu.aggregate_usage_percent));
          setMemHistory(
            history.map((h) =>
              h.memory.total_bytes > 0
                ? (h.memory.used_bytes / h.memory.total_bytes) * 100
                : 0
            )
          );
          setDiskHistory(
            history.map((h) =>
              h.disk && h.disk.total_bytes > 0
                ? Number(((h.disk.used_bytes / h.disk.total_bytes) * 100).toFixed(1))
                : 48.5
            )
          );
          setNetHistory(history.map((h) => h.network.download_bytes_per_sec / 1024));
        }
      })
      .catch(() => {});

    getHealthScore().then((h) => setHealth(h)).catch(() => {});
    procListGroups("cpu").then((g) => setTopGroups(g.slice(0, 4))).catch(() => {});
    snapshotDetect().then(setSnapshotCap).catch(() => {});
    runScan();

    let unlistenFn: (() => void) | null = null;
    subscribeTelemetry((snapshot) => {
      setTelemetry(snapshot);
      setCpuHistory((prev) => [...prev.slice(-29), snapshot.cpu.aggregate_usage_percent]);
      const memPct =
        snapshot.memory.total_bytes > 0
          ? (snapshot.memory.used_bytes / snapshot.memory.total_bytes) * 100
          : 0;
      setMemHistory((prev) => [...prev.slice(-29), memPct]);
      const diskPct =
        snapshot.disk && snapshot.disk.total_bytes > 0
          ? Number(((snapshot.disk.used_bytes / snapshot.disk.total_bytes) * 100).toFixed(1))
          : 48.5;
      setDiskHistory((prev) => [...prev.slice(-29), diskPct]);
      setNetHistory((prev) => [
        ...prev.slice(-29),
        snapshot.network.download_bytes_per_sec / 1024,
      ]);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const announce = (msg: string) => {
    setAriaAnnouncement(msg);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setAgentOpen((prev) => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "1") { e.preventDefault(); setActivePage("dash"); announce("Navigated to Dashboard"); }
        if (e.key === "2") { e.preventDefault(); setActivePage("clean"); announce("Navigated to System Cleaner"); }
        if (e.key === "3") { e.preventDefault(); setActivePage("apps"); announce("Navigated to Applications"); }
        if (e.key === "4") { e.preventDefault(); setActivePage("proc"); announce("Navigated to Processes"); }
        if (e.key === "5") { e.preventDefault(); setActivePage("set"); announce("Navigated to Settings"); }
      }

      if (e.key === "Escape") {
        if (commandPaletteOpen) {
          e.preventDefault();
          setCommandPaletteOpen(false);
          return;
        }
        if (diagnosticOpen) {
          e.preventDefault();
          setDiagnosticOpen(false);
          return;
        }
        if (inspectingRule) {
          e.preventDefault();
          setInspectingRule(null);
          return;
        }
        if (agentOpen) {
          e.preventDefault();
          setAgentOpen(false);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [agentOpen, commandPaletteOpen, diagnosticOpen, inspectingRule]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const runScan = async () => {
    setScanning(true);
    announce("Scanning system caches, package orphans, and stale artifacts...");
    try {
      const summary = await cleanerScan();
      setScanSummary(summary);
      const active = new Set<string>();
      for (const cat of summary.categories) {
        for (const r of cat.rules) {
          if (r.running_apps_blocking.length === 0) {
            active.add(r.rule_id);
          }
        }
      }
      setSelectedRuleIds(active);
      announce(
        `System scan complete. Found ${formatBytes(summary.total_reclaimable_bytes)} reclaimable.`
      );
    } catch (err) {
      console.error("Scan failed", err);
      announce("System scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleToggleRule = (ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleToggleCategory = (cat: CategoryScanResult) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      const safeRuleIds = cat.rules
        .filter((r) => r.running_apps_blocking.length === 0)
        .map((r) => r.rule_id);
      const allChecked =
        safeRuleIds.length > 0 && safeRuleIds.every((id) => next.has(id));
      if (allChecked) {
        for (const id of safeRuleIds) next.delete(id);
      } else {
        for (const id of safeRuleIds) next.add(id);
      }
      return next;
    });
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    announce("Creating filesystem snapshot...");
    try {
      const res = await snapshotCreate("Manual ATP pre-change snapshot", null);
      if (res.success) {
        triggerToast(`Snapshot created via ${res.provider} (ID: ${res.id})`);
        announce(`Filesystem snapshot created successfully via ${res.provider}.`);
      } else {
        triggerToast(`Snapshot notice: ${res.output_or_error || "Provider executed"}`);
        announce("Snapshot completed.");
      }
    } catch (err: unknown) {
      triggerToast(`Snapshot failed: ${err}`);
      announce("Filesystem snapshot creation failed.");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleExecuteClean = async () => {
    if (selectedRuleIds.size === 0 || cleaning) return;
    setCleaning(true);
    announce("Cleaning selected items to quarantine vault...");
    try {
      const out = await cleanerExecuteClean(Array.from(selectedRuleIds));
      if (out.session_id === "none" || out.files_count === 0) {
        triggerToast("Clean notice: No files required cleaning (or selected apps are active).");
        announce("No files required cleaning.");
      } else {
        setRecentSessionId(out.session_id);
        triggerToast(
          `Cleaned ${formatBytes(out.bytes_freed)} (${out.files_count} files) to Quarantine. Click Undo to restore.`
        );
        announce(`Cleaned ${formatBytes(out.bytes_freed)} to quarantine. Instant undo available.`);
      }
      await runScan();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerToast(`Clean notice: ${msg}`);
      announce(`Clean notice: ${msg}`);
    } finally {
      setCleaning(false);
    }
  };

  const handleToggleTheme = () => {
    const next = readCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    triggerToast(`Theme switched to ${next} mode`);
  };

  const selectedBytes = scanSummary
    ? scanSummary.categories.reduce((acc, cat) => {
        return (
          acc +
          cat.rules.reduce((rAcc, r) => {
            return selectedRuleIds.has(r.rule_id) ? rAcc + r.reclaimable_bytes : rAcc;
          }, 0)
        );
      }, 0)
    : 0;

  const totalReclaimable = scanSummary?.total_reclaimable_bytes ?? 0;

  const cpuPercent = telemetry ? Math.round(telemetry.cpu.aggregate_usage_percent) : 24;
  const memUsedGb = telemetry
    ? (telemetry.memory.used_bytes / (1024 * 1024 * 1024)).toFixed(1)
    : "6.2";
  const memTotalGb = telemetry
    ? Math.round(telemetry.memory.total_bytes / (1024 * 1024 * 1024))
    : 16;
  const diskUsedGb = telemetry?.disk
    ? Math.round(telemetry.disk.used_bytes / (1024 * 1024 * 1024))
    : 312;
  const diskTotalGb = telemetry?.disk
    ? Math.round(telemetry.disk.total_bytes / (1024 * 1024 * 1024))
    : 512;
  const diskPct = diskTotalGb > 0 ? Math.round((diskUsedGb / diskTotalGb) * 100) : 61;
  const memPctNow = memTotalGb > 0 ? Math.round((Number(memUsedGb) / memTotalGb) * 100) : 39;

  const tempC = telemetry?.cpu.temperature_celsius
    ? `${Math.round(telemetry.cpu.temperature_celsius)}°C`
    : "48°C";
  const netDownKb = telemetry
    ? `${Math.round(telemetry.network.download_bytes_per_sec / 1024)} KB/s`
    : "420 KB/s";

  const navItems: SidebarNavItem[] = [
    { id: "dash", label: "Dashboard", icon: <Activity className="size-4" /> },
    {
      id: "clean",
      label: "Cleaner",
      icon: <Trash2 className="size-4" />,
      badge: totalReclaimable > 0 ? formatBytes(totalReclaimable) : undefined,
    },
    { id: "apps", label: "Apps", icon: <Package className="size-4" /> },
    { id: "proc", label: "Processes", icon: <Cpu className="size-4" /> },
    { id: "set", label: "Settings", icon: <Settings className="size-4" /> },
  ];

  const categoriesForAnalyzer =
    scanSummary?.categories && scanSummary.categories.length > 0
      ? scanSummary.categories.map((cat) => ({
          id: cat.category_id,
          name: cat.display_name,
          bytes: cat.reclaimable_bytes,
        }))
      : [
          { id: "browser", name: "Web browser caches", bytes: 0 },
          { id: "dev", name: "Development artifacts", bytes: 0 },
          { id: "pkg", name: "Package manager cache", bytes: 0 },
          { id: "system", name: "System logs & thumbnails", bytes: 0 },
        ];

  const analyzerTotal = Math.max(
    categoriesForAnalyzer.reduce((sum, c) => sum + c.bytes, 0),
    1
  );

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-[var(--bg-app)] text-[var(--text)]">
      {/* Shared 40 px Title Bar */}
      <TitleBar />

      {/* Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Shared Collapsible Sidebar (240 px <-> 56 px, 36 px nav items) */}
        <Sidebar
          items={navItems}
          activeId={activePage}
          onSelect={(id) => setActivePage(id as Page)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          workspace={workspace}
          onSelectWorkspace={(ws) => {
            setWorkspace(ws);
            triggerToast(`Workspace: ${WORKSPACE_LABELS[ws]} Active`);
          }}
        />

        {/* Main Column: Breadcrumb + Active View */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Breadcrumb
            workspaceLabel={WORKSPACE_LABELS[workspace]}
            sectionLabel={PAGE_LABELS[activePage]}
            agentOpen={agentOpen}
            onToggleAgent={() => setAgentOpen((prev) => !prev)}
            onOpenSearch={() => setCommandPaletteOpen(true)}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col gap-5 bg-[var(--bg-app)]">
            {activePage === "dash" && (
              <>
                {/* Page Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                      System Telemetry &amp; Health
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Host: Linux ({telemetry?.disk?.mount_point || "/"}) · Live 1.0 Hz Push Stream
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LinearButton
                      variant="secondary"
                      size="md"
                      onClick={() => setDiagnosticOpen(true)}
                      title="Bottleneck diagnosis"
                    >
                      <Activity className="size-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                      <span>Why is my PC slow?</span>
                    </LinearButton>
                    <LinearButton
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setActivePage("clean");
                        triggerToast("Opening Smart Scan & Clean...");
                        runScan();
                      }}
                    >
                      <Play className="size-3.5" aria-hidden="true" />
                      <span>Smart Scan &amp; Clean</span>
                    </LinearButton>
                  </div>
                </div>

                {/* Top 4 StatCards (Health Score, Disk Used, Memory Used, Cleanable Space) */}
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 ${
                    agentOpen ? "" : "xl:grid-cols-4"
                  } gap-4`}
                >
                  <StatCard
                    title="Health Score"
                    value={health.score}
                    unit="/ 100"
                    tone={health.score >= 85 ? "sky" : health.score >= 65 ? "amber" : "red"}
                    icon={<HeartPulse className="size-4" aria-hidden="true" />}
                    delta={{
                      value: health.rating.toUpperCase(),
                      positive: health.score >= 65,
                      comparison: `${health.deductions.length} deductions`,
                    }}
                    sparklineData={[94, 92, 91, 90, 88, 87, health.score]}
                    sparklinePositive={health.score >= 65}
                  />

                  <StatCard
                    title="Disk Used"
                    value={diskUsedGb}
                    unit={`of ${diskTotalGb} GB`}
                    tone="primary"
                    icon={<HardDrive className="size-4" aria-hidden="true" />}
                    delta={{
                      value: `${diskPct}%`,
                      positive: diskPct < 85,
                      comparison: "Root volume",
                    }}
                    sparklineData={diskHistory.slice(-7)}
                    sparklinePositive={diskPct < 85}
                  />

                  <StatCard
                    title="Memory Used"
                    value={memUsedGb}
                    unit={`of ${memTotalGb} GB`}
                    tone="orange"
                    icon={<MemoryStick className="size-4" aria-hidden="true" />}
                    delta={{
                      value: `${memPctNow}%`,
                      positive: memPctNow < 85,
                      comparison: "Active RAM",
                    }}
                    sparklineData={memHistory.slice(-7)}
                    sparklinePositive={memPctNow < 85}
                  />

                  <StatCard
                    title="Cleanable Space"
                    value={scanning ? "..." : formatBytes(totalReclaimable)}
                    tone="amber"
                    icon={<Trash2 className="size-4" aria-hidden="true" />}
                    delta={{
                      value: `${scanSummary?.total_file_count ?? 0} files`,
                      positive: true,
                      comparison: "Reversible quarantine",
                    }}
                    onClick={() => setActivePage("clean")}
                  />
                </div>

                {/* Row 2: Health Donut & Live Hardware Sparklines */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <div className={agentOpen ? "xl:col-span-12" : "xl:col-span-5"}>
                    <HealthGauge
                      health={health}
                      onNavigate={(p) => setActivePage(p as Page)}
                    />
                  </div>

                  <div
                    className={`${
                      agentOpen
                        ? "xl:col-span-12 grid-cols-1 sm:grid-cols-2"
                        : "xl:col-span-7 grid-cols-1 sm:grid-cols-3"
                    } grid gap-4`}
                  >
                    <TelemetrySparkline
                      title="CPU Load"
                      currentValue={cpuPercent}
                      unit="%"
                      subValue={tempC}
                      dataPoints={cpuHistory}
                      maxValue={100}
                      color="var(--primary)"
                    />
                    <TelemetrySparkline
                      title="Memory"
                      currentValue={memUsedGb}
                      unit="GB"
                      subValue={`of ${memTotalGb} GB`}
                      dataPoints={memHistory}
                      maxValue={100}
                      color="var(--orange)"
                    />
                    <TelemetrySparkline
                      title="Network In"
                      currentValue={netDownKb}
                      subValue={telemetry?.network.interface_name || "eth0"}
                      dataPoints={netHistory}
                      color="var(--sky)"
                    />
                  </div>
                </div>

                {/* Row 3: ECharts Live Telemetry Line Chart */}
                <TuneupTelemetryChart
                  title="Live Hardware & Storage Telemetry"
                  subtitle="CPU aggregate, memory utilization, and storage load (%)"
                  series={[
                    {
                      name: "CPU Aggregate (%)",
                      data: cpuHistory,
                      color: "var(--primary)",
                    },
                    {
                      name: "Memory Used (%)",
                      data: memHistory,
                      color: "var(--orange)",
                    },
                    {
                      name: "Disk Utilization (%)",
                      data: diskHistory,
                      color: "var(--purple)",
                    },
                  ]}
                />

                {/* Row 4: Disk Analyzer & Top Consumers */}
                <div className={`grid grid-cols-1 ${agentOpen ? "" : "lg:grid-cols-2"} gap-4`}>
                  <LinearCard level={1} className="p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-medium uppercase tracking-wider text-muted truncate">
                        Disk Analyzer &amp; Cache Breakdown
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActivePage("clean")}
                        className="text-xs font-medium text-primary-text hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Inspect &amp; Clean →
                      </button>
                    </div>

                    {/* Stacked Allocation Bar */}
                    <div className="h-2 w-full rounded-[2px] bg-track overflow-hidden flex gap-0.5">
                      {categoriesForAnalyzer.map((cat, idx) => {
                        const pct =
                          totalReclaimable > 0 ? (cat.bytes / analyzerTotal) * 100 : 0;
                        if (pct <= 0) return null;
                        return (
                          <div
                            key={cat.id}
                            style={{
                              width: `${pct}%`,
                              backgroundColor: `var(${LINEAR_SERIES_TOKENS[idx % LINEAR_SERIES_TOKENS.length]})`,
                            }}
                            title={`${cat.name}: ${formatBytes(cat.bytes)}`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3">
                      {categoriesForAnalyzer.slice(0, 4).map((cat, idx) => (
                        <ProgressRow
                          key={cat.id}
                          label={cat.name}
                          value={
                            totalReclaimable > 0 ? (cat.bytes / analyzerTotal) * 100 : 0
                          }
                          displayValue={formatBytes(cat.bytes)}
                          color={`var(${LINEAR_SERIES_TOKENS[idx % LINEAR_SERIES_TOKENS.length]})`}
                        />
                      ))}
                    </div>
                  </LinearCard>

                  <TopConsumersCard
                    groups={topGroups}
                    onNavigate={(p) => setActivePage(p as Page)}
                  />
                </div>
              </>
            )}

            {activePage === "clean" && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                      System Cleaner &amp; Quarantine
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Safe, reversible disk cleaning. Every deletion stages to quarantine with instant Undo.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {recentSessionId && (
                      <UndoButton
                        sessionId={recentSessionId}
                        bytesCount={selectedBytes}
                        onRestored={() => {
                          triggerToast("Recent session successfully restored.");
                          setRecentSessionId(null);
                          runScan();
                        }}
                      />
                    )}
                    <LinearButton
                      variant="secondary"
                      size="md"
                      onClick={runScan}
                      disabled={scanning}
                    >
                      {scanning ? "Scanning..." : "Rescan"}
                    </LinearButton>
                    <LinearButton
                      variant="primary"
                      size="md"
                      onClick={handleExecuteClean}
                      disabled={selectedRuleIds.size === 0 || cleaning || scanning}
                    >
                      {cleaning
                        ? "Cleaning..."
                        : `Clean ${formatBytes(selectedBytes)} to Quarantine`}
                    </LinearButton>
                  </div>
                </div>

                {/* Subtabs */}
                <div className="flex items-center gap-1 border-b border-[var(--border)] pb-2.5">
                  <button
                    type="button"
                    onClick={() => setCleanerTab("scan")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer border ${
                      cleanerTab === "scan"
                        ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border-strong)]"
                        : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
                    }`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>Scan &amp; Clean Preview</span>
                    {scanSummary && (
                      <span className="text-[11px] bg-primary-tint text-primary-text border border-border px-1.5 py-0.5 rounded leading-none tabular-nums">
                        {formatBytes(selectedBytes)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCleanerTab("quarantine")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer border ${
                      cleanerTab === "quarantine"
                        ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border-strong)]"
                        : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
                    }`}
                  >
                    <Archive className="size-3.5" aria-hidden="true" />
                    <span>Quarantine Vault &amp; Undo</span>
                  </button>
                </div>

                {cleanerTab === "scan" ? (
                  scanSummary ? (
                    <CategoryTree
                      summary={scanSummary}
                      selectedRuleIds={selectedRuleIds}
                      onToggleRule={handleToggleRule}
                      onToggleCategory={handleToggleCategory}
                      onInspectRule={setInspectingRule}
                    />
                  ) : (
                    <LinearCard
                      level={1}
                      className="p-8 flex flex-col items-center justify-center text-center gap-2"
                    >
                      <span className="text-xs text-[var(--text-muted)]">
                        {scanning ? "Scanning system caches..." : "Click Rescan to discover junk"}
                      </span>
                    </LinearCard>
                  )
                ) : (
                  <QuarantineView onNotify={triggerToast} />
                )}

                {inspectingRule && (
                  <SamplePathsModal
                    rule={inspectingRule}
                    onClose={() => setInspectingRule(null)}
                  />
                )}
              </div>
            )}

            {activePage === "apps" && <AppsView onTriggerToast={triggerToast} />}

            {activePage === "proc" && <ProcessExplorer onTriggerToast={triggerToast} />}

            {activePage === "set" && (
              <div className="flex flex-col gap-6 max-w-4xl">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                    Settings &amp; Audit Trail
                  </h1>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Appearance preferences, Starship bridge status, and system mutation governance.
                  </p>
                </div>

                <LinearCard level={1} className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--text)]">
                        Linear Matte Design System
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        Solid opaque surfaces, 1 px borders, zero blur overhead. Toggle dark/light theme from the title bar.
                      </div>
                    </div>
                    <LinearButton variant="secondary" size="sm" onClick={handleToggleTheme}>
                      Switch Theme
                    </LinearButton>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--text)]">
                        Starship Control Bridge
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        Listens on <code className="font-mono">$XDG_RUNTIME_DIR/starship/bridges/atp.sock</code> with SO_PEERCRED
                      </div>
                    </div>
                    <StatusPill label="Active" status="online" />
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 gap-4">
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--text)] flex items-center gap-2">
                        <span>Pre-change Snapshot Hooks</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary-tint border border-border text-primary-text">
                          {snapshotCap?.recommended_provider
                            ? snapshotCap.recommended_provider
                            : snapshotCap?.btrfs_root_detected
                            ? "Btrfs root"
                            : "Auto-detect"}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        Create restorable filesystem snapshots via Timeshift, Snapper, or Btrfs.
                      </div>
                    </div>
                    <LinearButton
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateSnapshot}
                      disabled={creatingSnapshot}
                    >
                      <Camera
                        className={`size-3.5 ${creatingSnapshot ? "animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                      <span>{creatingSnapshot ? "Snapshotting..." : "Create Snapshot"}</span>
                    </LinearButton>
                  </div>
                </LinearCard>

                <AuditTimeline />
              </div>
            )}
          </main>
        </div>

        {/* Starship Cockpit Agent Drawer */}
        <AgentDrawer
          isOpen={agentOpen}
          onClose={() => setAgentOpen(false)}
          onTriggerToast={triggerToast}
        />

        {/* Diagnostic Modal ("Why is my PC slow?") */}
        <DiagnosticModal
          isOpen={diagnosticOpen}
          onClose={() => setDiagnosticOpen(false)}
          onRefreshTelemetry={() => {
            getTelemetrySnapshot().then(setTelemetry).catch(() => {});
            getHealthScore().then(setHealth).catch(() => {});
          }}
        />

        {/* Universal Command Palette (Ctrl+K) */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={(page) => {
            setActivePage(page);
            announce(`Navigated to ${page}`);
          }}
          onTriggerScan={() => runScan()}
          onTriggerUndo={() => {
            setActivePage("clean");
            setCleanerTab("quarantine");
          }}
          onOpenDiagnostics={() => setDiagnosticOpen(true)}
          onToggleAgent={() => setAgentOpen((prev) => !prev)}
          onCreateSnapshot={() => handleCreateSnapshot()}
          onToggleTheme={handleToggleTheme}
        />
      </div>

      <AriaAnnouncer message={ariaAnnouncement} />

      {/* Toast Notification */}
      {toastMsg && (
        <LinearCard
          level="overlay"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 text-xs font-medium text-fg flex items-center gap-2 z-50 border-primary"
        >
          <span className="size-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
          <span>{toastMsg}</span>
        </LinearCard>
      )}
    </div>
  );
}
