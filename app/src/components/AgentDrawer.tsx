import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  AlertTriangle,
  Bot,
  Cpu,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  RotateCw,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  agentAbort,
  agentApproveStep,
  agentGetActivePlan,
  agentGetConfig,
  agentRejectStep,
  agentSendPrompt,
  agentUpdateConfig,
  voiceStartCapture,
  voiceStopCapture,
} from "../lib/ipc";
import { AgentConfig, LlmProviderType, TaskPlan } from "../types";
import { PlanStepCard } from "./PlanStepCard";
import { VoiceWaveform } from "./VoiceWaveform";
import { LinearButton, LinearCard } from "./linear";

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
      agentGetConfig().then(setConfig).catch(() => {});
      agentGetActivePlan().then(setActivePlan).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 150);
    } else if (isListening) {
      voiceStopCapture().catch(() => {});
      setIsListening(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!inTauri) return;

    let unlisten: (() => void) | undefined;
    listen<{ type?: string; payload?: number[] }>("evt://voice/event", (event) => {
      if (event.payload?.type === "Waveform" && Array.isArray(event.payload.payload)) {
        setAudioLevels(event.payload.payload);
      } else if (event.payload?.type === "UtteranceReady") {
        voiceStopCapture()
          .then((text) => {
            if (text && text.trim()) {
              setPrompt(text);
              onTriggerToast(`Voice preview: "${text}"`);
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
        const text = await voiceStopCapture();
        if (text && text.trim()) {
          setPrompt(text);
          onTriggerToast(`Voice preview captured: "${text}"`);
        }
      } catch (err: unknown) {
        onTriggerToast(`Voice stop error: ${err}`);
      } finally {
        setIsListening(false);
      }
    } else {
      try {
        await voiceStartCapture();
        setIsListening(true);
        onTriggerToast("Voice preview active (Ctrl+Space to stop)");
      } catch (err: unknown) {
        onTriggerToast(`Voice capture error: ${err}`);
        setIsListening(false);
      }
    }
  };

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
      onTriggerToast("All approved steps executed");
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
    <aside
      aria-label="Starship Agent Drawer"
      className="w-96 shrink-0 border-l border-[var(--border)] bg-[var(--bg-surface)] flex flex-col select-none h-full z-40"
    >
      {/* Header */}
      <div className="h-11 shrink-0 border-b border-[var(--border)] px-4 flex items-center justify-between bg-[var(--bg-surface-2)]">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-green)]" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-[var(--text)]">
            Starship Agent
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="inline-flex items-center gap-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-0.5 rounded text-[var(--accent)] hover:border-[var(--border-strong)] transition-colors duration-150 cursor-pointer"
          >
            <span>
              {config.provider === "sovereign_offline"
                ? "Sovereign"
                : config.provider === "ollama"
                ? "Ollama"
                : config.provider}
            </span>
            <Settings className="size-3" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="size-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-bar-idle)] transition-colors duration-150 cursor-pointer"
          aria-label="Close drawer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Settings Dropdown */}
      {settingsOpen && (
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-surface-2)] space-y-3 text-xs">
          <div className="font-semibold text-[var(--text)] flex items-center justify-between">
            <span>LLM Provider Configuration</span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">Local Config</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[var(--text-muted)] block">Provider Engine:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveConfig("sovereign_offline", "offline-planner")}
                className={`p-2.5 rounded-md border text-left cursor-pointer transition-colors duration-150 ${
                  config.provider === "sovereign_offline"
                    ? "bg-[var(--tint-blue)] border-[var(--tint-blue-border)] text-[var(--color-blue)] font-medium"
                    : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <div className="font-semibold text-xs">Sovereign Rule-based</div>
                <div className="text-[11px] text-[var(--text-faint)]">Offline · Sub-second</div>
              </button>

              <button
                type="button"
                onClick={() => handleSaveConfig("ollama", "llama3.1:latest")}
                className={`p-2.5 rounded-md border text-left cursor-pointer transition-colors duration-150 ${
                  config.provider === "ollama"
                    ? "bg-[var(--tint-blue)] border-[var(--tint-blue-border)] text-[var(--color-blue)] font-medium"
                    : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <div className="font-semibold text-xs">Local Ollama</div>
                <div className="text-[11px] text-[var(--text-faint)]">localhost:11434</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activePlan && (
          <div className="space-y-4">
            <LinearCard level={1} className="p-4 space-y-2.5 bg-[var(--bg-surface-2)]">
              <div className="flex items-center gap-2 text-[var(--text)] font-semibold text-xs">
                <Bot className="size-4 text-[var(--accent)]" aria-hidden="true" />
                <span>Maintenance Companion</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Describe what you need in plain English. Intents decompose into structured Task
                Sheets with approval gates before touching your disk.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-green)]">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Protected paths &amp; browser passwords shielded</span>
              </div>
            </LinearCard>

            {/* Suggested Action Chips */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] px-1">
                Suggested Actions
              </div>
              <div className="space-y-1.5">
                {[
                  {
                    icon: <Trash2 className="size-3.5 text-[var(--color-blue)]" />,
                    text: "Free up 5 GB of disk space",
                  },
                  {
                    icon: <AlertTriangle className="size-3.5 text-[var(--color-amber)]" />,
                    text: "Audit and purge orphan packages",
                  },
                  {
                    icon: <Cpu className="size-3.5 text-[var(--color-sky)]" />,
                    text: "Check why my machine is running hot",
                  },
                  {
                    icon: <RefreshCw className="size-3.5 text-[var(--color-green)]" />,
                    text: "Restore files from last cleanup",
                  },
                ].map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    onClick={() => handleSend(item.text)}
                    className="w-full px-3 py-2.5 rounded-md bg-[var(--bg-surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-left text-xs flex items-center gap-2.5 transition-colors duration-150 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    {item.icon}
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePlan && (
          <div className="space-y-3.5">
            <LinearCard level={1} className="p-3.5 space-y-2 bg-[var(--bg-surface-2)]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--accent)] font-medium">
                  Task Sheet #{activePlan.plan_id}
                </span>
                {activePlan.total_disk_delta_bytes !== 0 && (
                  <span className="text-[var(--color-green)] font-medium tabular-nums">
                    Est. {formatBytes(activePlan.total_disk_delta_bytes)}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)] line-clamp-2 font-sans">
                "{activePlan.user_intent}"
              </div>
            </LinearCard>

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

            <div className="pt-2 flex items-center justify-between gap-2">
              <LinearButton variant="danger" size="sm" onClick={handleAbort}>
                Abort Plan
              </LinearButton>

              <LinearButton
                variant="primary"
                size="sm"
                onClick={handleExecuteAllApproved}
                disabled={executing}
              >
                {executing ? (
                  <RotateCw className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-3.5" aria-hidden="true" />
                )}
                <span>Execute Approved</span>
              </LinearButton>
            </div>
          </div>
        )}
      </div>

      {/* Input / Chat Bar */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface-2)] space-y-2">
        {isListening && (
          <div className="flex items-center justify-between gap-3 p-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text)]">
              <span className="size-2 rounded-full bg-[var(--color-red)]" aria-hidden="true" />
              <span>Preview</span>
            </div>
            <VoiceWaveform
              levels={audioLevels}
              isActive={isListening}
              className="flex-1 max-w-[180px]"
            />
            <LinearButton variant="secondary" size="sm" onClick={handleToggleVoice}>
              Done
            </LinearButton>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-1 focus-within:border-[var(--accent)] transition-colors duration-150"
        >
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={planning}
            className={`size-8 rounded-md flex items-center justify-center transition-colors duration-150 cursor-pointer border ${
              isListening
                ? "bg-[var(--tint-red)] border-[var(--tint-red-border)] text-[var(--color-red)]"
                : "bg-[var(--bg-surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
            title="Voice Dictation Preview (Ctrl + Space)"
            aria-label={isListening ? "Stop voice preview" : "Start voice dictation preview"}
          >
            {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </button>

          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={planning}
            placeholder={
              isListening
                ? "Voice preview active..."
                : planning
                ? "Generating Task Sheet..."
                : "Ask the agent"
            }
            aria-label="Prompt input"
            className="flex-1 bg-transparent border-0 outline-none px-2 text-xs text-[var(--text)] placeholder:text-[var(--text-faint)]"
          />

          <button
            type="submit"
            disabled={planning || !prompt.trim()}
            aria-label="Send prompt"
            className="size-8 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors duration-150 cursor-pointer"
          >
            {planning ? (
              <RotateCw className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </form>

        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-faint)] px-0.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span>Voice (Preview):</span>
            <kbd className="font-mono border border-[var(--border)] px-1 rounded bg-[var(--bg-surface)]">
              Ctrl+Space
            </kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Toggle:</span>
            <kbd className="font-mono border border-[var(--border)] px-1 rounded bg-[var(--bg-surface)]">
              Ctrl+Shift+A
            </kbd>
          </div>
        </div>
      </div>
    </aside>
  );
}
