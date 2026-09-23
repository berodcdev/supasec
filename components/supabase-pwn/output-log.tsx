"use client"

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase-context"
import type { LogEntry } from "@/lib/supabase-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { JsonViewer } from "@/components/supabase-pwn/shared/json-viewer"
import {
  StatusBadge,
  type Severity,
} from "@/components/supabase-pwn/shared/status-badge"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LogType = LogEntry["type"]

function formatTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  const ms = String(date.getMilliseconds()).padStart(3, "0")
  return `${h}:${m}:${s}.${ms}`
}

const TYPE_META: Record<
  LogType,
  { severity: Severity; label: string; rail: string; chip: string }
> = {
  info: {
    severity: "info",
    label: "INFO",
    rail: "border-l-info",
    chip: "border-info/40 bg-info/15 text-info",
  },
  success: {
    severity: "safe",
    label: "OK",
    rail: "border-l-success",
    chip: "border-success/40 bg-success/15 text-success",
  },
  warning: {
    severity: "warning",
    label: "WARN",
    rail: "border-l-warning",
    chip: "border-warning/40 bg-warning/15 text-warning",
  },
  error: {
    severity: "critical",
    label: "ERR",
    rail: "border-l-danger",
    chip: "border-danger/40 bg-danger/15 text-danger",
  },
}

const TYPE_ORDER: LogType[] = ["info", "success", "warning", "error"]

// ---------------------------------------------------------------------------
// Individual log row -- extracted so React.memo can skip re-renders
// ---------------------------------------------------------------------------

const LogRow = React.memo(function LogRow({ entry }: { entry: LogEntry }) {
  const meta = TYPE_META[entry.type]
  const [expanded, setExpanded] = useState(false)

  const jsonString = useMemo(() => {
    if (entry.data === undefined) return null
    try {
      return JSON.stringify(entry.data, null, 2)
    } catch {
      return String(entry.data)
    }
  }, [entry.data])

  return (
    <div
      className={cn(
        "group flex flex-col border-b border-l-2 border-border/40 px-3 py-1.5 font-mono text-sm hover:bg-muted/30",
        meta.rail,
      )}
    >
      <div className="flex items-start gap-2">
        {/* Timestamp */}
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Type badge */}
        <StatusBadge severity={meta.severity} dot={false} className="shrink-0">
          {meta.label}
        </StatusBadge>

        {/* Message */}
        <span className="min-w-0 break-words text-foreground">
          {entry.message}
        </span>

        {/* Data toggle */}
        {jsonString !== null && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="ml-auto shrink-0 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? "hide" : "data"}
          </button>
        )}
      </div>

      {/* Collapsible JSON block */}
      {expanded && jsonString !== null && (
        <div className="mt-1 ml-[7.5rem]">
          <JsonViewer json={jsonString} className="max-h-none" padding="p-2" copyable />
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// OutputLog component
// ---------------------------------------------------------------------------

export function OutputLog() {
  const { logs, clearLogs } = useSupabase()
  const [newestFirst, setNewestFirst] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [query, setQuery] = useState("")
  const [muted, setMuted] = useState<Set<LogType>>(() => new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Track whether the user has scrolled up (to pause auto-scroll)
  const [autoScroll, setAutoScroll] = useState(true)

  // Per-severity counts (over all logs, not just the filtered view)
  const counts = useMemo(() => {
    const c: Record<LogType, number> = {
      info: 0,
      success: 0,
      warning: 0,
      error: 0,
    }
    for (const l of logs) c[l.type]++
    return c
  }, [logs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter(
      (l) =>
        !muted.has(l.type) &&
        (q === "" || l.message.toLowerCase().includes(q)),
    )
  }, [logs, muted, query])

  const sortedLogs = useMemo(() => {
    if (!newestFirst) return filtered
    return [...filtered].reverse()
  }, [filtered, newestFirst])

  const toggleType = useCallback((t: LogType) => {
    setMuted((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }, [])

  // Auto-scroll to bottom on new entries (only when sorting oldest-first)
  useEffect(() => {
    if (!newestFirst && autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [sortedLogs.length, newestFirst, autoScroll])

  // Detect if user scrolls away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setAutoScroll(distanceFromBottom < 40)
  }, [])

  const body = (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Output Log
        </span>

        {/* Severity filter chips (double as counts) */}
        <div className="flex items-center gap-1">
          {TYPE_ORDER.map((t) => {
            const meta = TYPE_META[t]
            const active = !muted.has(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                title={active ? `Hide ${meta.label}` : `Show ${meta.label}`}
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide tabular-nums transition-opacity",
                  active
                    ? meta.chip
                    : "border-border text-muted-foreground opacity-40",
                )}
              >
                {meta.label} {counts[t]}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter…"
            className="h-6 w-32 rounded-sm border border-border bg-transparent pl-6 pr-6 font-mono text-xs outline-none focus-visible:border-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setNewestFirst((prev) => !prev)}
          title={newestFirst ? "Showing newest first" : "Showing oldest first"}
        >
          <ArrowUpDown className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setMaximized((prev) => !prev)}
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={clearLogs}
          title="Clear logs"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No log entries yet.
        </div>
      ) : sortedLogs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No entries match the filter.
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto"
          >
            {sortedLogs.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}
    </div>
  )

  if (maximized) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-background/70"
          onClick={() => setMaximized(false)}
        />
        <div className="fixed inset-4 z-50 overflow-hidden rounded-md border border-border shadow-2xl">
          {body}
        </div>
      </>
    )
  }

  return body
}
