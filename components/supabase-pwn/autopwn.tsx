"use client"

import { cn, uuid } from "@/lib/utils"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Play,
  Square,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Database,
  HardDrive,
  Key,
  Zap,
  Download,
  History,
  Sparkles,
  Trash2,
} from "lucide-react"

import {
  useSupabase,
  TABLE_WORDLIST,
  FUNCTION_WORDLIST,
} from "@/lib/supabase-context"
import {
  clearScanHistory,
  diffHasChanges,
  diffScans,
  loadLastScan,
  loadScanHistory,
  saveScan,
  type ScanDiff,
  type ScanRecord,
} from "@/lib/scan-history"
import {
  downloadFile,
  formatMarkdownReport,
  reportFilenameBase,
} from "@/lib/scan-report"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  StatusBadge as SeverityBadge,
  type Severity,
} from "@/components/supabase-pwn/shared/status-badge"
import { EmptyState } from "@/components/supabase-pwn/shared/empty-state"
import { ReticlePanel } from "@/components/supabase-pwn/shared/reticle-panel"
import { DataTable } from "@/components/supabase-pwn/shared/data-table"
import { JsonViewer } from "@/components/supabase-pwn/shared/json-viewer"
import {
  deriveFindings,
  summarizeFindings,
  type Finding,
  type FindingSeverity,
} from "@/lib/findings"
import { isSensitiveColumn } from "@/lib/sensitive"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccessStatus = "allowed" | "denied" | "error" | "empty"
type WriteStatus = AccessStatus | "skipped"

type ScanResult = {
  name: string
  select?: AccessStatus
  insert?: WriteStatus
  update?: WriteStatus
  delete?: WriteStatus
  details?: string
  /** Exact row count when data was exposed (null = couldn't be counted). */
  rowCount?: number | null
  /** Number of columns in the exposed row. */
  colCount?: number
  /** Column names harvested from the exposed row. */
  columns?: string[]
  /** First exposed row — what actually leaked. */
  sample?: unknown
}

type StorageResult = {
  name: string
  public: boolean
  listable: AccessStatus
  fileCount?: number
}

type AuthResult = {
  feature: string
  status: "enabled" | "disabled" | "error"
  details?: string
}

type FunctionResult = {
  name: string
  status: "found" | "not_found" | "error"
  statusCode?: number
}

type ScanPhase =
  | "idle"
  | "recon"
  | "database"
  | "storage"
  | "auth"
  | "functions"
  | "complete"

type ScanConfig = {
  databaseRls: boolean
  storageScan: boolean
  authProbing: boolean
  edgeFunctions: boolean
  concurrency: number
  writeTesting: boolean
  customTables: string
  /** Augment table list with the curated wordlist. */
  useBuiltinTableWordlist: boolean
  /** Augment table+function lists with identifiers harvested from JS bundles. */
  useJsHints: boolean
}

