"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Copy,
  Crown,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RotateCcw,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Swords,
  Terminal,
  Wrench,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { saveAIAnalysis, loadAIAnalysis, type ScanRecord } from "@/lib/scan-history"
import type { Finding } from "@/lib/findings"
import {
  AI_MODELS,
  buildAnalysisPayload,
  loadAIConfig,
  parseAIResponse,
  saveAIConfig,
  type AIAnalysis,
  type AIConfig,
  type AIModel,
  type AIVerdict,
  type ModelTier,
} from "@/lib/ai-analysis"
import { downloadFile } from "@/lib/scan-report"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  StatusBadge,
  type Severity,
} from "@/components/supabase-pwn/shared/status-badge"
import { ReticlePanel } from "@/components/supabase-pwn/shared/reticle-panel"
import { EmptyState } from "@/components/supabase-pwn/shared/empty-state"

// -- Verdict styling ------------------------------------------------------

const VERDICT_STYLE: Record<AIVerdict, { label: string; severity: Severity }> =
  {
    confirmed: { label: "Confirmed", severity: "critical" },
    likely: { label: "Likely", severity: "high" },
    false_positive: { label: "False Positive", severity: "safe" },
    needs_manual: { label: "Needs Review", severity: "warning" },
  }

const RISK_SEVERITY: Record<string, Severity> = {
  critical: "critical",
  high: "high",
  medium: "warning",
  low: "info",
}

// -- Copy helper ----------------------------------------------------------

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* clipboard unavailable */ }
  }, [])
  return { copiedId, copy }
}

// -- Streaming phases -----------------------------------------------------

type StreamPhase = "connecting" | "thinking" | "streaming" | "parsing" | "done" | "error"

const PHASE_LABELS: Record<StreamPhase, string> = {
  connecting: "Connecting to OpenRouter",
  thinking: "Model is thinking",
  streaming: "Receiving analysis",
  parsing: "Parsing results",
  done: "Analysis complete",
  error: "Analysis failed",
}

// -- Tier styling ---------------------------------------------------------

const TIER_META: Record<ModelTier, { label: string; color: string; icon: typeof Crown; badge: string }> = {
  premium: { label: "Premium", color: "text-amber-400", icon: Crown, badge: "bg-amber-400/10 text-amber-400 border-amber-400/25" },
  fast: { label: "Fast", color: "text-primary", icon: Zap, badge: "bg-primary/10 text-primary border-primary/25" },
  value: { label: "Value", color: "text-success", icon: CircleDot, badge: "bg-success/10 text-success border-success/25" },
}

// -- Model card -----------------------------------------------------------

function ModelCard({
  model,
  selected,
  onSelect,
}: {
  model: AIModel
  selected: boolean
  onSelect: () => void
}) {
  const tier = TIER_META[model.tier]
  const TierIcon = tier.icon

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-none border p-3 text-left transition-all duration-200",
        selected
          ? "border-primary bg-primary/5 shadow-[0_0_20px_-6px_var(--color-primary)]"
          : "border-border/60 bg-card/30 hover:border-primary/30 hover:bg-muted/20",
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <span className="absolute -right-px -top-px flex size-5 items-center justify-center rounded-bl-sm bg-primary">
          <Check className="size-2.5 text-primary-foreground" />
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-none border",
          selected ? "border-primary/40 bg-primary/10" : "border-border/60 bg-muted/30",
        )}>
          <TierIcon className={cn("size-3.5", tier.color)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-mono text-xs font-semibold",
              selected ? "text-foreground" : "text-foreground/80",
            )}>
              {model.label}
            </span>
            {model.recommended && (
              <span className="flex items-center gap-0.5 rounded-none border border-amber-400/30 bg-amber-400/10 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-widest text-amber-400">
                <Star className="size-2" />
                REC
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {model.provider}
            </span>
            <span className="text-muted-foreground/20">·</span>
            <span className={cn("rounded-none border px-1 py-px font-mono text-[8px] uppercase tracking-wider", tier.badge)}>
              {tier.label}
            </span>
            <span className="text-muted-foreground/20">·</span>
            <span className="font-mono text-[9px] text-muted-foreground/50">
              {model.context} ctx
            </span>
          </div>

          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
            {model.description}
          </p>
        </div>
      </div>
    </button>
  )
}

// -- Settings dialog ------------------------------------------------------

