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
  Sparkles,
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Agent Drawer: Ctrl + Shift + A or Cmd + Shift + A
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setAgentOpen((prev) => !prev);
      }
      // Close Agent Drawer: Escape
      if (e.key === "Escape" && agentOpen) {
        e.preventDefault();
        setAgentOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [agentOpen]);

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
    } catch (err) {
      console.error("Scan failed", err);
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
      const catRuleIds = cat.rules.map((r) => r.rule_id);
      const allChecked = catRuleIds.every((id) => next.has(id));
      if (allChecked) {
        for (const id of catRuleIds) next.delete(id);
      } else {
        for (const id of catRuleIds) next.add(id);
      }
      return next;
    });
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await invoke<SnapshotRecord>("snapshot_create", {
        description: "Manual ATP pre-change snapshot test",
        provider: null,
      });
      if (res.success) {
        triggerToast(`Snapshot created via ${res.provider}! (ID: ${res.id})`);
      } else {
        triggerToast(`Snapshot notice: ${res.output_or_error || "Provider executed"}`);
      }
    } catch (err: unknown) {
      triggerToast(`Snapshot failed: ${err}`);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleExecuteClean = async () => {
    if (selectedRuleIds.size === 0 || cleaning) return;
    setCleaning(true);
    try {
      const out = await cleanerExecuteClean(Array.from(selectedRuleIds));
      setRecentSessionId(out.session_id);
      triggerToast(
        `Cleaned ${formatBytes(out.bytes_freed)} to Quarantine! Click Undo to restore.`
      );
      await runScan();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerToast(`Clean failed: ${msg}`);
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
    : 4509715660;

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
      className={`h-screen w-screen flex flex-col font-sans bg-canvas text-text-primary ${
        reduceEffects ? "reduce-effects" : ""
      }`}
    >
      {/* Top Titlebar */}
      <header className="h-14 border-b border-border-subtle flex items-center px-4 gap-4 bg-raised/70 select-none">
        {/* Brand */}
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <img
            src="/logo.png"
            alt="Agentic Tuneup Pro Logo"
            className="w-8 h-8 rounded-lg object-contain shadow-[0_0_15px_rgba(56,189,248,0.3)]"
          />
          <span className="text-sm font-semibold tracking-wide">Agentic Tuneup Pro</span>
          <span className="text-[10px] font-mono uppercase bg-accent-muted text-accent px-1.5 py-0.5 rounded border border-accent/20">
            v0.0.1-alpha
          </span>
        </div>

        {/* Workspace Presets */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-border-subtle text-xs font-medium ml-4">
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
            🏠 Daily
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
            💻 Dev
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
            🛡️ Server
          </button>
        </div>

        {/* Starship Control Bridge Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/40 border border-border-subtle text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
          <span className="text-text-muted">Starship Bridge:</span>
          <span className="text-accent font-semibold">atp.sock</span>
        </div>

        {/* Universal Search Bar */}
        <div className="ml-auto flex items-center gap-2 bg-black/30 border border-border-subtle rounded-xl px-3 py-1.5 w-72 text-xs text-text-secondary focus-within:border-accent">
          <Search size={14} />
          <input
            placeholder="Search apps, caches, or ask agent..."
            className="bg-transparent border-0 outline-none text-text-primary placeholder:text-text-disabled w-full"
          />
          <kbd className="font-mono text-[10px] border border-border-subtle px-1.5 py-0.5 rounded text-text-disabled">
            Ctrl K
          </kbd>
        </div>

        {/* Agent Toggle */}
        <button
          onClick={() => setAgentOpen(!agentOpen)}
          title="Toggle Starship Agent (Ctrl+Shift+A)"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            agentOpen
              ? "bg-accent text-accent-text border-transparent shadow-[0_0_12px_rgba(56,189,248,0.5)]"
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
              activePage === "apps"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Package size={16} />
            <span>Apps</span>
            <span className="ml-auto text-[10px] bg-signal-gate text-white px-1.5 py-0.2 rounded-full font-mono font-bold">
              12
            </span>
          </button>
          <button
            onClick={() => setActivePage("proc")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
              activePage === "set"
                ? "bg-accent-muted text-accent border border-accent/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <div className="mt-auto p-3 rounded-xl bg-signal-success-bg border border-signal-success/20 text-signal-success text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold mb-1">
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
                  <h1 className="text-xl font-bold tracking-tight">System Telemetry &amp; Health</h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Host: Linux (Wayland) · Live 1.0 Hz Push Stream
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setDiagnosticOpen(true)}
                    className="px-3.5 py-2 bg-purple-500/15 hover:bg-purple-500/25 active:bg-purple-500/35 text-purple-300 font-bold text-xs rounded-xl border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Intelligent bottleneck diagnosis"
                  >
                    <Activity size={14} className="text-purple-400" />
                    <span>Why is my PC slow?</span>
                  </button>
                  <button
                    onClick={() => {
                      setActivePage("clean");
                      triggerToast("Opening Smart Scan & Clean...");
                    }}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-text font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles size={14} />
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

              {/* Row 2: Secondary Details Section */}
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Reclaimable Storage Card */}
                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Reclaimable Cache Categories
                      </h3>
                      <button
                        onClick={() => setActivePage("clean")}
                        className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                      >
                        Clean All →
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-semibold">Web Browser Caches (Chrome &amp; Firefox)</span>
                        <span className="font-mono font-bold text-accent">1.32 GB</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-semibold">
                          Stale Development Artifacts (target/ &amp; node_modules)
                        </span>
                        <span className="font-mono font-bold text-signal-dev">2.10 GB</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-semibold">Package Manager Cache (apt &amp; flatpak)</span>
                        <span className="font-mono font-bold text-accent">0.52 GB</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                        <span className="font-semibold">Old Journal Logs &amp; Thumbnails</span>
                        <span className="font-mono font-bold text-text-secondary">0.26 GB</span>
                      </div>
                    </div>
                  </div>
                </div>

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
                  <h1 className="text-xl font-bold tracking-tight">System Cleaner &amp; Quarantine</h1>
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
                    className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-text text-xs font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all cursor-pointer disabled:opacity-50"
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
                  <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-xs text-text-secondary">
                      {scanning ? "Scanning system caches..." : "Click Rescan to discover junk"}
                    </span>
                  </div>
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
                <h1 className="text-xl font-bold tracking-tight">Settings &amp; Audit Trail</h1>
                <p className="text-xs text-text-secondary mt-0.5">
                  App preferences, Starship bridge configuration, and system mutation governance.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
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
                  <span className="text-[10px] font-mono text-signal-success font-bold bg-signal-success-bg px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <span>Pre-Change Snapshot Hooks</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-accent">
                        {snapshotCap?.recommended_provider
                          ? snapshotCap.recommended_provider.toUpperCase()
                          : snapshotCap?.btrfs_root_detected
                          ? "BTRFS ROOT"
                          : "AUTO-DETECT"}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      Automatically creates restorable filesystem snapshots before executing Tier 3 package actions.
                    </div>
                  </div>
                  <button
                    onClick={handleCreateSnapshot}
                    disabled={creatingSnapshot}
                    className="px-3 py-1.5 rounded-lg bg-surface-glass hover:bg-white/10 text-[11px] font-medium text-text-primary border border-border-subtle transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Camera size={13} className={creatingSnapshot ? "animate-spin" : ""} />
                    <span>{creatingSnapshot ? "Snapshotting..." : "Create Snapshot"}</span>
                  </button>
                </div>
              </div>

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
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl glass-panel-strong border border-accent/40 text-xs font-semibold text-text-primary flex items-center gap-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