type AbortSignal = { aborted: boolean }

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number,
  signal: AbortSignal,
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += batchSize) {
    if (signal.aborted) break
    const batch = tasks.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map((t) => t()))
    for (const r of batchResults) {
      results.push(r.status === "fulfilled" ? r.value : r.reason)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

// Maps a scan probe outcome to a security-SEVERITY badge (finding POV):
//   exposed/accessible → danger, protected/denied → safe, informational → info.
// This is the deliberate semantic fix from the redesign: "DATA EXPOSED" now
// reads as a critical finding (red), not an attacker's success (previously green).
function StatusBadge({
  status,
}: {
  status: AccessStatus | WriteStatus | "enabled" | "disabled" | "found" | "not_found" | undefined
}) {
  if (!status) return <span className="text-xs text-muted-foreground">-</span>

  const meta: Record<string, { severity: Severity; label: string }> = {
    allowed: { severity: "critical", label: "DATA EXPOSED" },
    enabled: { severity: "warning", label: "ENABLED" },
    found: { severity: "info", label: "FOUND" },
    empty: { severity: "warning", label: "200 OK (EMPTY)" },
    denied: { severity: "safe", label: "DENIED" },
    disabled: { severity: "safe", label: "DISABLED" },
    not_found: { severity: "neutral", label: "NOT FOUND" },
    error: { severity: "warning", label: "ERROR" },
    skipped: { severity: "neutral", label: "SKIPPED" },
  }

  const m = meta[status]
  if (!m) return <span className="text-xs text-muted-foreground">-</span>

  return (
    <SeverityBadge severity={m.severity} dot={false}>
      {m.label}
    </SeverityBadge>
  )
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function ResultSection({
  title,
  icon: Icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
        {open ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <Icon className="size-4 shrink-0" />
        <span>{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {count}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Scan presets (one-click configuration)
// ---------------------------------------------------------------------------

const SCAN_PRESETS: {
  key: string
  label: string
  hint: string
  config: Partial<ScanConfig>
}[] = [
  {
    key: "quick",
    label: "Quick",
    hint: "RLS + storage, no wordlist",
    config: {
      databaseRls: true,
      storageScan: true,
      authProbing: false,
      edgeFunctions: false,
      writeTesting: false,
      useBuiltinTableWordlist: false,
      useJsHints: true,
      concurrency: 10,
    },
  },
  {
    key: "deep",
    label: "Deep",
    hint: "Everything + wordlist",
    config: {
      databaseRls: true,
      storageScan: true,
      authProbing: true,
      edgeFunctions: true,
      writeTesting: false,
      useBuiltinTableWordlist: true,
      useJsHints: true,
      concurrency: 15,
    },
  },
  {
    key: "safe",
    label: "Safe (read-only)",
    hint: "No auth probing, no writes",
    config: {
      databaseRls: true,
      storageScan: true,
      authProbing: false,
      edgeFunctions: true,
      writeTesting: false,
      useBuiltinTableWordlist: true,
      useJsHints: true,
      concurrency: 10,
    },
  },
]

// Ordered scan phases for the live HUD strip.
const PHASE_STEPS: {
  key: ScanPhase
  label: string
  enabled: (c: ScanConfig) => boolean
}[] = [
  { key: "recon", label: "RECON", enabled: () => true },
  { key: "database", label: "RLS", enabled: (c) => c.databaseRls },
  { key: "storage", label: "STORAGE", enabled: (c) => c.storageScan },
  { key: "auth", label: "AUTH", enabled: (c) => c.authProbing },
  { key: "functions", label: "EDGE", enabled: (c) => c.edgeFunctions },
]
const PHASE_ORDER: ScanPhase[] = [
  "idle",
  "recon",
  "database",
  "storage",
  "auth",
  "functions",
  "complete",
]

// Finding severity → StatusBadge severity (StatusBadge has no "medium"/"low").
const FINDING_BADGE: Record<FindingSeverity, Severity> = {
  critical: "critical",
  high: "high",
  medium: "warning",
  low: "info",
  info: "neutral",
}

// ---------------------------------------------------------------------------
// AutoPwn Component
// ---------------------------------------------------------------------------

export function AutoPwn() {
  const { client, schema, addLog, projectUrl, apiKey, keyType, hints, mergeHints, scanSignal, focusOn } = useSupabase()

  // -- Config state ---------------------------------------------------------
  const [config, setConfig] = useState<ScanConfig>({
    databaseRls: true,
    storageScan: true,
    authProbing: true,
    edgeFunctions: false,
    concurrency: 10,
    writeTesting: false,
    customTables: "",
    useBuiltinTableWordlist: true,
    useJsHints: true,
  })

  // -- Scan history (persisted) --------------------------------------------
  const [previousScan, setPreviousScan] = useState<ScanRecord | null>(null)
  const [latestScan, setLatestScan] = useState<ScanRecord | null>(null)
  const [diff, setDiff] = useState<ScanDiff | null>(null)
  const [history, setHistory] = useState<ScanRecord[]>([])

  // Load the most recent persisted scan when the connected project changes
  useEffect(() => {
    if (!projectUrl) {
      setPreviousScan(null)
      setLatestScan(null)
      setDiff(null)
      setHistory([])
      return
    }
    setPreviousScan(loadLastScan(projectUrl))
    setLatestScan(null)
    setDiff(null)
    setHistory(loadScanHistory(projectUrl))
  }, [projectUrl])

  // -- Scan state -----------------------------------------------------------
  const [phase, setPhase] = useState<ScanPhase>("idle")
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState("")
  const [currentItem, setCurrentItem] = useState("")

  // -- Results state --------------------------------------------------------
  const [dbResults, setDbResults] = useState<ScanResult[]>([])
  const [storageResults, setStorageResults] = useState<StorageResult[]>([])
  const [authResults, setAuthResults] = useState<AuthResult[]>([])
  const [functionResults, setFunctionResults] = useState<FunctionResult[]>([])

  // -- Abort ref ------------------------------------------------------------
  const abortRef = useRef<AbortSignal>({ aborted: false })

  // -- Config helpers -------------------------------------------------------
  const updateConfig = useCallback(
    <K extends keyof ScanConfig>(key: K, value: ScanConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  // -- Phase weight calculation for progress --------------------------------
  const getPhaseWeights = useCallback(() => {
    const weights: { phase: string; weight: number }[] = []
    weights.push({ phase: "recon", weight: 5 })
    if (config.databaseRls) weights.push({ phase: "database", weight: 50 })
    if (config.storageScan) weights.push({ phase: "storage", weight: 20 })
    if (config.authProbing) weights.push({ phase: "auth", weight: 10 })
    if (config.edgeFunctions) weights.push({ phase: "functions", weight: 15 })
    return weights
  }, [config])

  const calculateProgress = useCallback(
    (currentPhase: string, phaseProgress: number) => {
      const weights = getPhaseWeights()
      const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
      let accumulated = 0
      for (const w of weights) {
        if (w.phase === currentPhase) {
          accumulated += (w.weight * phaseProgress) / 100
          break
        }
        accumulated += w.weight
      }
      return Math.min(Math.round((accumulated / totalWeight) * 100), 100)
    },
    [getPhaseWeights],
  )

  // =========================================================================
  // Scanning Phases
  // =========================================================================

  // -- Phase 1: Reconnaissance ----------------------------------------------
  const runRecon = useCallback(() => {
    if (!schema) return
    setPhase("recon")
    setProgressLabel("Reconnaissance")
    setCurrentItem("Analyzing discovered schema...")

    const tableCount = schema.tables.length
    const viewCount = schema.views.length
    const fnCount = schema.functions.length

    addLog(
      "info",
      `Recon: ${tableCount} tables, ${viewCount} views, ${fnCount} functions discovered`,
    )
    setProgress(calculateProgress("recon", 100))
  }, [schema, addLog, calculateProgress])

  // -- Phase 2: Database RLS Testing ----------------------------------------
  const runDatabaseRls = useCallback(async () => {
    if (!client || !schema) return

    setPhase("database")
    setProgressLabel("Database RLS Testing")

    // Collect tables to test
    const customTableNames = config.customTables
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean)

    const sources: string[][] = [schema.tables, customTableNames]
    if (config.useJsHints && hints.tables.length > 0) sources.push(hints.tables)
    if (config.useBuiltinTableWordlist) sources.push(TABLE_WORDLIST)

    const allTables = [...new Set(sources.flat())]

    if (allTables.length === 0) {
      addLog("warning", "No tables to test for RLS")
      setProgress(calculateProgress("database", 100))
      return
    }

    const results: ScanResult[] = []
    const tested = new Set<string>()
    /** New tables surfaced by PGRST205 server hints during scanning. */
    const newHinted = new Set<string>()

    /** Match "Perhaps you meant the table 'public.xxx'" */
    const parseServerHint = (hint: string | null | undefined): string | null => {
      if (!hint) return null
      const m = hint.match(/perhaps you meant.*?'(?:public\.)?([^']+)'/i)
      return m ? m[1] : null
    }

    const probeOne = async (
      table: string,
      idx: number,
      total: number,
    ): Promise<ScanResult> => {
      if (abortRef.current.aborted) {
        return { name: table, select: "error", details: "Aborted" }
      }

      setCurrentItem(`SELECT on ${table} (${idx + 1}/${total})`)

      const result: ScanResult = { name: table }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (client as any)
          .from(table)
          .select("*")
          .limit(1)

        if (error) {
          const code = error.code ?? ""
          const msg = (error.message ?? "").toLowerCase()

          // Capture PGRST205 server hints — they often reveal real table names
          // even when the probed name was wrong (e.g. "users" → "profiles").
          if (code === "PGRST205") {
            const hintedFromHint = parseServerHint(error.hint)
            const hintedFromMsg = parseServerHint(error.message)
            const hinted = hintedFromHint ?? hintedFromMsg
            if (hinted && !tested.has(hinted)) newHinted.add(hinted)
          }

          if (
            code === "42501" ||
            msg.includes("denied") ||
            msg.includes("rls") ||
            msg.includes("permission") ||
            msg.includes("policy")
          ) {
            result.select = "denied"
          } else {
            result.select = "error"
          }
          result.details = `SELECT: ${error.message}`
        } else {
          const rowsReturned = Array.isArray(data) ? data.length : 0
          if (rowsReturned > 0) {
            result.select = "allowed"
            const first = (data as unknown[])[0]
            const columns =
              first && typeof first === "object"
                ? Object.keys(first as Record<string, unknown>)
                : []
            result.columns = columns
            result.colCount = columns.length
            result.sample = first

            // Best-effort exact row count (cheap HEAD request) — only for the
            // few tables that actually expose data, so scan timing is unaffected.
            let exact: number | null = null
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { count } = await (client as any)
                .from(table)
                .select("*", { count: "exact", head: true })
              exact = typeof count === "number" ? count : null
            } catch {
              exact = null
            }
            result.rowCount = exact
            result.details = `DATA EXPOSED — ${
              exact != null ? `${exact} row(s)` : "readable"
            }, ${columns.length} column(s)`
          } else {
            result.select = "empty"
            result.details = `SELECT returned 200 OK but 0 rows (empty table or RLS filtering)`
          }
        }
      } catch (err) {
        result.select = "error"
        result.details =
          err instanceof Error ? err.message : "Unknown SELECT error"
      }

      // Write testing (INSERT then cleanup DELETE)
      if (config.writeTesting) {
        // INSERT test
        try {
          setCurrentItem(`INSERT on ${table} (${idx + 1}/${total})`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (client as any)
            .from(table)
            .insert({
              __supabase_pwn_probe: true,
              _timestamp: Date.now(),
            })

          if (insertError) {
            const code = insertError.code ?? ""
            const msg = (insertError.message ?? "").toLowerCase()
            if (
              code === "42501" ||
              msg.includes("denied") ||
              msg.includes("rls") ||
              msg.includes("permission") ||
              msg.includes("policy")
            ) {
              result.insert = "denied"
            } else {
              result.insert = "error"
            }
          } else {
            result.insert = "allowed"
          }
        } catch {
          result.insert = "error"
        }

        // DELETE test (cleanup)
        try {
          setCurrentItem(`DELETE on ${table} (${idx + 1}/${total})`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: deleteError } = await (client as any)
            .from(table)
            .delete()
            .eq("__supabase_pwn_probe", true)

          if (deleteError) {
            const code = deleteError.code ?? ""
            const msg = (deleteError.message ?? "").toLowerCase()
            if (
              code === "42501" ||
              msg.includes("denied") ||
              msg.includes("rls") ||
              msg.includes("permission") ||
              msg.includes("policy")
            ) {
              result.delete = "denied"
            } else {
              result.delete = "error"
            }
          } else {
            result.delete = "allowed"
          }
        } catch {
          result.delete = "error"
        }
      } else {
        result.insert = "skipped"
        result.update = "skipped"
        result.delete = "skipped"
      }

      return result
    }

    /** Run a wave of probes against `tables` and append to `results`. */
    const runWave = async (tables: string[]) => {
      const total = tables.length
      const tasks = tables.map((t, i) => {
        tested.add(t)
        return () => probeOne(t, i, total)
      })
      const wave = await runInBatches(tasks, config.concurrency, abortRef.current)
      for (const r of wave) {
        if (r && typeof r === "object" && "name" in r) {
          results.push(r as ScanResult)
        }
      }
    }

    // Wave 1: explicit + wordlist + JS hints
    await runWave(allTables)

    // Wave 2: PGRST205 server-suggested table names that we haven't tested yet
    if (!abortRef.current.aborted) {
      const wave2 = [...newHinted].filter((t) => !tested.has(t))
      if (wave2.length > 0) {
        addLog(
          "info",
          `Probing ${wave2.length} table(s) suggested by PGRST205 server hints…`,
        )
        await runWave(wave2)
      }
      // Persist newly-confirmed names into context hints so the DB explorer
      // and future scans pick them up.
      if (newHinted.size > 0) {
        mergeHints({ tables: [...newHinted] })
      }
    }

    setDbResults(results)

    const dataExposedCount = results.filter((r) => r.select === "allowed").length
    const emptyOkCount = results.filter((r) => r.select === "empty").length
    const hintNote = newHinted.size > 0 ? ` (+${newHinted.size} from server hints)` : ""
    addLog(
      dataExposedCount > 0 ? "warning" : "success",
      `Database RLS: ${dataExposedCount}/${results.length} tables expose data, ${emptyOkCount} return 200 OK (empty)${hintNote}`,
    )

    setProgress(calculateProgress("database", 100))
  }, [client, schema, config, hints.tables, addLog, calculateProgress, mergeHints])

  // -- Phase 3: Storage Scanning --------------------------------------------
  const runStorageScan = useCallback(async () => {
    if (!client) return

    setPhase("storage")
    setProgressLabel("Storage Scanning")
    setCurrentItem("Listing buckets...")

    const results: StorageResult[] = []

    try {
      const { data: buckets, error } = await client.storage.listBuckets()

      if (error) {
        addLog("error", `Storage scan error: ${error.message}`)
        setProgress(calculateProgress("storage", 100))
        return
      }

      if (!buckets || buckets.length === 0) {
        addLog("info", "No storage buckets found")
        setProgress(calculateProgress("storage", 100))
        return
      }

      const totalBuckets = buckets.length

      for (let i = 0; i < totalBuckets; i++) {
        if (abortRef.current.aborted) break

        const bucket = buckets[i]
        setCurrentItem(`Scanning bucket: ${bucket.name} (${i + 1}/${totalBuckets})`)

        const result: StorageResult = {
          name: bucket.name,
          public: bucket.public,
          listable: "error",
        }

        try {
          const { data: files, error: listError } = await client.storage
            .from(bucket.name)
            .list("", { limit: 5 })

          if (listError) {
            const msg = (listError.message ?? "").toLowerCase()
            if (
              msg.includes("denied") ||
              msg.includes("policy") ||
              msg.includes("permission")
            ) {
              result.listable = "denied"
            } else {
              result.listable = "error"
            }
          } else {
            result.listable = "allowed"
            result.fileCount = files?.length ?? 0
          }
        } catch {
          result.listable = "error"
        }

        results.push(result)
        setProgress(
          calculateProgress("storage", ((i + 1) / totalBuckets) * 100),
        )
      }

      setStorageResults(results)

      const publicCount = results.filter((r) => r.public).length
      const listableCount = results.filter((r) => r.listable === "allowed").length
      addLog(
        publicCount > 0 || listableCount > 0 ? "warning" : "success",
        `Storage: ${results.length} bucket(s), ${publicCount} public, ${listableCount} listable`,
      )
    } catch (err) {
      addLog(
        "error",
        err instanceof Error ? err.message : "Storage scan failed",
      )
    }

    setProgress(calculateProgress("storage", 100))
  }, [client, addLog, calculateProgress])

  // -- Phase 4: Auth Probing ------------------------------------------------
  const runAuthProbing = useCallback(async () => {
    if (!client) return

    setPhase("auth")
    setProgressLabel("Auth Probing")
    const results: AuthResult[] = []

    // Test signup
    setCurrentItem("Testing open signup...")
    try {
      const probeEmail = `supabase-pwn-${uuid().slice(0, 8)}@iapapi.com`
      const { data, error } = await client.auth.signUp({
        email: probeEmail,
        password: "SupabasePwnProbe123!",
      })

      if (error) {
        const msg = (error.message ?? "").toLowerCase()
        if (msg.includes("disabled") || msg.includes("not allowed") || msg.includes("signup is not available")) {
          results.push({
            feature: "Email Signup",
            status: "disabled",
            details: error.message,
          })
        } else {
          results.push({
            feature: "Email Signup",
            status: "error",
            details: error.message,
          })
        }
      } else {
        // If we got a user back, signup is open
        const hasUser = data?.user !== null && data?.user !== undefined
        results.push({
          feature: "Email Signup",
          status: hasUser ? "enabled" : "disabled",
          details: hasUser
            ? `Account created for ${probeEmail}`
            : "Signup returned no user (may require email confirmation)",
        })
      }
    } catch (err) {
      results.push({
        feature: "Email Signup",
        status: "error",
        details: err instanceof Error ? err.message : "Unknown error",
      })
    }

    setProgress(calculateProgress("auth", 50))

    // Test anonymous auth
    if (!abortRef.current.aborted) {
      setCurrentItem("Testing anonymous authentication...")
      try {
        const { data, error } = await client.auth.signInAnonymously()

        if (error) {
          const msg = (error.message ?? "").toLowerCase()
          if (msg.includes("disabled") || msg.includes("not allowed")) {
            results.push({
              feature: "Anonymous Auth",
              status: "disabled",
              details: error.message,
            })
          } else {
            results.push({
              feature: "Anonymous Auth",
              status: "error",
              details: error.message,
            })
          }
        } else {
          const hasSession = data?.session !== null && data?.session !== undefined
          results.push({
            feature: "Anonymous Auth",
            status: hasSession ? "enabled" : "disabled",
            details: hasSession
              ? "Anonymous sessions are enabled"
              : "No session returned",
          })
        }
      } catch (err) {
        results.push({
          feature: "Anonymous Auth",
          status: "error",
          details: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    // Sign out after probing
    try {
      await client.auth.signOut()
    } catch {
      // Ignore sign-out errors during probing
    }

    setAuthResults(results)

    const enabledCount = results.filter((r) => r.status === "enabled").length
    addLog(
      enabledCount > 0 ? "warning" : "info",
      `Auth: ${enabledCount}/${results.length} features enabled`,
    )

    setProgress(calculateProgress("auth", 100))
  }, [client, addLog, calculateProgress])

  // -- Phase 5: Edge Function Discovery -------------------------------------
  const runEdgeFunctionDiscovery = useCallback(async () => {
    if (!client || !projectUrl || !apiKey) return

    setPhase("functions")
    setProgressLabel("Edge Function Discovery")

    const fnSources: string[][] = [FUNCTION_WORDLIST]
    if (config.useJsHints && hints.functions.length > 0) fnSources.push(hints.functions)
    const commonNames = [...new Set(fnSources.flat())]

    const results: FunctionResult[] = []
    const totalFunctions = commonNames.length

    // Why a raw fetch instead of client.functions.invoke():
    //   1. invoke() throws SDK-wrapped errors whose .message rarely contains "404",
    //      so the previous version classified almost everything as "found".
    //   2. We need the real HTTP status to distinguish 404 (not deployed) from
    //      anything else (deployed — even 401/4xx/5xx confirm existence).
    // The functions gateway returns CORS headers on 404 responses, so the browser
    // can read the status. If a deployed function lacks CORS, the fetch promise
    // will reject — we treat that as "found" (the gateway routed to it).
    const probeFunction = async (name: string): Promise<FunctionResult> => {
      const url = `${projectUrl.replace(/\/$/, "")}/functions/v1/${encodeURIComponent(name)}`
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: "{}",
        })

        if (res.status === 404) {
          return { name, status: "not_found", statusCode: 404 }
        }
        // Anything else (200, 401, 4xx, 5xx) — function is deployed.
        return { name, status: "found", statusCode: res.status }
      } catch {
        // TypeError ("Failed to fetch") usually = CORS or network. The gateway
        // sets CORS on 404s, so a network failure most likely means the
        // function exists but its handler doesn't allow our origin.
        return { name, status: "found" }
      }
    }

    const tasks = commonNames.map((name, idx) => {
      return async (): Promise<FunctionResult> => {
        if (abortRef.current.aborted) {
          return { name, status: "error" }
        }
        setCurrentItem(
          `Probing function: ${name} (${idx + 1}/${totalFunctions})`,
        )
        return probeFunction(name)
      }
    })

    const batchResults = await runInBatches(
      tasks,
      config.concurrency,
      abortRef.current,
    )

    for (const r of batchResults) {
      if (r && typeof r === "object" && "name" in r) {
        results.push(r as FunctionResult)
      }
    }

    setFunctionResults(results)

    const foundCount = results.filter((r) => r.status === "found").length
    addLog(
      foundCount > 0 ? "success" : "info",
      `Edge Functions: ${foundCount}/${results.length} functions discovered`,
    )

    setProgress(calculateProgress("functions", 100))
  }, [client, projectUrl, apiKey, config.concurrency, config.useJsHints, hints.functions, addLog, calculateProgress])

  // =========================================================================
  // Start / Abort
  // =========================================================================

  const handleStartScan = useCallback(async () => {
    if (!client || !schema) return

    // Reset state
    abortRef.current = { aborted: false }
    setScanning(true)
    setProgress(0)
    setDbResults([])
    setStorageResults([])
    setAuthResults([])
    setFunctionResults([])
    setLatestScan(null)
    setDiff(null)
    // Capture the previous scan once at the start of this run, so the diff
    // we compute when finishing reflects "current vs prior persisted run".
    const priorRecord = projectUrl ? loadLastScan(projectUrl) : null
    setPreviousScan(priorRecord)

    addLog("info", "AutoPwn scan started")

    try {
      // Phase 1: Recon
      runRecon()
      if (abortRef.current.aborted) throw new Error("Aborted")

      // Phase 2: Database RLS Testing
      if (config.databaseRls) {
        await runDatabaseRls()
        if (abortRef.current.aborted) throw new Error("Aborted")
      }

      // Phase 3: Storage Scanning
      if (config.storageScan) {
        await runStorageScan()
        if (abortRef.current.aborted) throw new Error("Aborted")
      }

      // Phase 4: Auth Probing
      if (config.authProbing) {
        await runAuthProbing()
        if (abortRef.current.aborted) throw new Error("Aborted")
      }

      // Phase 5: Edge Function Discovery
      if (config.edgeFunctions) {
        await runEdgeFunctionDiscovery()
        if (abortRef.current.aborted) throw new Error("Aborted")
      }

      setPhase("complete")
      setProgress(100)
      setProgressLabel("Scan Complete")
      setCurrentItem("")
      addLog("success", "AutoPwn scan completed")
      // Persistence + diff are computed in the useEffect below — we read the
      // committed React state there so results are not stale.
    } catch (err) {
      if (abortRef.current.aborted) {
        setPhase("idle")
        setProgressLabel("Scan Aborted")
        addLog("warning", "AutoPwn scan aborted by user")
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error"
        addLog("error", `AutoPwn scan failed: ${msg}`)
        setPhase("idle")
        setProgressLabel("Scan Failed")
      }
    } finally {
      setScanning(false)
    }
  }, [
    client,
    schema,
    config,
    projectUrl,
    addLog,
    runRecon,
    runDatabaseRls,
    runStorageScan,
    runAuthProbing,
    runEdgeFunctionDiscovery,
  ])

  // Auto-start when another component asks for a scan (auto-scan on connect /
  // the "Run scan" button). We de-dupe on the signal value so it fires once.
  const lastSignalRef = useRef(0)
  useEffect(() => {
    if (
      scanSignal > 0 &&
      scanSignal !== lastSignalRef.current &&
      client &&
      schema &&
      !scanning
    ) {
      lastSignalRef.current = scanSignal
      handleStartScan()
    }
  }, [scanSignal, client, schema, scanning, handleStartScan])

  // After a successful scan, persist + diff against the prior run
  useEffect(() => {
    if (phase !== "complete" || scanning || !projectUrl) return
    if (latestScan) return // already persisted this completion
    const record: ScanRecord = {
      schemaVersion: 1,
      projectUrl,
      keyType,
      timestamp: new Date().toISOString(),
      db: dbResults,
      storage: storageResults,
      auth: authResults,
      functions: functionResults,
    }
    saveScan(record)
    setLatestScan(record)
    setDiff(diffScans(previousScan, record))
    setHistory(loadScanHistory(projectUrl))

    // Point the confirmed vulnerabilities straight into the log so they stand
    // out from the progress chatter.
    const runFindings = deriveFindings(record)
    const c = summarizeFindings(runFindings)
    addLog(
      c.critical > 0 || c.high > 0 ? "warning" : "success",
      `AutoPwn findings: ${c.critical} critical · ${c.high} high · ${c.medium} medium · ${c.low} low`,
    )
    for (const f of runFindings) {
      if (f.severity === "critical" || f.severity === "high") {
        addLog(
          f.severity === "critical" ? "error" : "warning",
          `VULN [${f.severity.toUpperCase()}] ${f.title}`,
          { evidence: f.evidence, remediation: f.remediation },
        )
      }
    }
  }, [
    phase,
    scanning,
    projectUrl,
    keyType,
    dbResults,
    storageResults,
    authResults,
    functionResults,
    previousScan,
    latestScan,
    addLog,
  ])

  // Export helpers --------------------------------------------------------
  const exportableScan = useMemo<ScanRecord | null>(() => {
    if (latestScan) return latestScan
    if (phase !== "complete" || !projectUrl) return null
    return {
      schemaVersion: 1,
      projectUrl,
      keyType,
      timestamp: new Date().toISOString(),
      db: dbResults,
      storage: storageResults,
      auth: authResults,
      functions: functionResults,
    }
  }, [
    latestScan,
    phase,
    projectUrl,
    keyType,
    dbResults,
    storageResults,
    authResults,
    functionResults,
  ])

  // Prioritized findings derived from the completed scan.
  const findings = useMemo<Finding[]>(
    () => (exportableScan ? deriveFindings(exportableScan) : []),
    [exportableScan],
  )
  const findingCounts = useMemo(() => summarizeFindings(findings), [findings])

  // New vs resolved findings compared to the previously persisted scan.
  const findingDelta = useMemo(() => {
    if (!latestScan || !previousScan) return null
    const prev = new Map(deriveFindings(previousScan).map((f) => [f.id, f]))
    const curr = new Map(deriveFindings(latestScan).map((f) => [f.id, f]))
    const added = [...curr.values()].filter((f) => !prev.has(f.id))
    const resolved = [...prev.values()].filter((f) => !curr.has(f.id))
    return { added, resolved }
  }, [latestScan, previousScan])

  const handleExportMarkdown = useCallback(() => {
    if (!exportableScan) return
    const md = formatMarkdownReport(exportableScan)
    downloadFile(`${reportFilenameBase(exportableScan)}.md`, md, "text/markdown")
  }, [exportableScan])

  const handleExportJson = useCallback(() => {
    if (!exportableScan) return
    const json = JSON.stringify(
      { ...exportableScan, findings: deriveFindings(exportableScan) },
      null,
      2,
    )
    downloadFile(
      `${reportFilenameBase(exportableScan)}.json`,
      json,
      "application/json",
    )
  }, [exportableScan])

  const handleAbort = useCallback(() => {
    abortRef.current.aborted = true
    addLog("warning", "Aborting scan...")
  }, [addLog])

  // Load a persisted scan into the results view (read-only browse of history).
  const handleViewScan = useCallback(
    (rec: ScanRecord, older: ScanRecord | null) => {
      setDbResults(rec.db)
      setStorageResults(rec.storage)
      setAuthResults(rec.auth)
      setFunctionResults(rec.functions)
      setPreviousScan(older)
      setLatestScan(rec)
      setDiff(older ? diffScans(older, rec) : null)
      setPhase("complete")
      setProgress(100)
      setProgressLabel("Viewing saved scan")
      setCurrentItem("")
    },
    [],
  )

  const handleClearHistory = useCallback(() => {
    if (!projectUrl) return
    clearScanHistory(projectUrl)
    setHistory([])
    setPreviousScan(null)
    setDiff(null)
    addLog("info", "Cleared saved scans (and stored samples) for this project")
  }, [projectUrl, addLog])

  // =========================================================================
  // Summary computation
  // =========================================================================

  const summary = {
    tablesReadable: dbResults.filter((r) => r.select === "allowed").length,
    tablesEmpty: dbResults.filter((r) => r.select === "empty").length,
    totalTables: dbResults.length,
    tablesWritable: dbResults.filter((r) => r.insert === "allowed").length,
    bucketsFound: storageResults.length,
    bucketsPublic: storageResults.filter((r) => r.public).length,
    bucketsListable: storageResults.filter((r) => r.listable === "allowed").length,
    authEnabled: authResults.filter((r) => r.status === "enabled").length,
    authTotal: authResults.length,
    functionsFound: functionResults.filter((r) => r.status === "found").length,
    functionsTotal: functionResults.length,
  }

  // =========================================================================
  // Render
  // =========================================================================

  if (!client || !schema) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={ShieldAlert}
            title="Connect to a Supabase project to run the AutoPwn scanner."
          />
        </CardContent>
      </Card>
    )
  }

  // Key-kind warning copy ---------------------------------------------------
  const keyBanner = (() => {
    switch (keyType) {
      case "service_role":
        return {
          tone: "danger" as const,
          title: "Service Role key in use",
          body:
            "This key bypasses Row Level Security. Findings here reflect a fully-privileged admin, NOT what an unauthenticated attacker would see. Use an anon or publishable key to assess real exposure.",
        }
      case "secret":
        return {
          tone: "danger" as const,
          title: "Secret key in use",
          body:
            "Server-side `sb_secret_…` keys grant elevated privileges. Findings reflect a privileged caller, not an external attacker. Re-run with an anon/publishable key to gauge real-world risk.",
        }
      case "publishable":
        return {
          tone: "info" as const,
          title: "Publishable key",
          body:
            "Browser-safe key. Probes here approximate an unauthenticated attacker's view.",
        }
      case "anon":
        return {
          tone: "info" as const,
          title: "Anon key",
          body:
            "Probes here approximate an unauthenticated attacker's view via PostgREST + RLS.",
        }
      default:
        return null
    }
  })()

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------- */}
      {/* Key-kind banner                                                     */}
      {/* ------------------------------------------------------------------- */}
      {keyBanner && (
        <div
          className={
            keyBanner.tone === "danger"
              ? "rounded-md border border-danger/30 bg-danger/5 p-3"
              : "rounded-md border border-info/30 bg-info/5 p-3"
          }
        >
          <div className="flex gap-2 items-start">
            <ShieldAlert
              className={
                keyBanner.tone === "danger"
                  ? "size-4 text-danger mt-0.5 shrink-0"
                  : "size-4 text-info mt-0.5 shrink-0"
              }
            />
            <div className="text-xs">
              <div
                className={
                  keyBanner.tone === "danger"
                    ? "font-medium text-danger"
                    : "font-medium text-info"
                }
              >
                {keyBanner.title}
              </div>
              <p className="text-muted-foreground mt-0.5">{keyBanner.body}</p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Configuration                                                       */}
      {/* ------------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4" />
            AutoPwn Scanner Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-2">
              {SCAN_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant="outline"
                  size="sm"
                  disabled={scanning}
                  title={p.hint}
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, ...p.config }))
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Saved scans
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={(v) => {
                    const idx = history.findIndex((h) => h.timestamp === v)
                    if (idx >= 0)
                      handleViewScan(history[idx], history[idx + 1] ?? null)
                  }}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue
                      placeholder={`${history.length} saved — view a past scan`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {history.map((h) => (
                      <SelectItem key={h.timestamp} value={h.timestamp}>
                        {new Date(h.timestamp).toLocaleString()} ·{" "}
                        {h.db.filter((r) => r.select === "allowed").length} exposed
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearHistory}
                  disabled={scanning}
                  title="Delete saved scans (also wipes stored PII samples)"
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Phase toggles */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-muted-foreground" />
                <Label htmlFor="toggle-rls" className="cursor-pointer">
                  Database RLS Testing
                </Label>
              </div>
              <Switch
                id="toggle-rls"
                checked={config.databaseRls}
                onCheckedChange={(v) => updateConfig("databaseRls", v)}
                disabled={scanning}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <Label htmlFor="toggle-storage" className="cursor-pointer">
                  Storage Scanning
                </Label>
              </div>
              <Switch
                id="toggle-storage"
                checked={config.storageScan}
                onCheckedChange={(v) => updateConfig("storageScan", v)}
                disabled={scanning}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Key className="size-4 text-muted-foreground" />
                <Label htmlFor="toggle-auth" className="cursor-pointer">
                  Auth Probing
                </Label>
              </div>
              <Switch
                id="toggle-auth"
                checked={config.authProbing}
                onCheckedChange={(v) => updateConfig("authProbing", v)}
                disabled={scanning}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-muted-foreground" />
                <Label htmlFor="toggle-functions" className="cursor-pointer">
                  Edge Function Discovery
                </Label>
              </div>
              <Switch
                id="toggle-functions"
                checked={config.edgeFunctions}
                onCheckedChange={(v) => updateConfig("edgeFunctions", v)}
                disabled={scanning}
              />
            </div>
          </div>

          <Separator />

          {/* Concurrency */}
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="concurrency">Concurrency</Label>
              <Input
                id="concurrency"
                type="number"
                min={5}
                max={50}
                value={config.concurrency}
                onChange={(e) => {
                  const val = Math.min(50, Math.max(5, Number(e.target.value) || 10))
                  updateConfig("concurrency", val)
                }}
                className="w-24"
                disabled={scanning}
              />
            </div>
            <p className="text-xs text-muted-foreground pb-1">
              Number of concurrent requests (5-50)
            </p>
          </div>

          <Separator />

          {/* Write testing toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-warning" />
                <Label htmlFor="toggle-write" className="cursor-pointer">
                  Write Testing
                </Label>
              </div>
              <Switch
                id="toggle-write"
                checked={config.writeTesting}
                onCheckedChange={(v) => updateConfig("writeTesting", v)}
                disabled={scanning}
              />
            </div>
            {config.writeTesting && (
              <p className="text-xs text-warning px-1">
                Enables INSERT/UPDATE/DELETE tests. This will attempt to write
                probe data to tables.
              </p>
            )}
          </div>

          <Separator />

          {/* Custom table names */}
          <div className="space-y-1.5">
            <Label htmlFor="custom-tables">Custom Table Names</Label>
            <Textarea
              id="custom-tables"
              placeholder="Enter additional table names (comma or newline separated)"
              value={config.customTables}
              onChange={(e) => updateConfig("customTables", e.target.value)}
              className="min-h-16 text-sm font-mono"
              disabled={scanning}
            />
            <p className="text-xs text-muted-foreground">
              These will be added to the tables discovered from the schema.
            </p>
          </div>

          {/* Wordlist + JS hint sources */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <Label htmlFor="toggle-wordlist" className="cursor-pointer text-sm">
                  Curated wordlist ({TABLE_WORDLIST.length})
                </Label>
              </div>
              <Switch
                id="toggle-wordlist"
                checked={config.useBuiltinTableWordlist}
                onCheckedChange={(v) => updateConfig("useBuiltinTableWordlist", v)}
                disabled={scanning}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <Label htmlFor="toggle-js-hints" className="cursor-pointer text-sm">
                  JS-discovered ({hints.tables.length}/{hints.functions.length})
                </Label>
              </div>
              <Switch
                id="toggle-js-hints"
                checked={config.useJsHints}
                onCheckedChange={(v) => updateConfig("useJsHints", v)}
                disabled={scanning || (hints.tables.length === 0 && hints.functions.length === 0)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            JS-discovered identifiers come from <code>from(&apos;…&apos;)</code> /{" "}
            <code>functions.invoke(&apos;…&apos;)</code> calls captured by the
            URL extractor.
          </p>

          <Separator />

          {/* Start / Abort button */}
          <div className="flex items-center gap-3">
            {!scanning ? (
              <Button
                onClick={handleStartScan}
                className="gap-2 rounded-sm bg-armed font-mono uppercase tracking-widest text-armed-foreground shadow-[0_0_20px_-6px_var(--color-armed)] hover:bg-armed/90"
              >
                <Play className="size-4" />
                Start Scan
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleAbort}
                className="gap-2"
              >
                <Square className="size-4" />
                Abort
              </Button>
            )}

            {phase !== "idle" && !scanning && (
              <Badge variant="outline" className="text-xs">
                {phase === "complete" ? "Completed" : progressLabel}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------- */}
      {/* Progress                                                            */}
      {/* ------------------------------------------------------------------- */}
      {(scanning || phase !== "idle") && (
        <ReticlePanel active={scanning} label={scanning ? "SCAN:RUN" : "SCAN:IDLE"}>
          <Card>
            <CardContent className="space-y-3 pt-6">
              {/* Live phase strip */}
              <div className="flex gap-1">
                {PHASE_STEPS.filter((s) => s.enabled(config)).map((s) => {
                  const st =
                    phase === "complete"
                      ? "done"
                      : s.key === phase
                        ? "active"
                        : PHASE_ORDER.indexOf(s.key) < PHASE_ORDER.indexOf(phase)
                          ? "done"
                          : "pending"
                  return (
                    <div key={s.key} className="flex-1 space-y-1">
                      <div
                        className={cn(
                          "relative h-1 overflow-hidden",
                          st === "done" && "bg-primary",
                          st === "active" && "animate-scan-sweep bg-armed",
                          st === "pending" && "bg-border",
                        )}
                      />
                      <div
                        className={cn(
                          "font-mono text-[9px] uppercase tracking-widest",
                          st === "active"
                            ? "text-armed"
                            : st === "done"
                              ? "text-primary"
                              : "text-muted-foreground/50",
                        )}
                      >
                        {s.label}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="font-mono uppercase tracking-wide">
                  {progressLabel}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} active={scanning} />
              {currentItem && (
                <p className="truncate font-mono text-xs text-muted-foreground">
                  ▸ {currentItem}
                </p>
              )}
            </CardContent>
          </Card>
        </ReticlePanel>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Summary                                                             */}
      {/* ------------------------------------------------------------------- */}
      {phase === "complete" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Scan Summary
              </span>
              <span className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportMarkdown}
                  disabled={!exportableScan}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" />
                  Markdown
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportJson}
                  disabled={!exportableScan}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" />
                  JSON
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dbResults.length > 0 && (
                <>
                  <SeverityBadge
                    severity={summary.tablesReadable > 0 ? "critical" : "safe"}
                  >
                    {summary.tablesReadable}/{summary.totalTables} tables expose data
                  </SeverityBadge>
                  {summary.tablesEmpty > 0 && (
                    <SeverityBadge severity="warning">
                      {summary.tablesEmpty} return 200 OK (empty)
                    </SeverityBadge>
                  )}
                  {config.writeTesting && (
                    <SeverityBadge
                      severity={summary.tablesWritable > 0 ? "critical" : "safe"}
                    >
                      {summary.tablesWritable}/{summary.totalTables} tables writable
                    </SeverityBadge>
                  )}
                </>
              )}

              {storageResults.length > 0 && (
                <>
                  <SeverityBadge severity="neutral">
                    {summary.bucketsFound} bucket(s) found
                  </SeverityBadge>
                  {summary.bucketsPublic > 0 && (
                    <SeverityBadge severity="warning">
                      {summary.bucketsPublic} public bucket(s)
                    </SeverityBadge>
                  )}
                  {summary.bucketsListable > 0 && (
                    <SeverityBadge severity="warning">
                      {summary.bucketsListable} listable bucket(s)
                    </SeverityBadge>
                  )}
                </>
              )}

              {authResults.length > 0 && (
                <SeverityBadge
                  severity={summary.authEnabled > 0 ? "warning" : "safe"}
                >
                  {summary.authEnabled}/{summary.authTotal} auth features open
                </SeverityBadge>
              )}

              {functionResults.length > 0 && (
                <SeverityBadge severity="info">
                  {summary.functionsFound}/{summary.functionsTotal} functions found
                </SeverityBadge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Vulnerabilities (prioritized findings)                              */}
      {/* ------------------------------------------------------------------- */}
      {phase === "complete" && findings.length > 0 && (
        <Card className={findingCounts.critical > 0 ? "border-danger/50" : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <ShieldAlert className="size-4" />
                Vulnerabilities
              </span>
              <span className="flex flex-wrap gap-1.5">
                {(
                  ["critical", "high", "medium", "low", "info"] as FindingSeverity[]
                )
                  .filter((s) => findingCounts[s] > 0)
                  .map((s) => (
                    <SeverityBadge key={s} severity={FINDING_BADGE[s]} dot={false}>
                      {findingCounts[s]} {s}
                    </SeverityBadge>
                  ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {findings.map((f) => {
              const navigable =
                (f.category === "database" || f.category === "storage") &&
                !!f.target
              return (
              <div
                key={f.id}
                onClick={
                  navigable
                    ? () => focusOn(f.category, f.target as string)
                    : undefined
                }
                title={navigable ? "Open in its tab" : undefined}
                className={`space-y-1.5 rounded-sm border border-border p-3 ${
                  navigable
                    ? "cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                    : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <SeverityBadge
                    severity={FINDING_BADGE[f.severity]}
                    dot={false}
                    className="mt-0.5 shrink-0"
                  >
                    {f.severity}
                  </SeverityBadge>
                  <span className="text-sm font-medium">{f.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground/70">Evidence:</span>{" "}
                  {f.evidence}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground/70">Fix:</span>{" "}
                  {f.remediation}
                </p>
              </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Findings delta vs previous scan                                     */}
      {/* ------------------------------------------------------------------- */}
      {phase === "complete" &&
        findingDelta &&
        (findingDelta.added.length > 0 || findingDelta.resolved.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" />
                Findings changes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {findingDelta.added.map((f) => (
                <div key={`add-${f.id}`} className="flex items-start gap-2">
                  <SeverityBadge severity="critical" dot={false} className="mt-0.5 shrink-0">
                    new
                  </SeverityBadge>
                  <span className="text-sm">{f.title}</span>
                </div>
              ))}
              {findingDelta.resolved.map((f) => (
                <div key={`res-${f.id}`} className="flex items-start gap-2">
                  <SeverityBadge severity="safe" dot={false} className="mt-0.5 shrink-0">
                    fixed
                  </SeverityBadge>
                  <span className="text-sm text-muted-foreground line-through">
                    {f.title}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      {/* ------------------------------------------------------------------- */}
      {/* Diff vs previous scan                                               */}
      {/* ------------------------------------------------------------------- */}
      {phase === "complete" && diff && previousScan && diffHasChanges(diff) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              Changes since {new Date(previousScan.timestamp).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {diff.newReadable.length > 0 && (
              <div>
                <SeverityBadge severity="critical" className="mr-2">
                  +{diff.newReadable.length} newly readable
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.newReadable.join(", ")}
                </span>
              </div>
            )}
            {diff.noLongerReadable.length > 0 && (
              <div>
                <SeverityBadge severity="safe" className="mr-2">
                  -{diff.noLongerReadable.length} fixed (no longer readable)
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.noLongerReadable.join(", ")}
                </span>
              </div>
            )}
            {diff.newWritable.length > 0 && (
              <div>
                <SeverityBadge severity="critical" className="mr-2">
                  +{diff.newWritable.length} newly writable
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.newWritable.join(", ")}
                </span>
              </div>
            )}
            {diff.noLongerWritable.length > 0 && (
              <div>
                <SeverityBadge severity="safe" className="mr-2">
                  -{diff.noLongerWritable.length} fixed (no longer writable)
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.noLongerWritable.join(", ")}
                </span>
              </div>
            )}
            {diff.newPublicBuckets.length > 0 && (
              <div>
                <SeverityBadge severity="warning" className="mr-2">
                  +{diff.newPublicBuckets.length} new public bucket(s)
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.newPublicBuckets.join(", ")}
                </span>
              </div>
            )}
            {diff.newListableBuckets.length > 0 && (
              <div>
                <SeverityBadge severity="warning" className="mr-2">
                  +{diff.newListableBuckets.length} new listable bucket(s)
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.newListableBuckets.join(", ")}
                </span>
              </div>
            )}
            {diff.newAuthEnabled.length > 0 && (
              <div>
                <SeverityBadge severity="warning" className="mr-2">
                  +{diff.newAuthEnabled.length} auth feature(s) opened
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.newAuthEnabled.join(", ")}
                </span>
              </div>
            )}
            {diff.newFunctions.length > 0 && (
              <div>
                <SeverityBadge severity="info" className="mr-2">
                  +{diff.newFunctions.length} new function(s)
                </SeverityBadge>
                <span className="text-xs text-muted-foreground font-mono">
                  {diff.newFunctions.join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {phase === "complete" && diff && previousScan && !diffHasChanges(diff) && (
        <Card>
          <CardContent className="py-3 text-xs text-muted-foreground flex items-center gap-2">
            <History className="size-3.5" />
            No changes since previous scan ({new Date(previousScan.timestamp).toLocaleString()}).
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Results                                                             */}
      {/* ------------------------------------------------------------------- */}
      {(dbResults.length > 0 ||
        storageResults.length > 0 ||
        authResults.length > 0 ||
        functionResults.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4" />
                Detailed Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* ----------------------------------------------------------- */}
              {/* Recon Results                                                */}
              {/* ----------------------------------------------------------- */}
              <ResultSection
                title="Reconnaissance"
                icon={Database}
                count={
                  (schema?.tables.length ?? 0) +
                  (schema?.views.length ?? 0) +
                  (schema?.functions.length ?? 0)
                }
              >
                <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
                  <div className="text-center">
                    <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                      {schema?.tables.length ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Tables</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                      {schema?.views.length ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                      {schema?.functions.length ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Functions</div>
                  </div>
                </div>
              </ResultSection>

              {/* ----------------------------------------------------------- */}
              {/* Database RLS Results                                         */}
              {/* ----------------------------------------------------------- */}
              {dbResults.length > 0 && (
                <>
                  <Separator />
                  <ResultSection
                    title="Database RLS Testing"
                    icon={Database}
                    count={dbResults.length}
                  >
                    <DataTable<ScanResult>
                      columns={[
                        {
                          key: "name",
                          header: "Table",
                          align: "left",
                          className: "font-mono text-xs",
                          cell: (r) => (
                            <div className="min-w-0">
                              <span className="block truncate" title={r.name}>
                                {r.name}
                              </span>
                              {r.select === "allowed" &&
                                r.colCount != null && (
                                  <span className="block text-[10px] font-normal text-danger">
                                    {r.rowCount != null
                                      ? `${r.rowCount.toLocaleString()} rows`
                                      : "readable"}{" "}
                                    · {r.colCount} cols exposed
                                  </span>
                                )}
                            </div>
                          ),
                        },
                        {
                          key: "select",
                          header: "SELECT",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.select} />,
                        },
                        {
                          key: "insert",
                          header: "INSERT",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.insert} />,
                        },
                        {
                          key: "update",
                          header: "UPDATE",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.update} />,
                        },
                        {
                          key: "delete",
                          header: "DELETE",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.delete} />,
                        },
                      ]}
                      rows={dbResults}
                      getRowKey={(r) => r.name}
                      renderExpanded={(r) =>
                        r.select === "allowed" && r.sample !== undefined ? (
                          <div className="space-y-2">
                            {r.columns && r.columns.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {r.columns.map((c) => (
                                  <Badge
                                    key={c}
                                    variant={
                                      isSensitiveColumn(c) ? "critical" : "neutral"
                                    }
                                    className="font-mono text-[10px]"
                                    title={
                                      isSensitiveColumn(c)
                                        ? "Sensitive / PII column"
                                        : undefined
                                    }
                                  >
                                    {c}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div>
                              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                Exposed sample row
                              </p>
                              <JsonViewer
                                data={r.sample}
                                className="max-h-72"
                                padding="p-2"
                                copyable
                              />
                            </div>
                          </div>
                        ) : null
                      }
                    />
                  </ResultSection>
                </>
              )}

              {/* ----------------------------------------------------------- */}
              {/* Storage Results                                              */}
              {/* ----------------------------------------------------------- */}
              {storageResults.length > 0 && (
                <>
                  <Separator />
                  <ResultSection
                    title="Storage Scanning"
                    icon={HardDrive}
                    count={storageResults.length}
                  >
                    <DataTable<StorageResult>
                      columns={[
                        {
                          key: "name",
                          header: "Bucket",
                          align: "left",
                          className: "font-mono text-xs",
                          cell: (r) => (
                            <span className="block truncate" title={r.name}>
                              {r.name}
                            </span>
                          ),
                        },
                        {
                          key: "public",
                          header: "Public",
                          align: "center",
                          cell: (r) => (
                            <SeverityBadge
                              severity={r.public ? "warning" : "safe"}
                              dot={false}
                            >
                              {r.public ? "YES" : "NO"}
                            </SeverityBadge>
                          ),
                        },
                        {
                          key: "listable",
                          header: "Listable",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.listable} />,
                        },
                        {
                          key: "files",
                          header: "Files Found",
                          align: "right",
                          className: "text-xs text-muted-foreground",
                          cell: (r) =>
                            r.fileCount !== undefined ? r.fileCount : "-",
                        },
                      ]}
                      rows={storageResults}
                      getRowKey={(r) => r.name}
                    />
                  </ResultSection>
                </>
              )}

              {/* ----------------------------------------------------------- */}
              {/* Auth Results                                                 */}
              {/* ----------------------------------------------------------- */}
              {authResults.length > 0 && (
                <>
                  <Separator />
                  <ResultSection
                    title="Auth Probing"
                    icon={Key}
                    count={authResults.length}
                  >
                    <DataTable<AuthResult>
                      columns={[
                        {
                          key: "feature",
                          header: "Feature",
                          align: "left",
                          className: "text-xs font-medium",
                          cell: (r) => r.feature,
                        },
                        {
                          key: "status",
                          header: "Status",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.status} />,
                        },
                        {
                          key: "details",
                          header: "Details",
                          align: "left",
                          className: "text-xs text-muted-foreground",
                          cell: (r) => (
                            <div className="truncate" title={r.details ?? "-"}>
                              {r.details ?? "-"}
                            </div>
                          ),
                        },
                      ]}
                      rows={authResults}
                      getRowKey={(r) => r.feature}
                    />
                  </ResultSection>
                </>
              )}

              {/* ----------------------------------------------------------- */}
              {/* Edge Function Results                                        */}
              {/* ----------------------------------------------------------- */}
              {functionResults.length > 0 && (
                <>
                  <Separator />
                  <ResultSection
                    title="Edge Function Discovery"
                    icon={Zap}
                    count={functionResults.filter((r) => r.status === "found").length}
                  >
                    <DataTable<FunctionResult>
                      columns={[
                        {
                          key: "name",
                          header: "Name",
                          align: "left",
                          className: "font-mono text-xs",
                          cell: (r) => (
                            <span className="block truncate" title={r.name}>
                              {r.name}
                            </span>
                          ),
                        },
                        {
                          key: "status",
                          header: "Status",
                          align: "center",
                          cell: (r) => <StatusBadge status={r.status} />,
                        },
                      ]}
                      rows={functionResults}
                      getRowKey={(r) => r.name}
                    />
                  </ResultSection>
                </>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  )
}