function AISettingsDialog({
  config,
  onSave,
}: {
  config: AIConfig | null
  onSave: (c: AIConfig) => void
}) {
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "")
  const [model, setModel] = useState(config?.model ?? AI_MODELS[0].id)
  const [open, setOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<"all" | ModelTier>("all")

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      setApiKey(config?.apiKey ?? "")
      setModel(config?.model ?? AI_MODELS[0].id)
      setTestResult(null)
      setTestError(null)
      setShowKey(false)
    }
    setOpen(v)
  }, [config])

  const handleTestConnection = useCallback(async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    setTestError(null)

    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model,
          system: "Respond with exactly: OK",
          user: "Test connection",
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setTestResult("ok")
    } catch (e) {
      setTestResult("error")
      setTestError(e instanceof Error ? e.message : "Connection failed")
    } finally {
      setTesting(false)
    }
  }, [apiKey, model])

  const filteredModels = useMemo(() => {
    if (tierFilter === "all") return AI_MODELS
    return AI_MODELS.filter((m) => m.tier === tierFilter)
  }, [tierFilter])

  const selectedModel = useMemo(
    () => AI_MODELS.find((m) => m.id === model),
    [model],
  )

  const maskedKey = useMemo(() => {
    if (!apiKey) return ""
    if (apiKey.length <= 12) return "•".repeat(apiKey.length)
    return apiKey.slice(0, 8) + "•".repeat(apiKey.length - 12) + apiKey.slice(-4)
  }, [apiKey])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-mono text-[10px] uppercase tracking-wider">
          {config?.apiKey ? (
            <>
              <CheckCircle2 className="size-3 text-success" />
              <span className="hidden sm:inline">
                {AI_MODELS.find((m) => m.id === config.model)?.label ?? "AI"}
              </span>
              <span className="sm:hidden">AI</span>
            </>
          ) : (
            <>
              <Settings className="size-3" />
              Configure AI
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-primary/25 p-0">
        <span className="datum-corner left-0 top-0 border-l border-t" />
        <span className="datum-corner right-0 top-0 border-r border-t" />
        <span className="datum-corner bottom-0 left-0 border-b border-l" />
        <span className="datum-corner bottom-0 right-0 border-b border-r" />

        {/* Header */}
        <div className="border-b border-border px-5 pb-4 pt-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
            AI·CFG
          </div>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
            <Bot className="size-4 text-primary" />
            OpenRouter Configuration
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Connect your OpenRouter key to unlock AI-powered security analysis
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {/* API Key section */}
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-none border border-primary/25 bg-primary/5">
                <Key className="size-3.5 text-primary" />
              </div>
              <div>
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-foreground">
                  API Key
                </h3>
                <p className="font-mono text-[9px] text-muted-foreground/60">
                  Stored in your browser only — never sent to our servers
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ai-api-key"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null) }}
                    className="pr-9 font-mono text-xs"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={!apiKey.trim() || testing}
                  className="h-9 gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider"
                >
                  {testing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : testResult === "ok" ? (
                    <CheckCircle2 className="size-3 text-success" />
                  ) : testResult === "error" ? (
                    <X className="size-3 text-danger" />
                  ) : (
                    <Zap className="size-3" />
                  )}
                  {testing ? "Testing…" : testResult === "ok" ? "Connected" : "Test"}
                </Button>
              </div>

              {/* Test result feedback */}
              {testResult === "ok" && (
                <div className="flex items-center gap-2 rounded-none border border-success/30 bg-success/5 px-3 py-2">
                  <CheckCircle2 className="size-3.5 text-success" />
                  <span className="font-mono text-[10px] text-success">
                    Connection successful — key is valid
                  </span>
                </div>
              )}
              {testResult === "error" && testError && (
                <div className="flex items-center gap-2 rounded-none border border-danger/30 bg-danger/5 px-3 py-2">
                  <ShieldAlert className="size-3.5 text-danger" />
                  <span className="font-mono text-[10px] text-danger">
                    {testError}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px]">
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
                >
                  <ExternalLink className="size-2.5" />
                  Get a key at openrouter.ai
                </a>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-muted-foreground/50">
                  Free tier available — pay only for what you use
                </span>
              </div>
            </div>
          </div>

          {/* Model selection */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-none border border-primary/25 bg-primary/5">
                  <Sparkles className="size-3.5 text-primary" />
                </div>
                <div>
                  <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-foreground">
                    Model
                  </h3>
                  <p className="font-mono text-[9px] text-muted-foreground/60">
                    Choose based on your speed and depth needs
                  </p>
                </div>
              </div>

              {selectedModel && (
                <div className="flex items-center gap-1.5 rounded-none border border-primary/20 bg-primary/5 px-2 py-1">
                  <CheckCircle2 className="size-2.5 text-primary" />
                  <span className="font-mono text-[9px] text-primary">{selectedModel.label}</span>
                </div>
              )}
            </div>

            {/* Tier filter */}
            <div className="mt-3 flex gap-1.5">
              {(["all", "premium", "fast", "value"] as const).map((tier) => {
                const active = tierFilter === tier
                const meta = tier === "all" ? null : TIER_META[tier]
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setTierFilter(tier)}
                    className={cn(
                      "flex items-center gap-1 rounded-none border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-all",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground/60 hover:border-border hover:text-muted-foreground",
                    )}
                  >
                    {meta && <meta.icon className={cn("size-2.5", active ? meta.color : "")} />}
                    {tier === "all" ? "All" : meta?.label}
                    <span className="text-[8px] text-muted-foreground/40">
                      {tier === "all" ? AI_MODELS.length : AI_MODELS.filter((m) => m.tier === tier).length}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Model grid */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {filteredModels.map((m) => (
                <ModelCard
                  key={m.id}
                  model={m}
                  selected={model === m.id}
                  onSelect={() => setModel(m.id)}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/40 pt-3">
              {(["premium", "fast", "value"] as const).map((tier) => {
                const meta = TIER_META[tier]
                const TIcon = meta.icon
                return (
                  <div key={tier} className="flex items-center gap-1.5">
                    <TIcon className={cn("size-2.5", meta.color)} />
                    <span className="font-mono text-[9px] text-muted-foreground/50">
                      {tier === "premium" && "Deep analysis, higher cost"}
                      {tier === "fast" && "Quick results, balanced cost"}
                      {tier === "value" && "Budget-friendly, good enough"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer — save */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          {config?.apiKey && (
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground/50">
              <Key className="size-2.5" />
              {maskedKey}
            </span>
          )}
          {!config?.apiKey && <span />}

          <Button
            className="gap-1.5 rounded-none bg-primary font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground shadow-[0_0_16px_-4px_var(--color-primary)] hover:bg-primary/90"
            disabled={!apiKey.trim() || !model}
            onClick={() => {
              const c = { apiKey: apiKey.trim(), model }
              saveAIConfig(c)
              onSave(c)
              setOpen(false)
              toast.success(`AI configured — ${AI_MODELS.find((m) => m.id === model)?.label ?? model}`)
            }}
          >
            <Check className="size-3" />
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// -- Streaming SSE parser -------------------------------------------------

async function streamAnalysis(
  config: AIConfig,
  record: ScanRecord,
  findings: Finding[],
  onChunk: (text: string) => void,
  onPhase: (phase: StreamPhase) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { system, user } = buildAnalysisPayload(record, findings)

  onPhase("connecting")

  const res = await fetch("/api/ai-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: config.apiKey,
      model: config.model,
      system,
      user,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(
      (err as { error?: string }).error ?? `HTTP ${res.status}`,
    )
  }

  if (!res.body) throw new Error("No response stream")

  onPhase("thinking")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ""
  let buffer = ""
  let firstChunk = true

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[]
        }
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          if (firstChunk) {
            onPhase("streaming")
            firstChunk = false
          }
          full += content
          onChunk(full)
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }

  onPhase("parsing")
  return full
}

// -- Phase indicator bar --------------------------------------------------

function PhaseBar({ phase, elapsed }: { phase: StreamPhase; elapsed: number }) {
  const phases: StreamPhase[] = ["connecting", "thinking", "streaming", "parsing"]
  const currentIdx = phases.indexOf(phase)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {phases.map((p, i) => {
          const isDone = i < currentIdx || phase === "done"
          const isActive = i === currentIdx && phase !== "done" && phase !== "error"
          return (
            <div key={p} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full font-mono text-[9px] font-bold transition-all duration-300",
                  isDone && "bg-primary/20 text-primary",
                  isActive && "bg-primary text-primary-foreground shadow-[0_0_12px_-3px_var(--color-primary)]",
                  !isDone && !isActive && "bg-muted text-muted-foreground/40",
                )}
              >
                {isDone ? <Check className="size-2.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden font-mono text-[9px] uppercase tracking-widest sm:inline",
                  isActive ? "text-primary" : isDone ? "text-muted-foreground" : "text-muted-foreground/40",
                )}
              >
                {PHASE_LABELS[p].split(" ").slice(-1)[0]}
              </span>
              {i < phases.length - 1 && (
                <span className={cn(
                  "mx-1 h-px w-4",
                  isDone ? "bg-primary/40" : "bg-border",
                )} />
              )}
            </div>
          )
        })}
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/60">
          {elapsed}s
        </span>
      </div>

      <div className="relative h-1 overflow-hidden rounded-full bg-muted">
        {(phase === "streaming" || phase === "thinking") && (
          <div className="absolute inset-0 animate-scan-sweep bg-primary/30" />
        )}
        {phase === "parsing" && (
          <div className="h-full w-full bg-primary/50 transition-all" />
        )}
        {phase === "done" && (
          <div className="h-full w-full bg-primary transition-all" />
        )}
      </div>
    </div>
  )
}

// -- Export AI report as markdown -----------------------------------------

function formatAIReport(analysis: AIAnalysis, findings: Finding[]): string {
  const lines: string[] = []
  lines.push("# AI Security Analysis Report")
  lines.push("")
  lines.push(`**Overall Risk:** ${analysis.overall_risk.toUpperCase()}`)
  lines.push("")
  lines.push("## Executive Summary")
  lines.push("")
  lines.push(analysis.summary)
  lines.push("")

  if (analysis.findings.length > 0) {
    lines.push("## Finding Verdicts")
    lines.push("")
    lines.push("| Finding | Verdict | Exploitability |")
    lines.push("| --- | --- | --- |")
    for (const af of analysis.findings) {
      const original = findings.find((f) => f.id === af.id)
      const title = original?.title ?? af.id
      lines.push(`| ${title} | **${af.verdict.toUpperCase()}** | ${af.exploitability} |`)
    }
    lines.push("")

    for (const af of analysis.findings) {
      if (af.verdict === "false_positive") continue
      const original = findings.find((f) => f.id === af.id)
      lines.push(`### ${original?.title ?? af.id}`)
      lines.push("")
      lines.push(`**Verdict:** ${af.verdict.toUpperCase()}`)
      lines.push("")
      lines.push(`**Reasoning:** ${af.reasoning}`)
      lines.push("")
      lines.push(`**Exploitability:** ${af.exploitability}`)
      if (af.poc) {
        lines.push("")
        lines.push("**Proof of Concept:**")
        lines.push("```bash")
        lines.push(af.poc)
        lines.push("```")
      }
      lines.push("")
    }
  }

  if (analysis.chains.length > 0) {
    lines.push("## Attack Chains")
    lines.push("")
    for (const chain of analysis.chains) {
      lines.push(`### ${chain.title} (${chain.severity.toUpperCase()})`)
      lines.push("")
      for (let j = 0; j < chain.steps.length; j++) {
        lines.push(`${j + 1}. ${chain.steps[j]}`)
      }
      lines.push("")
      lines.push(`**Impact:** ${chain.impact}`)
      lines.push("")
    }
  }

  if (analysis.prioritized_remediations.length > 0) {
    lines.push("## Prioritized Remediations")
    lines.push("")
    for (const r of analysis.prioritized_remediations) {
      lines.push(`- ${r}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// -- Main component -------------------------------------------------------

export function AIAnalysisPanel({
  scanRecord,
  findings,
}: {
  scanRecord: ScanRecord | null
  findings: Finding[]
}) {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [phase, setPhase] = useState<StreamPhase>("connecting")
  const [elapsed, setElapsed] = useState(0)
  const [rawStream, setRawStream] = useState("")
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { copiedId, copy } = useCopy()

  useEffect(() => {
    setConfig(loadAIConfig())
  }, [])

  // Load persisted AI analysis when viewing a scan
  useEffect(() => {
    if (!scanRecord?.projectUrl) return
    const saved = loadAIAnalysis(scanRecord.projectUrl, scanRecord.timestamp)
    if (saved && typeof saved === "object" && "summary" in (saved as Record<string, unknown>)) {
      setAnalysis(saved as AIAnalysis)
      setPhase("done")
    } else {
      setAnalysis(null)
      setPhase("connecting")
    }
  }, [scanRecord?.projectUrl, scanRecord?.timestamp])

  useEffect(() => {
    if (analyzing) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [analyzing])

  const canAnalyze = !!config?.apiKey && !!scanRecord && findings.length > 0

  const handleAnalyze = useCallback(async () => {
    if (!config || !scanRecord) return

    setAnalyzing(true)
    setError(null)
    setAnalysis(null)
    setRawStream("")
    setShowRaw(false)
    setPhase("connecting")

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const full = await streamAnalysis(
        config,
        scanRecord,
        findings,
        (text) => setRawStream(text),
        (p) => setPhase(p),
        controller.signal,
      )

      const parsed = parseAIResponse(full)
      setAnalysis(parsed)
      setPhase("done")
      saveAIAnalysis(scanRecord.projectUrl, parsed, scanRecord.timestamp)
      toast.success("AI analysis complete — saved")
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        toast.info("AI analysis cancelled")
        setPhase("error")
      } else {
        const msg = e instanceof Error ? e.message : "Analysis failed"
        setError(msg)
        setPhase("error")
        toast.error(msg)
      }
    } finally {
      setAnalyzing(false)
      abortRef.current = null
    }
  }, [config, scanRecord, findings])

  const handleAbort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleExport = useCallback(() => {
    if (!analysis) return
    const md = formatAIReport(analysis, findings)
    const ts = new Date().toISOString().replace(/[:.]/g, "-")
    downloadFile(`ai-analysis-${ts}.md`, md, "text/markdown")
  }, [analysis, findings])

  const verdictCounts = useMemo(() => {
    if (!analysis) return null
    const c = { confirmed: 0, likely: 0, false_positive: 0, needs_manual: 0 }
    for (const f of analysis.findings) {
      if (f.verdict in c) c[f.verdict as keyof typeof c]++
    }
    return c
  }, [analysis])

  const modelLabel = useMemo(() => {
    if (!config) return null
    const m = AI_MODELS.find((m) => m.id === config.model)
    return m?.label ?? config.model.split("/").pop()
  }, [config])

  const hasResults = analysis && !analyzing

  return (
    <ReticlePanel active={analyzing} label="AI·AUDIT">
      <Card className="relative rounded-none border-primary/25 bg-card/50">
        <span className="datum-corner boot-in left-0 top-0 border-l border-t" style={{ animationDelay: "0.1s" }} />
        <span className="datum-corner boot-in right-0 top-0 border-r border-t" style={{ animationDelay: "0.15s" }} />
        <span className="datum-corner boot-in bottom-0 left-0 border-b border-l" style={{ animationDelay: "0.2s" }} />
        <span className="datum-corner boot-in bottom-0 right-0 border-b border-r" style={{ animationDelay: "0.25s" }} />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
                AI·AUDIT
              </div>
              <div className="font-mono text-sm font-semibold uppercase tracking-wide">
                AI-Powered Analysis
              </div>
            </div>
            {modelLabel && config?.apiKey && (
              <Badge
                variant="outline"
                className="ml-2 font-mono text-[9px] font-normal uppercase tracking-wider"
              >
                {modelLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasResults && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5 font-mono text-[10px] uppercase tracking-wider"
                >
                  <Download className="size-3" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                  className="gap-1.5 font-mono text-[10px] uppercase tracking-wider"
                >
                  <RotateCcw className="size-3" />
                  Re-run
                </Button>
              </>
            )}
            <AISettingsDialog config={config} onSave={setConfig} />
            {analyzing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAbort}
                className="gap-1.5 border-danger/40 font-mono text-[10px] uppercase tracking-wider text-danger hover:bg-danger/10"
              >
                <X className="size-3" />
                Abort
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="gap-1.5 rounded-none bg-primary font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground shadow-[0_0_16px_-4px_var(--color-primary)] hover:bg-primary/90"
              >
                <Sparkles className="size-3" />
                {analysis ? "Re-analyze" : "Analyze with AI"}
              </Button>
            )}
          </div>
        </div>

        <CardContent className="space-y-0 p-0">
          {/* ----------------------------------------------------------------- */}
          {/* Empty / unconfigured state                                        */}
          {/* ----------------------------------------------------------------- */}
          {!config?.apiKey && !analyzing && !analysis && (
            <EmptyState
              icon={Bot}
              title="AI Analysis not configured"
              description="Connect your OpenRouter API key to unlock AI-powered validation of scan findings — confirms exploitability, identifies attack chains, and generates proof-of-concept commands."
            />
          )}

          {config?.apiKey && !analyzing && !analysis && !error && (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border border-primary/25 bg-primary/5">
                <Sparkles className="size-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ready to analyze <strong className="text-foreground">{findings.length}</strong> finding(s) with <strong className="text-foreground">{modelLabel}</strong>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                The AI will validate each finding, identify attack chains, and generate PoCs
              </p>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Streaming state                                                   */}
          {/* ----------------------------------------------------------------- */}
          {analyzing && (
            <div className="space-y-3 p-4">
              <PhaseBar phase={phase} elapsed={elapsed} />

              <div className="flex items-center gap-2 font-mono text-[11px] text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                {PHASE_LABELS[phase]}
                {phase === "streaming" && (
                  <span className="text-muted-foreground/60">
                    — {rawStream.length.toLocaleString()} chars
                  </span>
                )}
              </div>

              {rawStream && (
                <div className="relative">
                  <pre className="max-h-36 overflow-auto rounded-none border border-border bg-background/50 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
                    {rawStream.slice(-1500)}
                    <span className="inline-block h-3 w-0.5 animate-pulse bg-primary" />
                  </pre>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background/50 to-transparent" />
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Error state                                                       */}
          {/* ----------------------------------------------------------------- */}
          {error && !analyzing && (
            <div className="m-4 flex items-start gap-3 rounded-none border border-danger/30 bg-danger/5 p-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wide text-danger">
                  Analysis Failed
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Results                                                           */}
          {/* ----------------------------------------------------------------- */}
          {hasResults && (
            <div className="divide-y divide-border">
              {/* Overall risk card */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-none border",
                    analysis.overall_risk === "critical" && "border-danger/40 bg-danger/10",
                    analysis.overall_risk === "high" && "border-danger/30 bg-danger/5",
                    analysis.overall_risk === "medium" && "border-warning/40 bg-warning/10",
                    analysis.overall_risk === "low" && "border-success/40 bg-success/10",
                  )}>
                    <ShieldAlert className={cn(
                      "size-5",
                      analysis.overall_risk === "critical" && "text-danger",
                      analysis.overall_risk === "high" && "text-danger",
                      analysis.overall_risk === "medium" && "text-warning",
                      analysis.overall_risk === "low" && "text-success",
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        severity={RISK_SEVERITY[analysis.overall_risk] ?? "neutral"}
                        dot={false}
                        className="text-[10px]"
                      >
                        {analysis.overall_risk.toUpperCase()} RISK
                      </StatusBadge>
                      {verdictCounts && (
                        <span className="flex gap-1.5">
                          {verdictCounts.confirmed > 0 && (
                            <StatusBadge severity="critical" dot={false} className="text-[9px]">
                              {verdictCounts.confirmed} confirmed
                            </StatusBadge>
                          )}
                          {verdictCounts.likely > 0 && (
                            <StatusBadge severity="high" dot={false} className="text-[9px]">
                              {verdictCounts.likely} likely
                            </StatusBadge>
                          )}
                          {verdictCounts.false_positive > 0 && (
                            <StatusBadge severity="safe" dot={false} className="text-[9px]">
                              {verdictCounts.false_positive} false pos
                            </StatusBadge>
                          )}
                          {verdictCounts.needs_manual > 0 && (
                            <StatusBadge severity="warning" dot={false} className="text-[9px]">
                              {verdictCounts.needs_manual} manual
                            </StatusBadge>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {analysis.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Finding verdicts */}
              {analysis.findings.length > 0 && (
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Shield className="size-3.5 text-primary" />
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                      Finding Verdicts
                    </h4>
                    <span className="font-mono text-[10px] text-muted-foreground/50">
                      {analysis.findings.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {analysis.findings.map((af) => {
                      const style = VERDICT_STYLE[af.verdict] ?? VERDICT_STYLE.needs_manual
                      const original = findings.find((f) => f.id === af.id)
                      const hasPoc = !!af.poc
                      return (
                        <Collapsible key={af.id}>
                          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-none border border-border bg-card/30 px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/20">
                            <StatusBadge
                              severity={style.severity}
                              dot={false}
                              className="shrink-0 text-[9px]"
                            >
                              {style.label}
                            </StatusBadge>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">
                              {original?.title ?? af.id}
                            </span>
                            {hasPoc && (
                              <Badge variant="outline" className="shrink-0 font-mono text-[8px] uppercase tracking-wider">
                                PoC
                              </Badge>
                            )}
                            <ChevronRight className="size-3 shrink-0 text-muted-foreground/40 transition-transform group-data-[state=open]:rotate-90" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-3 border-x border-b border-border bg-background/30 px-3 py-3">
                              {/* Reasoning */}
                              <div className="flex gap-2">
                                <span className="mt-px shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
                                  Why
                                </span>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {af.reasoning}
                                </p>
                              </div>

                              {/* Exploitability */}
                              <div className="flex gap-2">
                                <span className="mt-px shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
                                  Risk
                                </span>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {af.exploitability}
                                </p>
                              </div>

                              {/* PoC */}
                              {af.poc && (
                                <div>
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
                                      Proof of Concept
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copy(af.poc!, af.id)
                                      }}
                                      className="h-5 gap-1 px-1.5 font-mono text-[9px] uppercase tracking-wider"
                                    >
                                      {copiedId === af.id ? (
                                        <Check className="size-2.5 text-success" />
                                      ) : (
                                        <Copy className="size-2.5" />
                                      )}
                                      {copiedId === af.id ? "Copied" : "Copy"}
                                    </Button>
                                  </div>
                                  <pre className="overflow-auto rounded-none border border-primary/15 bg-background p-2.5 font-mono text-[10px] leading-relaxed text-primary/80">
                                    {af.poc}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Attack chains */}
              {analysis.chains.length > 0 && (
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Swords className="size-3.5 text-danger" />
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-danger">
                      Attack Chains
                    </h4>
                    <span className="font-mono text-[10px] text-muted-foreground/50">
                      {analysis.chains.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {analysis.chains.map((chain, i) => (
                      <div
                        key={i}
                        className="rounded-none border border-border bg-card/30"
                      >
                        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                          <StatusBadge
                            severity={RISK_SEVERITY[chain.severity] ?? "warning"}
                            dot={false}
                            className="text-[9px]"
                          >
                            {chain.severity}
                          </StatusBadge>
                          <span className="text-xs font-semibold">{chain.title}</span>
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="space-y-1.5">
                            {chain.steps.map((step, j) => (
                              <div key={j} className="flex items-start gap-2">
                                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[8px] font-bold text-muted-foreground">
                                  {j + 1}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {j < chain.steps.length - 1 && (
                                    <span className="text-muted-foreground/40">→</span>
                                  )}
                                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                                    {step}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2.5 flex items-start gap-1.5 border-t border-border pt-2">
                            <Zap className="mt-0.5 size-3 shrink-0 text-warning" />
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                              <span className="font-semibold text-foreground/80">Impact: </span>
                              {chain.impact}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prioritized remediations */}
              {analysis.prioritized_remediations.length > 0 && (
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="size-3.5 text-success" />
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-success">
                      Prioritized Fix Order
                    </h4>
                  </div>
                  <div className="space-y-1">
                    {analysis.prioritized_remediations.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-none border border-border bg-card/30 px-3 py-2.5"
                      >
                        <span className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-none font-mono text-[10px] font-bold",
                          i === 0 && "bg-danger/15 text-danger",
                          i === 1 && "bg-warning/15 text-warning",
                          i >= 2 && "bg-muted text-muted-foreground",
                        )}>
                          {i + 1}
                        </span>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {r}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw toggle */}
              <div className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                >
                  <Terminal className="size-2.5" />
                  {showRaw ? "Hide" : "Show"} raw model output
                  <ChevronRight className={cn("size-2.5 transition-transform", showRaw && "rotate-90")} />
                </button>
                {showRaw && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-none border border-border bg-background/50 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground/60">
                    {rawStream}
                  </pre>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ReticlePanel>
  )
}

// -- Ask AI per-finding button --------------------------------------------

export function AskAIFindingButton({
  finding,
  scanRecord,
}: {
  finding: Finding
  scanRecord: ScanRecord | null
}) {
  const [config] = useState<AIConfig | null>(() => loadAIConfig())
  const [open, setOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<import("@/lib/ai-analysis").AIDeepDive | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawStream, setRawStream] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const { copiedId, copy } = useCopy()

  const modelLabel = useMemo(() => {
    if (!config) return null
    const m = AI_MODELS.find((m) => m.id === config.model)
    return m?.label ?? config.model.split("/").pop()
  }, [config])

  const handleAnalyze = useCallback(async () => {
    if (!config || !scanRecord) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setRawStream("")

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { buildDeepDivePayload, parseDeepDiveResponse } = await import("@/lib/ai-analysis")
      const { system, user } = buildDeepDivePayload(finding, scanRecord)

      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: config.apiKey, model: config.model, system, user }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error("No response stream")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              full += content
              setRawStream(full)
            }
          } catch { /* skip */ }
        }
      }

      const parsed = parseDeepDiveResponse(full)
      setResult(parsed)
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Analysis failed")
      }
    } finally {
      setAnalyzing(false)
      abortRef.current = null
    }
  }, [config, scanRecord, finding])

  if (!config?.apiKey) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
          if (!result && !analyzing) handleAnalyze()
        }}
        className="h-5 gap-1 px-1.5 font-mono text-[9px] uppercase tracking-wider text-primary/70 hover:text-primary"
        title="Deep-dive AI analysis"
      >
        <Sparkles className="size-2.5" />
        Ask AI
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) abortRef.current?.abort() }}>
        <DialogContent className="max-w-2xl border-primary/25">
          <span className="datum-corner left-0 top-0 border-l border-t" />
          <span className="datum-corner right-0 top-0 border-r border-t" />
          <span className="datum-corner bottom-0 left-0 border-b border-l" />
          <span className="datum-corner bottom-0 right-0 border-b border-r" />
          <DialogHeader>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
              AI·DEEP·DIVE
            </div>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-primary" />
              {finding.title}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-auto space-y-4">
            {analyzing && (
              <div className="space-y-3 py-4">
                <div className="flex items-center gap-2 font-mono text-[11px] text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  Analyzing with {modelLabel}…
                </div>
                {rawStream && (
                  <pre className="max-h-32 overflow-auto rounded-none border border-border bg-background/50 p-2 font-mono text-[10px] text-muted-foreground/60">
                    {rawStream.slice(-1000)}
                    <span className="inline-block h-3 w-0.5 animate-pulse bg-primary" />
                  </pre>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-none border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
                {error}
              </div>
            )}

            {result && !analyzing && (
              <div className="space-y-4">
                {/* Verdict */}
                <div className="flex items-center gap-2">
                  <StatusBadge
                    severity={VERDICT_STYLE[result.verdict]?.severity ?? "warning"}
                    dot={false}
                  >
                    {VERDICT_STYLE[result.verdict]?.label ?? result.verdict}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">{result.exploitability}</span>
                </div>

                {/* Reasoning */}
                <div>
                  <h4 className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                    Detailed Reasoning
                  </h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {result.detailed_reasoning}
                  </p>
                </div>

                {/* Attack scenarios */}
                {result.attack_scenarios.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-danger/80">
                      Attack Scenarios
                    </h4>
                    <div className="space-y-1">
                      {result.attack_scenarios.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-danger/10 font-mono text-[8px] font-bold text-danger">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PoC */}
                {result.poc && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
                        Proof of Concept
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(result.poc, "deepdive-poc")}
                        className="h-5 gap-1 px-1.5 font-mono text-[9px] uppercase tracking-wider"
                      >
                        {copiedId === "deepdive-poc" ? (
                          <Check className="size-2.5 text-success" />
                        ) : (
                          <Copy className="size-2.5" />
                        )}
                        {copiedId === "deepdive-poc" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="overflow-auto rounded-none border border-primary/15 bg-background p-2.5 font-mono text-[10px] leading-relaxed text-primary/80">
                      {result.poc}
                    </pre>
                  </div>
                )}

                {/* Remediation */}
                {result.remediation_steps.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-success/80">
                      Remediation Steps
                    </h4>
                    <div className="space-y-1">
                      {result.remediation_steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-none border border-border bg-card/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-none bg-success/10 font-mono text-[8px] font-bold text-success">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
