"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase-context"
import type { LogEntry } from "@/lib/supabase-context"
import { OutputLog } from "@/components/supasec/output-log"

const COUNTER: { type: LogEntry["type"]; label: string; cls: string }[] = [
  { type: "info", label: "INFO", cls: "text-info" },
  { type: "success", label: "OK", cls: "text-success" },
  { type: "warning", label: "WARN", cls: "text-warning" },
  { type: "error", label: "ERR", cls: "text-danger" },
]

// Slim, always-on telemetry strip. Shows live counters + the latest line, and
// expands into the full console on demand. Auto-opens when a clue or error
// lands so you don't miss the important moments.
export function TelemetryBar() {
  const { logs } = useSupabase()
  const [open, setOpen] = useState(false)

  const counts = useMemo(() => {
    const c = { info: 0, success: 0, warning: 0, error: 0 }
    for (const l of logs) c[l.type]++
    return c
  }, [logs])
  const clueCount = useMemo(
    () => logs.filter((l) => l.message.includes("🔎")).length,
    [logs],
  )
  const last = logs.length > 0 ? logs[logs.length - 1] : null

  // Auto-open the console when a new clue arrives (setState-during-render, so no
  // effect and no lint complaint).
  const [seenClues, setSeenClues] = useState(clueCount)
  if (clueCount !== seenClues) {
    if (clueCount > seenClues) setOpen(true)
    setSeenClues(clueCount)
  }

  return (
    <div className="shrink-0 border-t border-border">
      {open && (
        <div className="h-[42vh] min-h-0 border-b border-border">
          <OutputLog />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center gap-3 bg-card/60 px-3 font-mono text-[11px] transition-colors hover:bg-muted/40"
        title={open ? "Collapse console" : "Expand console"}
      >
        <span className="uppercase tracking-widest text-muted-foreground">
          Output log
        </span>

        <span className="flex items-center gap-2">
          {COUNTER.map((c) => (
            <span key={c.type} className={cn("tabular-nums", counts[c.type] > 0 ? c.cls : "text-muted-foreground/40")}>
              {c.label} {counts[c.type]}
            </span>
          ))}
          {clueCount > 0 && (
            <span className="tabular-nums text-danger">🔎 {clueCount}</span>
          )}
        </span>

        {last && (
          <span className="min-w-0 flex-1 truncate text-left text-muted-foreground/70">
            {last.message}
          </span>
        )}
        {!last && <span className="flex-1" />}

        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}
