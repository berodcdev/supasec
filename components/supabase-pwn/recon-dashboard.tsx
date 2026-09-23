"use client"

import { useMemo } from "react"
import {
  Crosshair,
  Database,
  HardDrive,
  Play,
  Radio,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react"

import { useSupabase } from "@/lib/supabase-context"
import { loadLastScan } from "@/lib/scan-history"
import {
  deriveFindings,
  summarizeFindings,
  type FindingSeverity,
} from "@/lib/findings"
import { sensitiveTableHint } from "@/lib/sensitive"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SectionHeader } from "@/components/supabase-pwn/shared/section-header"
import { EmptyState } from "@/components/supabase-pwn/shared/empty-state"
import {
  StatusBadge,
  type Severity,
} from "@/components/supabase-pwn/shared/status-badge"

const FINDING_BADGE: Record<FindingSeverity, Severity> = {
  critical: "critical",
  high: "high",
  medium: "warning",
  low: "info",
  info: "neutral",
}

const KEY_SEVERITY: Record<string, Severity> = {
  service_role: "critical",
  secret: "critical",
  anon: "info",
  publishable: "safe",
  unknown: "neutral",
}

function Stat({
  value,
  label,
  sub,
  onClick,
}: {
  value: number | string
  label: string
  sub?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-md border border-border bg-card p-3 text-left transition-colors enabled:hover:border-primary/40 disabled:cursor-default"
    >
      <div className="font-mono text-2xl font-bold tabular-nums text-primary">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </button>
  )
}

export function ReconDashboard() {
  const {
    client,
    schema,
    hints,
    projectUrl,
    keyType,
    logs,
    requestHistory,
    setActiveTab,
    triggerScan,
    focusOn,
  } = useSupabase()

  const lastScan = useMemo(
    () => (projectUrl ? loadLastScan(projectUrl) : null),
    [projectUrl],
  )
  const findings = useMemo(
    () => (lastScan ? deriveFindings(lastScan) : []),
    [lastScan],
  )
  const counts = useMemo(() => summarizeFindings(findings), [findings])
  const clueCount = useMemo(
    () => logs.filter((l) => l.message.includes("🔎")).length,
    [logs],
  )
  const recentClues = useMemo(
    () => logs.filter((l) => l.message.includes("🔎")).slice(-5).reverse(),
    [logs],
  )

  const tables = useMemo(() => schema?.tables ?? [], [schema])
  const sensitiveTables = useMemo(
    () => tables.filter((t) => sensitiveTableHint(t)),
    [tables],
  )
  const hintedTables = hints.tables.filter((t) => !tables.includes(t)).length

  if (!client || !schema) {
    return (
      <EmptyState
        icon={Crosshair}
        title="Connect a project to see the recon overview."
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <SectionHeader
        icon={Crosshair}
        eyebrow="RECON"
        title="Session overview"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge severity={KEY_SEVERITY[keyType] ?? "neutral"} dot={false}>
              {keyType}
            </StatusBadge>
            <Button size="sm" onClick={triggerScan}>
              <Play className="size-3.5" />
              Run scan
            </Button>
          </div>
        }
      />

      <p className="-mt-2 truncate font-mono text-xs text-muted-foreground" title={projectUrl}>
        {projectUrl}
      </p>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          value={tables.length}
          label="Tables"
          sub={hintedTables > 0 ? `+${hintedTables} from JS` : undefined}
          onClick={() => setActiveTab("database")}
        />
        <Stat
          value={schema.views?.length ?? 0}
          label="Views"
          onClick={() => setActiveTab("database")}
        />
        <Stat
          value={schema.functions?.length ?? 0}
          label="Functions"
          sub={hints.functions.length > 0 ? `+${hints.functions.length} hinted` : undefined}
          onClick={() => setActiveTab("functions")}
        />
        <Stat
          value={schema.rlsPolicies?.length ?? 0}
          label="RLS policies"
          onClick={() => setActiveTab("database")}
        />
        <Stat
          value={lastScan?.storage.length ?? 0}
          label="Buckets"
          sub={
            lastScan
              ? `${lastScan.storage.filter((b) => b.public).length} public`
              : "run scan"
          }
          onClick={() => setActiveTab("storage")}
        />
        <Stat
          value={clueCount}
          label="Clues 🔎"
          onClick={() => setActiveTab("database")}
        />
      </div>

      {/* Risk from the last scan */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="size-4" />
              Last scan
            </span>
            {lastScan ? (
              <button
                type="button"
                onClick={() => setActiveTab("autopwn")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {new Date(lastScan.timestamp).toLocaleString()} · details →
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                no scan yet
              </span>
            )}
          </div>
          {findings.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(
                ["critical", "high", "medium", "low", "info"] as FindingSeverity[]
              )
                .filter((s) => counts[s] > 0)
                .map((s) => (
                  <StatusBadge key={s} severity={FINDING_BADGE[s]} dot={false}>
                    {counts[s]} {s}
                  </StatusBadge>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {lastScan
                ? "No findings in the last scan."
                : "Run the AutoPwn scanner to populate findings."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent clues */}
      {recentClues.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Crosshair className="size-4" />
              Recent clues ({clueCount})
            </span>
            <div className="space-y-1">
              {recentClues.map((c) => (
                <p
                  key={c.id}
                  className="truncate font-mono text-xs text-warning"
                  title={c.message}
                >
                  {c.message}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sensitive-looking tables */}
      {sensitiveTables.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Shield className="size-4" />
              Sensitive-looking tables ({sensitiveTables.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {sensitiveTables.map((t) => (
                <StatusBadge
                  key={t}
                  severity="critical"
                  dot={false}
                  className="cursor-pointer"
                  onClick={() => focusOn("database", t)}
                >
                  {t}
                </StatusBadge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setActiveTab("database")}>
          <Database className="size-3.5" />
          Database
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab("storage")}>
          <HardDrive className="size-3.5" />
          Storage
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab("functions")}>
          <Zap className="size-3.5" />
          Functions
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab("realtime")}>
          <Radio className="size-3.5" />
          Realtime
        </Button>
        {requestHistory.length > 0 && (
          <span className="self-center text-xs text-muted-foreground">
            {requestHistory.length} request(s) in history
          </span>
        )}
      </div>
    </div>
  )
}
