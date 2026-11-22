import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  X,
  Send,
  Sparkles,
  Settings,
  AlertTriangle,
  Play,
  RotateCw,
  Trash2,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Mic,
  MicOff,
} from "lucide-react";
import {
  agentSendPrompt,
  agentGetActivePlan,
  agentApproveStep,
  agentRejectStep,
  agentAbort,
  agentGetConfig,
  agentUpdateConfig,
} from "../lib/ipc";
import { TaskPlan, AgentConfig, LlmProviderType } from "../types";
import { PlanStepCard } from "./PlanStepCard";
import { VoiceWaveform } from "./VoiceWaveform";

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function AgentDrawer({
  isOpen,
  onClose,
  onTriggerToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    provider: "sovereign_offline",
    endpoint: "http://localhost:11434",
    model: "llama3.1:latest",
    apiKey: null,
  });

  const [isListening, setIsListening] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(0.08));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      agentGetConfig().then(setConfig);
      agentGetActivePlan().then(setActivePlan);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else if (isListening) {
      invoke<string>("voice_stop_capture").catch(() => {});
      setIsListening(false);
    }
  }, [isOpen]);

  // Real-time voice stream listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<any>("evt://voice/event", (event) => {
      if (event.payload?.type === "Waveform") {
        setAudioLevels(event.payload.payload);
      } else if (event.payload?.type === "UtteranceReady") {
        invoke<string>("voice_stop_capture")
          .then((text) => {
            if (text && text.trim()) {
              setPrompt(text);
              onTriggerToast(`Voice recognized: "${text}"`);
            }
          })
          .catch(() => {})
          .finally(() => setIsListening(false));
      } else if (event.payload?.type === "Finished") {
        setIsListening(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [onTriggerToast]);

  const handleToggleVoice = async () => {
    if (isListening) {
      try {
        const text = await invoke<string>("voice_stop_capture");
        if (text && text.trim()) {
          setPrompt(text);
          onTriggerToast(`Voice captured: "${text}"`);
        }
      } catch (err: unknown) {
        onTriggerToast(`Voice stop error: ${err}`);
      } finally {
        setIsListening(false);
      }
    } else {
      try {
        await invoke("voice_start_capture");
        setIsListening(true);
        onTriggerToast("Listening for voice command... (Ctrl+Space to stop)");
      } catch (err: unknown) {
        onTriggerToast(`Voice capture error: ${err}`);
        setIsListening(false);
      }
    }
  };

  // Push-to-talk hotkey (Ctrl + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space" && isOpen) {
        e.preventDefault();
        handleToggleVoice();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isListening]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || prompt).trim();
    if (!query) return;

    setPlanning(true);
    setPrompt("");
    try {
      const plan = await agentSendPrompt(query);
      setActivePlan(plan);
      onTriggerToast(`Task Sheet #${plan.plan_id} generated.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Planning error: ${msg}`);
    } finally {
      setPlanning(false);
    }
  };

  const handleApprove = async (stepIndex: number) => {
    if (!activePlan) return;
    setExecuting(true);
    try {
      const signatureToken = `usr_sig_ag_step_${stepIndex}_${Math.floor(Date.now() / 1000)}`;
      await agentApproveStep(activePlan.plan_id, stepIndex, signatureToken);
      onTriggerToast(`Step #${stepIndex + 1} approved & executed.`);
      const updated = await agentGetActivePlan();
      setActivePlan(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Step execution failed: ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleReject = async (stepIndex: number) => {
    if (!activePlan) return;
    try {
      await agentRejectStep(activePlan.plan_id, stepIndex);
      onTriggerToast(`Step #${stepIndex + 1} rejected.`);
      const updated = await agentGetActivePlan();
      setActivePlan(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Step rejection failed: ${msg}`);
    }
  };

  const handleExecuteAllApproved = async () => {
    if (!activePlan) return;
    setExecuting(true);
    try {
      for (const step of activePlan.steps) {
        if (step.status === "pending" || step.status === "waiting_approval") {
          const sig = `usr_sig_ag_step_${step.step_index}_${Math.floor(Date.now() / 1000)}`;
          await agentApproveStep(activePlan.plan_id, step.step_index, sig);
        }
      }
      onTriggerToast("All approved steps executed successfully!");
      const updated = await agentGetActivePlan();
      setActivePlan(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Execution failed: ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleAbort = async () => {
    await agentAbort();
    setActivePlan(null);
    onTriggerToast("Agent plan aborted and locks dropped.");
  };

  const handleSaveConfig = async (newProvider: LlmProviderType, newModel: string) => {
    const updated: AgentConfig = {
      ...config,
      provider: newProvider,
      model: newModel,
    };
    setConfig(updated);
    await agentUpdateConfig(updated);
    setSettingsOpen(false);
    onTriggerToast(`Agent provider set to ${newProvider}.`);
  };

  if (!isOpen) return null;

  return (
    <aside className="w-96 border-l border-border-subtle bg-raised/95 flex flex-col select-none h-full z-40 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 border-b border-border-subtle px-4 flex items-center justify-between bg-raised/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
          <span className="text-xs font-bold text-text-primary tracking-wide">
            Starship Agent
          </span>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-1 text-[10px] font-mono bg-black/40 border border-border-subtle px-2 py-0.5 rounded-full text-accent hover:border-accent transition-colors cursor-pointer"
          >
            <span>
              {config.provider === "sovereign_offline"
                ? "Sovereign"
                : config.provider === "ollama"
                ? "Ollama"
                : config.provider}
            </span>
            <Settings size={10} />
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Settings Overlay Dropdown */}
      {settingsOpen && (
        <div className="p-4 border-b border-border-subtle bg-black/60 space-y-3 text-xs animate-in fade-in duration-150">
          <div className="font-bold text-text-primary flex items-center justify-between">
            <span>LLM Provider Configuration</span>
            <span className="text-[10px] text-text-disabled font-mono">Secret Service Integrated</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-text-secondary">Provider Engine:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSaveConfig("sovereign_offline", "offline-planner")}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  config.provider === "sovereign_offline"
                    ? "bg-accent/20 border-accent text-accent font-bold"
                    : "bg-surface-glass border-border-subtle text-text-secondary hover:text-text-primary"
                }`}
              >
                <div className="font-semibold text-[11px]">Sovereign Rule-based</div>
                <div className="text-[9px] text-text-disabled">Offline · Sub-second</div>
              </button>

              <button
                onClick={() => handleSaveConfig("ollama", "llama3.1:latest")}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  config.provider === "ollama"
                    ? "bg-accent/20 border-accent text-accent font-bold"
                    : "bg-surface-glass border-border-subtle text-text-secondary hover:text-text-primary"
                }`}
              >
                <div className="font-semibold text-[11px]">Local Ollama</div>
                <div className="text-[9px] text-text-disabled">localhost:11434</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* If no plan is active, display welcoming starter guide */}
        {!activePlan && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-surface-glass border border-border-subtle space-y-2">
              <div className="flex items-center gap-2 text-accent font-semibold text-xs">
                <Sparkles size={14} />
                <span>Autonomous Maintenance Companion</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Type what you need in plain English. I decompose your intent into structured Task Sheets with safety gates before touching your disk.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
                <ShieldCheck size={12} className="text-emerald-400" />
                <span>Protected paths &amp; browser passwords strictly shielded</span>
              </div>
            </div>

            {/* Quick Action Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-1">
                Suggested Actions
              </div>
              <div className="space-y-1.5">
                {[
                  {
                    icon: <Trash2 size={13} className="text-accent" />,
                    text: "Free up 5 GB of disk space",
                  },
                  {
                    icon: <AlertTriangle size={13} className="text-amber-400" />,
                    text: "Audit and purge orphan packages",
                  },
                  {
                    icon: <Cpu size={13} className="text-purple-400" />,
                    text: "Check why my machine is running hot",
                  },
                  {
                    icon: <RefreshCw size={13} className="text-emerald-400" />,
                    text: "Restore files from last cleanup",
                  },
                ].map((item) => (
                  <button
                    key={item.text}
                    onClick={() => handleSend(item.text)}
                    className="w-full p-2.5 rounded-xl bg-surface-glass border border-border-subtle hover:border-accent text-left text-xs flex items-center gap-2.5 transition-all cursor-pointer group"
                  >
                    {item.icon}
                    <span className="text-text-secondary group-hover:text-text-primary transition-colors">
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Task Sheet */}
        {activePlan && (
          <div className="space-y-3.5">
            {/* Task Sheet Header */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-border-subtle space-y-2 font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-accent font-bold uppercase">
                  Task Sheet #{activePlan.plan_id}
                </span>
                {activePlan.total_disk_delta_bytes !== 0 && (
                  <span className="text-emerald-400 font-bold">
                    Est. {formatBytes(activePlan.total_disk_delta_bytes)}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary line-clamp-2 italic font-sans">
                "{activePlan.user_intent}"
              </div>
            </div>

            {/* Steps List */}
            <div className="space-y-2.5">
              {activePlan.steps.map((step) => (
                <PlanStepCard
                  key={step.step_id}
                  step={step}
                  planId={activePlan.plan_id}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  executing={executing}
                />
              ))}
            </div>

            {/* Plan Execution Controls */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                onClick={handleAbort}
                className="px-3 py-2 rounded-xl bg-surface-glass border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-red-400 hover:border-red-900 transition-all cursor-pointer"
              >
                Abort Plan
              </button>

              <button
                onClick={handleExecuteAllApproved}
                disabled={executing}
                className="px-4 py-2 rounded-xl bg-accent text-accent-text text-xs font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:bg-accent-active transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {executing ? (
                  <RotateCw size={13} className="animate-spin" />
                ) : (
                  <Play size={13} />
                )}
                <span>Execute Approved</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input / Chat Bar */}
      <div className="p-3 border-t border-border-subtle bg-raised/80 space-y-2">
        {/* Live Audio Waveform when recording */}
        {isListening && (
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-purple-950/30 border border-purple-500/30 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-medium text-purple-300">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Listening...</span>
            </div>
            <VoiceWaveform levels={audioLevels} isActive={isListening} className="flex-1 max-w-[200px]" />
            <button
              type="button"
              onClick={handleToggleVoice}
              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 hover:bg-purple-500/40 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5 bg-black/40 border border-border-subtle rounded-2xl p-1.5 focus-within:border-accent transition-colors"
        >
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={planning}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? "bg-purple-600 text-white animate-pulse shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                : "bg-surface-glass border border-border-subtle text-text-secondary hover:text-accent hover:border-accent/40"
            }`}
            title="Push to Talk (Ctrl + Space)"
            aria-label={isListening ? "Stop listening" : "Start voice dictation"}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={planning}
            placeholder={
              isListening
                ? "Listening to speech..."
                : planning
                ? "Generating Task Sheet..."
                : "Ask agent or enter task..."
            }
            className="flex-1 bg-transparent border-0 outline-none px-2 text-xs text-text-primary placeholder:text-text-disabled"
          />

          <button
            type="submit"
            disabled={planning || !prompt.trim()}
            className="w-8 h-8 rounded-xl bg-accent text-accent-text flex items-center justify-center hover:bg-accent-active disabled:opacity-40 transition-all cursor-pointer shadow-sm"
          >
            {planning ? <RotateCw size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-text-disabled px-1">
          <div className="flex items-center gap-1.5">
            <span>Voice:</span>
            <kbd className="font-mono text-[9px] border border-border-subtle px-1 rounded">
              Ctrl + Space
            </kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Drawer:</span>
            <kbd className="font-mono text-[9px] border border-border-subtle px-1 rounded">
              Ctrl + Shift + A
            </kbd>
          </div>
        </div>
      </div>
    </aside>
  );
}
