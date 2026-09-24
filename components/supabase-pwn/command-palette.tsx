"use client"

import { useEffect, useState, useCallback } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk"
import {
  Crosshair,
  Database,
  HardDrive,
  KeyRound,
  Radio,
  ShieldAlert,
  Waypoints,
  Zap,
  LogOut,
  Trash2,
  FileDown,
  Play,
  type LucideIcon,
} from "lucide-react"
import { useSupabase } from "@/lib/supabase-context"
import { formatMarkdownReport, formatHtmlReport, downloadFile, reportFilenameBase } from "@/lib/scan-report"
import { loadLastScan, loadAIAnalysis } from "@/lib/scan-history"
import type { AIAnalysis } from "@/lib/ai-analysis"

type NavItem = { id: string; label: string; icon: LucideIcon; keywords?: string[] }

const NAV_ITEMS: NavItem[] = [
  { id: "recon", label: "Recon", icon: Crosshair, keywords: ["dashboard", "overview"] },
  { id: "database", label: "Database", icon: Database, keywords: ["tables", "rls", "sql"] },
  { id: "storage", label: "Storage", icon: HardDrive, keywords: ["buckets", "files"] },
  { id: "functions", label: "Edge Functions", icon: Zap, keywords: ["edge", "serverless"] },
  { id: "realtime", label: "Realtime", icon: Radio, keywords: ["subscribe", "channels"] },
  { id: "auth", label: "Auth", icon: KeyRound, keywords: ["login", "signup", "session"] },
  { id: "graphql", label: "GraphQL", icon: Waypoints, keywords: ["graphql", "introspection", "mutations"] },
  { id: "autopwn", label: "AutoPwn", icon: ShieldAlert, keywords: ["scan", "pentest", "audit"] },
]

type ActionItem = {
  id: string
  label: string
  icon: LucideIcon
  keywords?: string[]
  onSelect: () => void
  danger?: boolean
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const {
    initialized,
    projectUrl,
    setActiveTab,
    triggerScan,
    disconnect,
    clearLogs,
  } = useSupabase()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const handleNav = useCallback(
    (id: string) => {
      setActiveTab(id)
      setOpen(false)
    },
    [setActiveTab],
  )

  const handleExportMd = useCallback(() => {
    if (!projectUrl) return
    const last = loadLastScan(projectUrl)
    if (!last) return
    const ai = loadAIAnalysis(projectUrl, last.timestamp) as AIAnalysis | null
    const md = formatMarkdownReport(last, ai)
    const base = reportFilenameBase(last)
    downloadFile(`${base}.md`, md, "text/markdown")
    setOpen(false)
  }, [projectUrl])

  const handleExportHtml = useCallback(() => {
    if (!projectUrl) return
    const last = loadLastScan(projectUrl)
    if (!last) return
    const ai = loadAIAnalysis(projectUrl, last.timestamp) as AIAnalysis | null
    const html = formatHtmlReport(last, ai)
    const base = reportFilenameBase(last)
    downloadFile(`${base}.html`, html, "text/html")
    setOpen(false)
  }, [projectUrl])

  const actions: ActionItem[] = [
    {
      id: "run-scan",
      label: "Run AutoPwn Scan",
      icon: Play,
      keywords: ["start", "execute", "pentest"],
      onSelect: () => {
        triggerScan()
        setOpen(false)
      },
    },
    {
      id: "export-md",
      label: "Export Markdown Report",
      icon: FileDown,
      keywords: ["download", "save", "report", "markdown"],
      onSelect: handleExportMd,
    },
    {
      id: "export-html",
      label: "Export HTML Report",
      icon: FileDown,
      keywords: ["download", "save", "report", "html", "pdf"],
      onSelect: handleExportHtml,
    },
    {
      id: "clear-logs",
      label: "Clear Logs",
      icon: Trash2,
      keywords: ["reset", "clean"],
      onSelect: () => {
        clearLogs()
        setOpen(false)
      },
    },
    {
      id: "disconnect",
      label: "Disconnect",
      icon: LogOut,
      keywords: ["logout", "exit", "close"],
      danger: true,
      onSelect: () => {
        disconnect()
        setOpen(false)
      },
    },
  ]

  if (!initialized) return null

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      contentClassName="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl shadow-primary/5 overflow-hidden"
    >
      <CommandInput
        placeholder="Type a command or search…"
        className="h-12 w-full border-b border-border bg-transparent px-4 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <CommandList className="max-h-80 overflow-y-auto p-2">
        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
          No results found.
        </CommandEmpty>

        <CommandGroup
          heading="Navigate"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={item.id}
                keywords={item.keywords}
                onSelect={() => handleNav(item.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono">{item.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator className="my-1 h-px bg-border" />

        <CommandGroup
          heading="Actions"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <CommandItem
                key={action.id}
                value={action.id}
                keywords={action.keywords}
                onSelect={action.onSelect}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary ${
                  action.danger
                    ? "text-red-400 data-[selected=true]:bg-red-500/10 data-[selected=true]:text-red-400"
                    : "text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono">{action.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
        <span>
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>{" "}
          navigate
        </span>
        <span>
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>{" "}
          select
        </span>
        <span>
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">esc</kbd>{" "}
          close
        </span>
      </div>
    </CommandDialog>
  )
}
