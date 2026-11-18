import { useState, useEffect } from "react";
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
  Mic,
  X
} from "lucide-react";

type Page = "dash" | "clean" | "apps" | "proc" | "set";
type Workspace = "daily" | "dev" | "server";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dash");
  const [workspace, setWorkspace] = useState<Workspace>("daily");
  const [agentOpen, setAgentOpen] = useState(false);
  const [reduceEffects, setReduceEffects] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Simulated metrics
  const [cpuUsage, setCpuUsage] = useState(24);
  const [memUsed] = useState(6.2);
  const [healthScore] = useState(86);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage((prev) => Math.max(8, Math.min(92, Math.round(prev + (Math.random() - 0.5) * 6))));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans bg-canvas text-text-primary ${reduceEffects ? "reduce-effects" : ""}`}>
      {/* Top Titlebar */}
      <header className="h-14 border-b border-border-subtle flex items-center px-4 gap-4 bg-raised/70 select-none">
        {/* Brand */}
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-active flex items-center justify-center text-accent-text font-bold text-sm shadow-[0_0_15px_rgba(56,189,248,0.4)]">
            ⚡
          </div>
          <span className="text-sm font-semibold tracking-wide">Agentic Tuneup Pro</span>
          <span className="text-[10px] font-mono uppercase bg-accent-muted text-accent px-1.5 py-0.5 rounded border border-accent/20">
            v0.1.0
          </span>
        </div>

        {/* Workspace Presets */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-border-subtle text-xs font-medium ml-4">
          <button
            onClick={() => { setWorkspace("daily"); triggerToast("Workspace: Daily Profile Active"); }}
            className={`px-3 py-1 rounded-lg transition-colors ${workspace === "daily" ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass" : "text-text-secondary hover:text-text-primary"}`}
          >
            🏠 Daily
          </button>
          <button
            onClick={() => { setWorkspace("dev"); triggerToast("Workspace: Dev Profile (Scanning node_modules & targets)"); }}
            className={`px-3 py-1 rounded-lg transition-colors ${workspace === "dev" ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass" : "text-text-secondary hover:text-text-primary"}`}
          >
            💻 Dev
          </button>
          <button
            onClick={() => { setWorkspace("server"); triggerToast("Workspace: Server Profile (Services & Kernel)"); }}
            className={`px-3 py-1 rounded-lg transition-colors ${workspace === "server" ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass" : "text-text-secondary hover:text-text-primary"}`}
          >
            🛡️ Server
          </button>
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
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${agentOpen ? "bg-accent text-accent-text border-transparent shadow-[0_0_12px_rgba(56,189,248,0.5)]" : "bg-surface-glass border-border-glass hover:bg-white/10 text-text-primary"}`}
        >
          <Bot size={15} />
          <span>Agent</span>
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-52 border-r border-border-subtle p-3 flex flex-col gap-1 select-none bg-raised/30">
          <button
            onClick={() => setActivePage("dash")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activePage === "dash" ? "bg-accent-muted text-accent border border-accent/20" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
          >
            <Activity size={16} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActivePage("clean")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activePage === "clean" ? "bg-accent-muted text-accent border border-accent/20" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
          >
            <Trash2 size={16} />
            <span>Cleaner</span>
            <span className="ml-auto text-[10px] font-mono text-accent">4.2 GB</span>
          </button>
          <button
            onClick={() => setActivePage("apps")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activePage === "apps" ? "bg-accent-muted text-accent border border-accent/20" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
          >
            <Package size={16} />
            <span>Apps</span>
            <span className="ml-auto text-[10px] bg-signal-gate text-white px-1.5 py-0.2 rounded-full font-mono font-bold">12</span>
          </button>
          <button
            onClick={() => setActivePage("proc")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activePage === "proc" ? "bg-accent-muted text-accent border border-accent/20" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
          >
            <Cpu size={16} />
            <span>Processes</span>
          </button>
          <button
            onClick={() => setActivePage("set")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activePage === "set" ? "bg-accent-muted text-accent border border-accent/20" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
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
                  <p className="text-xs text-text-secondary mt-0.5">Host: Linux (Wayland) · 4.2 GB reclaimable</p>
                </div>
                <button
                  onClick={() => { setActivePage("clean"); triggerToast("Starting smart scan..."); }}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-text font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all flex items-center gap-2"
                >
                  <Sparkles size={14} />
                  <span>Smart Scan &amp; Clean</span>
                </button>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-4 gap-4">
                {/* CPU Card */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-text-secondary font-semibold uppercase tracking-wider">
                    <span>CPU</span>
                    <span className="font-mono text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-border-subtle">48°C</span>
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-text-primary">{cpuUsage}%</span>
                    <span className="text-xs text-text-secondary">8 cores · 3.4 GHz</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${cpuUsage}%` }}></div>
                  </div>
                </div>

                {/* Memory Card */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-text-secondary font-semibold uppercase tracking-wider">
                    <span>Memory</span>
                    <span className="font-mono text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-border-subtle">16 GB DDR5</span>
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-text-primary">{memUsed} GB</span>
                    <span className="text-xs text-text-secondary">used of 16 GB</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(memUsed / 16) * 100}%` }}></div>
                  </div>
                </div>

                {/* Disk Card */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-text-secondary font-semibold uppercase tracking-wider">
                    <span>Root Disk</span>
                    <span className="font-mono text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-border-subtle">NVMe</span>
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-text-primary">312 GB</span>
                    <span className="text-xs text-text-secondary">used of 512 GB</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: "61%" }}></div>
                  </div>
                </div>

                {/* Health Score Card */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between border-l-4 border-l-signal-success">
                  <div className="flex items-center justify-between text-xs text-text-secondary font-semibold uppercase tracking-wider">
                    <span>Health Score</span>
                    <span className="font-mono text-[11px] text-signal-success bg-signal-success-bg px-1.5 py-0.5 rounded font-bold">Good</span>
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="font-mono text-3xl font-bold text-signal-success">{healthScore}</span>
                    <span className="text-xs text-text-secondary">−14 pts (junk, updates)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActivePage("clean")} className="text-[11px] font-semibold text-accent hover:underline">
                      Clean junk →
                    </button>
                    <button onClick={() => setActivePage("apps")} className="text-[11px] font-semibold text-accent hover:underline">
                      Updates →
                    </button>
                  </div>
                </div>
              </div>

              {/* Secondary Details Section */}
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Reclaimable Storage Card */}
                <div className="glass-panel p-5 rounded-2xl flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Reclaimable Cache Categories</h3>
                    <button onClick={() => setActivePage("clean")} className="text-xs font-semibold text-accent hover:underline">
                      View all in Cleaner →
                    </button>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                      <span className="font-semibold">Web Browser Caches (Chrome &amp; Firefox)</span>
                      <span className="font-mono font-bold text-accent">1.32 GB</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                      <span className="font-semibold">Stale Development Artifacts (target/ &amp; node_modules)</span>
                      <span className="font-mono font-bold text-signal-dev">2.10 GB</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                      <span className="font-semibold">Package Manager Cache (apt/pacman &amp; flatpak)</span>
                      <span className="font-mono font-bold text-accent">0.52 GB</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border-subtle text-xs">
                      <span className="font-semibold">Old Journal Logs &amp; Thumbnails</span>
                      <span className="font-mono font-bold text-text-secondary">0.26 GB</span>
                    </div>
                  </div>
                </div>

                {/* Top Resource Consumers */}
                <div className="glass-panel p-5 rounded-2xl flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Top Resource Consumers</h3>
                    <button onClick={() => setActivePage("proc")} className="text-xs font-semibold text-accent hover:underline">
                      Process Explorer →
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Firefox</span>
                        <span className="text-[10px] text-text-secondary">(34 tabs)</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span>24.1% CPU</span>
                        <span className="text-text-secondary">1.8 GB RAM</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">VS Code</span>
                        <span className="text-[10px] text-text-secondary">(Rust Analyzer)</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span>11.3% CPU</span>
                        <span className="text-text-secondary">1.2 GB RAM</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">tracker-miner-fs</span>
                        <span className="text-[10px] text-signal-thinking">(Indexing)</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span>4.2% CPU</span>
                        <span className="text-text-secondary">210 MB RAM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activePage === "clean" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">System Cleaner &amp; Quarantine</h1>
                  <p className="text-xs text-text-secondary mt-0.5">All files are moved to quarantine first. Safe, reversible, and undoable.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => triggerToast("Rescanned 1,280 paths")} className="px-3 py-1.5 rounded-xl border border-border-glass text-xs font-semibold hover:bg-white/5">
                    Rescan
                  </button>
                  <button
                    onClick={() => triggerToast("Cleaned 4.2 GB to Quarantine! Click Undo to restore.")}
                    className="px-4 py-1.5 rounded-xl bg-accent text-accent-text text-xs font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)]"
                  >
                    Clean 4.2 GB to Quarantine
                  </button>
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border-subtle">
                  <div>
                    <div className="text-sm font-semibold">Chrome Cache &amp; Temporary Web Files</div>
                    <div className="text-xs text-text-secondary">Google Chrome rebuilds cache as needed · Passwords untouched</div>
                  </div>
                  <span className="font-mono text-sm font-bold text-accent">794 MB</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border-subtle">
                  <div>
                    <div className="text-sm font-semibold">Stale node_modules (6 projects)</div>
                    <div className="text-xs text-text-secondary">Unmodified for 90+ days · Recreated via npm/pnpm install</div>
                  </div>
                  <span className="font-mono text-sm font-bold text-signal-dev">2.10 GB</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border-subtle">
                  <div>
                    <div className="text-sm font-semibold">Unused Flatpak Runtimes</div>
                    <div className="text-xs text-text-secondary">GNOME Platform 44 runtimes no longer required by any app</div>
                  </div>
                  <span className="font-mono text-sm font-bold text-accent">780 MB</span>
                </div>
              </div>
            </div>
          )}

          {activePage === "set" && (
            <div className="flex flex-col gap-4 max-w-xl">
              <h1 className="text-xl font-bold tracking-tight">Settings</h1>
              <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Reduce Effects</div>
                    <div className="text-[11px] text-text-secondary">Disables backdrop blur and animations for low-end GPUs or pure X11</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reduceEffects}
                    onChange={(e) => {
                      setReduceEffects(e.target.checked);
                      triggerToast(e.target.checked ? "Reduce Effects Enabled (0px blur)" : "Glass Effects Restored");
                    }}
                    className="w-5 h-5 accent-accent cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <div>
                    <div className="text-xs font-semibold">Starship Control Bridge</div>
                    <div className="text-[11px] text-text-secondary">Listens on $XDG_RUNTIME_DIR/starship/bridges/atp.sock with SO_PEERCRED</div>
                  </div>
                  <span className="text-[10px] font-mono text-signal-success font-bold bg-signal-success-bg px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Collapsible Right-Side Agent Drawer */}
        {agentOpen && (
          <aside className="w-96 border-l border-border-subtle bg-raised/70 flex flex-col select-none">
            {/* Drawer Header */}
            <div className="h-14 border-b border-border-subtle px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-signal-success animate-pulse" />
                <span className="text-xs font-bold">Starship Agent</span>
                <span className="text-[10px] font-mono text-text-secondary">local · llama3.1</span>
              </div>
              <button onClick={() => setAgentOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            {/* Messages / Task Sheet Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-border-subtle text-xs leading-relaxed">
                Hi! Tell me what you want to clean, optimize, or diagnose. I will generate a preview plan first.
              </div>

              {/* Sample Task Sheet Card */}
              <div className="glass-panel-strong p-3.5 rounded-xl border border-accent/30 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Plan: Clean 4.8 GB</span>
                  <span className="text-[10px] font-mono bg-signal-gate-bg text-signal-gate px-1.5 py-0.5 rounded font-bold">
                    Tier 3 Gate
                  </span>
                </div>
                <div className="text-xs text-text-secondary flex flex-col gap-1 font-mono text-[11px]">
                  <div>1. scan_junk <span className="text-signal-success">✓ safe</span></div>
                  <div>2. clean_junk (caches) <span className="text-accent">reversible</span></div>
                  <div>3. purge_orphans (4 packages) <span className="text-signal-gate">destructive</span></div>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => triggerToast("Step Approved: Purging 4 packages")}
                    className="flex-1 py-1.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-lg shadow-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => triggerToast("Step Rejected")}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-border-subtle flex items-center gap-2 bg-black/40">
              <button
                onClick={() => triggerToast("Voice dictation active (Whisper base.en)")}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-primary transition-colors"
                title="Push to talk"
              >
                <Mic size={15} />
              </button>
              <input
                placeholder="Ask agent to clean or optimize..."
                className="flex-1 bg-transparent border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
              />
              <button
                onClick={() => triggerToast("Prompt sent to agent planner")}
                className="px-3 py-1.5 rounded-xl bg-accent text-accent-text text-xs font-bold"
              >
                Send
              </button>
            </div>
          </aside>
        )}
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
