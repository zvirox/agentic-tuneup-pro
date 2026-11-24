import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  Trash2,
  Package,
  Cpu,
  Settings,
  Bot,
  Search,
  ShieldCheck,
  Play,
  Home,
  Monitor,
  Server,
  Archive,
  Camera,
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
import { LinearCard } from "./components/linear/LinearCard";
import { TitleBar } from "./components/linear/TitleBar";
import {
  cleanerScan,
  cleanerExecuteClean,
  getHealthScore,
  getTelemetrySnapshot,
  getTelemetryHistory,
  subscribeTelemetry,
} from "./lib/ipc";
import {
  HealthScore,
  TelemetrySnapshot,
  ScanSummary,
  RuleScanResult,
  CategoryScanResult,
  SnapshotCapability,
  SnapshotRecord,
} from "./types";

type Page = "dash" | "clean" | "apps" | "proc" | "set";
type Workspace = "daily" | "dev" | "server";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dash");
  const [workspace, setWorkspace] = useState<Workspace>("daily");
  const [agentOpen, setAgentOpen] = useState(false);
  const [reduceEffects, setReduceEffects] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [cleanerTab, setCleanerTab] = useState<"scan" | "quarantine">("scan");
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string | null>(null);
  const [snapshotCap, setSnapshotCap] = useState<SnapshotCapability | null>(null);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [recentSessionId, setRecentSessionId] = useState<string | null>("q_20261122_084500_8f3a");

  // Cleaner Scan & Rule States
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [inspectingRule, setInspectingRule] = useState<RuleScanResult | null>(null);

  // Real-time Telemetry & Health States
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([20, 22, 25, 24, 26, 23, 24]);
  const [memHistory, setMemHistory] = useState<number[]>([38, 38, 39, 39, 38, 39, 39]);
  const [diskHistory, setDiskHistory] = useState<number[]>([45, 48, 52, 49, 53, 56, 54]);
  const [netHistory, setNetHistory] = useState<number[]>([120, 340, 850, 420, 150, 600, 280]);
  const [health, setHealth] = useState<HealthScore>({
    score: 86,
    rating: "good",
    deductions: [
      {
        category: "junk",
        points: 8,
        reason: "4.2 GB of reclaimable junk detected in system and browser caches",
        action_label: "Clean Junk",
        target_page: "clean",
      },
      {
        category: "updates",
        points: 6,
        reason: "12 package updates pending across Flatpak and native",
        action_label: "View Updates",
        target_page: "apps",
      },
    ],
  });

  useEffect(() => {
    // Initial fetch of snapshot and history
    getTelemetrySnapshot().then((snap) => setTelemetry(snap));
    getTelemetryHistory(30).then((history) => {
      if (history.length > 0) {
        setCpuHistory(history.map((h) => h.cpu.aggregate_usage_percent));
        setMemHistory(
          history.map((h) =>
            h.memory.total_bytes > 0
              ? (h.memory.used_bytes / h.memory.total_bytes) * 100
              : 0
          )
        );
        setNetHistory(history.map((h) => h.network.download_bytes_per_sec / 1024));
      }
    });

    getHealthScore().then((h) => setHealth(h));
    invoke<SnapshotCapability>("snapshot_detect").then(setSnapshotCap).catch(() => {});
    runScan();

    // Subscribe to live 1.0 Hz telemetry stream
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

  // Global Keyboard Shortcuts (WCAG AA Compliant)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette: Ctrl + K or Cmd + K
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Toggle Agent Drawer: Ctrl + Shift + A or Cmd + Shift + A
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setAgentOpen((prev) => !prev);
        return;
      }

      // Quick Tab Switching: Alt + 1..5
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "1") { e.preventDefault(); setActivePage("dash"); announce("Navigated to Dashboard"); }
        if (e.key === "2") { e.preventDefault(); setActivePage("clean"); announce("Navigated to Cleaner"); }
        if (e.key === "3") { e.preventDefault(); setActivePage("apps"); announce("Navigated to Applications"); }
        if (e.key === "4") { e.preventDefault(); setActivePage("proc"); announce("Navigated to Processes"); }
        if (e.key === "5") { e.preventDefault(); setActivePage("set"); announce("Navigated to Settings"); }
      }

      // Escape key handles topmost overlay dismiss
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
      announce(`System scan complete. Found ${formatBytes(summary.total_reclaimable_bytes)} reclaimable.`);
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
      const allChecked = safeRuleIds.length > 0 && safeRuleIds.every((id) => next.has(id));
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
      const res = await invoke<SnapshotRecord>("snapshot_create", {
        description: "Manual ATP pre-change snapshot test",
        provider: null,
      });
      if (res.success) {
        triggerToast(`Snapshot created via ${res.provider}! (ID: ${res.id})`);
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
          `Cleaned ${formatBytes(out.bytes_freed)} (${out.files_count} files) to Quarantine! Click Undo to restore.`
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

  const cpuPercent = telemetry ? Math.round(telemetry.cpu.aggregate_usage_percent) : 24;
  const memUsedGb = telemetry
    ? (telemetry.memory.used_bytes / (1024 * 1024 * 1024)).toFixed(1)
    : "6.2";
  const memTotalGb = telemetry
    ? Math.round(telemetry.memory.total_bytes / (1024 * 1024 * 1024))
    : 16;
  const tempC = telemetry?.cpu.temperature_celsius
    ? `${Math.round(telemetry.cpu.temperature_celsius)}°C`
    : "48°C";
  const netDownKb = telemetry
    ? `${Math.round(telemetry.network.download_bytes_per_sec / 1024)} KB/s`
    : "4.2 MB/s";

  return (
    <div
      className={`h-screen w-screen flex flex-col font-sans bg-[var(--bg-app)] text-[var(--text)] ${
        reduceEffects ? "reduce-effects" : ""
      }`}
    >
      {/* 0. Window TitleBar */}
      <TitleBar
        title="Agentic Tuneup Pro"
        version="v0.1.0"
        icon={<img src="/logo.png" alt="ATP" className="w-4 h-4 rounded object-contain" />}
      />

      {/* Top Action Toolbar */}
      <header className="h-12 border-b border-[var(--border)] flex items-center px-4 gap-4 bg-[var(--bg-surface)] select-none">
        {/* Workspace Presets */}
        <div className="flex items-center bg-[var(--bg-surface-2)] p-0.5 rounded-lg border border-[var(--border)] text-xs font-medium">
          <button
            onClick={() => {
              setWorkspace("daily");
              triggerToast("Workspace: Daily Profile Active");
            }}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              workspace === "daily"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Home size={13} className="text-text-muted" /> Daily
          </button>
          <button
            onClick={() => {
              setWorkspace("dev");
              triggerToast("Workspace: Dev Profile (Scanning node_modules & targets)");
            }}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              workspace === "dev"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Monitor size={13} className="text-text-muted" /> Dev
          </button>
          <button
            onClick={() => {
              setWorkspace("server");
              triggerToast("Workspace: Server Profile (Services & Kernel)");
            }}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              workspace === "server"
                ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Server size={13} className="text-text-muted" /> Server
          </button>
        </div>

        {/* Starship Control Bridge Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/40 border border-border-subtle text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full bg-signal-success" />
          <span className="text-text-muted">Starship Bridge:</span>
          <span className="text-text-primary font-medium">atp.sock</span>
        </div>

        {/* Universal Search Bar / Command Palette Trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="ml-auto flex items-center gap-2 bg-black/30 hover:bg-black/50 border border-border-subtle hover:border-accent/40 rounded-xl px-3 py-1.5 w-72 text-xs text-text-secondary transition-colors cursor-pointer text-left focus-visible:border-accent"
          aria-label="Open command palette (Ctrl+K)"
        >
          <Search size={14} className="text-accent" />
          <span className="text-text-disabled truncate flex-1">
            Search
          </span>
          <kbd className="font-mono text-[10px] border border-border-subtle px-1.5 py-0.5 rounded text-text-disabled bg-white/5">
            Ctrl K
          </kbd>
        </button>

        {/* Agent Toggle */}
        <button
          onClick={() => setAgentOpen(!agentOpen)}
          title="Toggle Starship Agent (Ctrl+Shift+A)"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
            agentOpen
              ? "bg-accent text-accent-text border-transparent"
              : "bg-surface-glass border-border-glass hover:bg-white/10 text-text-primary"
          }`}
        >
          <Bot size={15} />
          <span>Agent</span>
          <kbd className="hidden sm:inline-block font-mono text-[9px] bg-black/30 border border-border-subtle px-1.5 py-0.5 rounded text-text-muted">
            ⌃⇧A
          </kbd>
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-52 border-r border-border-subtle p-3 flex flex-col gap-1 select-none bg-raised/30">
          <button
            onClick={() => setActivePage("dash")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
              activePage === "dash"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Activity size={16} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActivePage("clean")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
              activePage === "clean"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Trash2 size={16} />
            <span>Cleaner</span>
            <span className="ml-auto text-[10px] font-mono text-accent">4.2 GB</span>
          </button>
          <button
            onClick={() => setActivePage("apps")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
              activePage === "apps"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Package size={16} />
            <span>Apps</span>
            <span className="ml-auto text-[10px] font-mono text-text-secondary">12</span>
          </button>
          <button
            onClick={() => setActivePage("proc")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
              activePage === "proc"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Cpu size={16} />
            <span>Processes</span>
          </button>
          <button
            onClick={() => setActivePage("set")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
              activePage === "set"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <div className="mt-auto p-3 rounded-xl bg-signal-success-bg border border-signal-success/20 text-signal-success text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-medium mb-1">
              <ShieldCheck size={14} />
              <span>Safety Boundary</span>
            </div>
            Passwords &amp; keyrings are strictly protected and never touched.
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {activePage === "dash" && (
            <>
              {/* Header section */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">System Telemetry &amp; Health</h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Host: Linux (Wayland) · Live 1.0 Hz Push Stream
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setDiagnosticOpen(true)}
                    className="px-3.5 py-2 bg-surface-glass hover:bg-surface-solid text-text-primary font-medium text-xs rounded-lg border border-border-subtle transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Bottleneck diagnosis"
                  >
                    <Activity size={14} className="text-text-secondary" />
                    <span>Why is my PC slow?</span>
                  </button>
                  <button
                    onClick={() => {
                      setActivePage("clean");
                      triggerToast("Opening Smart Scan & Clean...");
                      runScan();
                    }}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-text font-medium text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Play size={14} />
                    <span>Smart Scan &amp; Clean</span>
                  </button>
                </div>
              </div>

              {/* Row 1: Health Gauge & Metric Sparklines */}
              <div className="grid grid-cols-12 gap-4">
                {/* Health Gauge: 5 columns */}
                <div className="col-span-5">
                  <HealthGauge health={health} onNavigate={(p) => setActivePage(p as Page)} />
                </div>

                {/* Telemetry Sparklines: 7 columns (3 cards) */}
                <div className="col-span-7 grid grid-cols-3 gap-4">
                  <TelemetrySparkline
                    title="CPU Load"
                    currentValue={cpuPercent}
                    unit="%"
                    subValue={tempC}
                    dataPoints={cpuHistory}
                    maxValue={100}
                    color="#38BDF8"
                  />
                  <TelemetrySparkline
                    title="Memory"
                    currentValue={memUsedGb}
                    unit="GB"
                    subValue={`of ${memTotalGb} GB`}
                    dataPoints={memHistory}
                    maxValue={100}
                    color="#A855F7"
                  />
                  <TelemetrySparkline
                    title="Network In"
                    currentValue={netDownKb}
                    subValue={telemetry?.network.interface_name || "eth0"}
                    dataPoints={netHistory}
                    color="#10B981"
                  />
                </div>
              </div>

              {/* Real-time Streaming ECharts Telemetry Visualizer */}
              <TuneupTelemetryChart
                title="Real-Time Hardware & Storage Telemetry"
                subtitle="Live streaming memory consumption, disk I/O utilization, and aggregate CPU throughput"
                series={[
                  {
                    name: "Memory Consumption (%)",
                    data: memHistory.slice(-7),
                    color: "#a855f7",
                  },
                  {
                    name: "Disk Utilization (%)",
                    data: diskHistory.slice(-7),
                    color: "#38bdf8",
                  },
                  {
                    name: "CPU Aggregate (%)",
                    data: cpuHistory.slice(-7),
                    color: "#10b981",
                  },
                ]}
              />

              {/* Row 2: Secondary Details Section */}
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Reclaimable Storage Card */}
                <LinearCard level="raised" className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-medium tracking-wider text-text-secondary">
                        Reclaimable cache categories
                      </h3>
                      <button
                        onClick={() => setActivePage("clean")}
                        className="text-xs font-medium text-accent hover:underline cursor-pointer"
                      >
                        Clean all →
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-medium">Web browser caches (Chrome &amp; Firefox)</span>
                        <span className="font-mono font-medium text-text-primary">1.32 GB</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-medium">
                          Stale development artifacts (target/ &amp; node_modules)
                        </span>
                        <span className="font-mono font-medium text-text-primary">2.10 GB</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-medium">Package manager cache (apt &amp; flatpak)</span>
                        <span className="font-mono font-medium text-text-primary">0.52 GB</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-medium">Old journal logs &amp; thumbnails</span>
                        <span className="font-mono font-medium text-text-primary">0.26 GB</span>
                      </div>
                    </div>
                  </div>
                </LinearCard>

                {/* Top Resource Consumers */}
                <TopConsumersCard onNavigate={(p) => setActivePage(p as Page)} />
              </div>
            </>
          )}

          {activePage === "clean" && (
            <div className="flex flex-col gap-5">
              {/* Cleaner Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">System Cleaner &amp; Quarantine</h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Safe, reversible disk cleaning. Every deletion stages to quarantine with instant Undo.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {recentSessionId && (
                    <UndoButton
                      sessionId={recentSessionId}
                      bytesCount={selectedBytes}
                      onRestored={() => {
                        triggerToast("Recent session successfully restored!");
                        setRecentSessionId(null);
                        runScan();
                      }}
                    />
                  )}
                  <button
                    onClick={runScan}
                    disabled={scanning}
                    className="px-3.5 py-1.5 rounded-xl border border-border-glass text-xs font-semibold hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {scanning ? "Scanning..." : "Rescan"}
                  </button>
                  <button
                    onClick={handleExecuteClean}
                    disabled={selectedRuleIds.size === 0 || cleaning || scanning}
                    className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {cleaning
                      ? "Cleaning..."
                      : `Clean ${formatBytes(selectedBytes)} to Quarantine`}
                  </button>
                </div>
              </div>

              {/* Subtabs: Scan Preview vs Quarantine Vault */}
              <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                <button
                  onClick={() => setCleanerTab("scan")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                    cleanerTab === "scan"
                      ? "bg-surface-glass-strong text-accent border border-accent/20 shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Trash2 size={13} />
                  <span>Scan &amp; Clean Preview</span>
                  {scanSummary && (
                    <span className="text-[10px] font-mono text-accent bg-accent-muted px-1.5 py-0.2 rounded">
                      {formatBytes(selectedBytes)}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCleanerTab("quarantine")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                    cleanerTab === "quarantine"
                      ? "bg-surface-glass-strong text-accent border border-accent/20 shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Archive size={13} />
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
                  <LinearCard level="raised" className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-xs text-text-secondary">
                      {scanning ? "Scanning system caches..." : "Click Rescan to discover junk"}
                    </span>
                  </LinearCard>
                )
              ) : (
                <QuarantineView onNotify={triggerToast} />
              )}

              {/* Sample Paths Transparency Modal */}
              {inspectingRule && (
                <SamplePathsModal
                  rule={inspectingRule}
                  onClose={() => setInspectingRule(null)}
                />
              )}
            </div>
          )}

          {activePage === "apps" && (
            <AppsView onTriggerToast={triggerToast} />
          )}

          {activePage === "proc" && (
            <ProcessExplorer onTriggerToast={triggerToast} />
          )}

          {activePage === "set" && (
            <div className="flex flex-col gap-6 max-w-4xl">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Settings &amp; Audit Trail</h1>
                <p className="text-xs text-text-secondary mt-0.5">
                  App preferences, Starship bridge configuration, and system mutation governance.
                </p>
              </div>

              <LinearCard level="raised" className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Reduce Effects</div>
                    <div className="text-[11px] text-text-secondary">
                      Disables backdrop blur and animations for low-end GPUs or pure X11
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reduceEffects}
                    onChange={(e) => {
                      setReduceEffects(e.target.checked);
                      triggerToast(
                        e.target.checked
                          ? "Reduce Effects Enabled (0px blur)"
                          : "Glass Effects Restored"
                      );
                    }}
                    className="w-5 h-5 accent-accent cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <div>
                    <div className="text-xs font-semibold">Starship Control Bridge</div>
                    <div className="text-[11px] text-text-secondary">
                      Listens on $XDG_RUNTIME_DIR/starship/bridges/atp.sock with SO_PEERCRED
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-signal-success">Active</span>
                </div>

                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <span>Pre-change snapshot hooks</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-accent">
                        {snapshotCap?.recommended_provider
                          ? snapshotCap.recommended_provider
                          : snapshotCap?.btrfs_root_detected
                          ? "Btrfs root"
                          : "Auto-detect"}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      Automatically creates restorable filesystem snapshots before executing Tier 3 package actions.
                    </div>
                  </div>
                  <button
                    onClick={handleCreateSnapshot}
                    disabled={creatingSnapshot}
                    className="px-3 py-1.5 rounded-lg bg-surface-glass hover:bg-white/10 text-[11px] font-medium text-text-primary border border-border-subtle transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Camera size={13} className={creatingSnapshot ? "animate-spin" : ""} />
                    <span>{creatingSnapshot ? "Snapshotting..." : "Create Snapshot"}</span>
                  </button>
                </div>
              </LinearCard>

              {/* Immutable Audit Log Component */}
              <div className="mt-2">
                <AuditTimeline />
              </div>
            </div>
          )}
        </main>

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
            getTelemetrySnapshot().then(setTelemetry);
            getHealthScore().then(setHealth);
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
          onToggleReduceEffects={() => setReduceEffects((prev) => !prev)}
          reduceEffects={reduceEffects}
        />
      </div>

      {/* Screen Reader Live Announcements */}
      <AriaAnnouncer message={ariaAnnouncement} />

      {/* Toast Notification */}
      {toastMsg && (
        <LinearCard
          level="overlay"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 text-xs font-semibold text-text-primary flex items-center gap-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 border-accent/40"
        >
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span>{toastMsg}</span>
        </LinearCard>
      )}
    </div>
  );
}
