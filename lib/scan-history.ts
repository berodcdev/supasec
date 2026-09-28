// Persisted AutoPwn scan results — keyed per Supabase project URL — used to
// power diff views across runs.

export type AccessStatus = "allowed" | "denied" | "error" | "empty"
export type WriteStatus = AccessStatus | "skipped"

export type StoredDbResult = {
  name: string
  select?: AccessStatus
  insert?: WriteStatus
  update?: WriteStatus
  delete?: WriteStatus
  details?: string
  /** Exact row count when the table exposed data (null if it couldn't be read). */
  rowCount?: number | null
  /** Number of columns in the exposed row. */
  colCount?: number
  /** Column names harvested from the exposed row. */
  columns?: string[]
  /** First exposed row — what actually leaked. */
  sample?: unknown
}

export type StoredStorageResult = {
  name: string
  public: boolean
  listable: AccessStatus
  fileCount?: number
}

export type StoredAuthResult = {
  feature: string
  status: "enabled" | "disabled" | "error"
  details?: string
}

export type StoredFunctionResult = {
  name: string
  status: "found" | "not_found" | "error"
  statusCode?: number
}

export type StoredRealtimeResult = {
  table: string
  subscribed: boolean
  error?: string
}

export type StoredGraphqlResult = {
  available: boolean
  types?: number
  queries?: number
  mutations?: number
  insertMutations?: string[]
  deleteMutations?: string[]
  error?: string
}

export type ScanRecord = {
  schemaVersion: 1
  projectUrl: string
  keyType: string
  timestamp: string // ISO
  db: StoredDbResult[]
  storage: StoredStorageResult[]
  auth: StoredAuthResult[]
  functions: StoredFunctionResult[]
  realtime?: StoredRealtimeResult[]
  graphql?: StoredGraphqlResult
  aiAnalysis?: unknown
}

export type ScanDiff = {
  newReadable: string[]
  noLongerReadable: string[]
  newWritable: string[]
  noLongerWritable: string[]
  newPublicBuckets: string[]
  newListableBuckets: string[]
  newAuthEnabled: string[]
  newFunctions: string[]
}

const STORAGE_PREFIX = "supasec-scan:"
const HISTORY_LIMIT = 5

function projectKey(projectUrl: string): string {
  return STORAGE_PREFIX + projectUrl
}

/** Most recent scan, if any. */
export function loadLastScan(projectUrl: string): ScanRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(projectKey(projectUrl))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ScanRecord[] | ScanRecord
    if (Array.isArray(parsed)) return parsed[0] ?? null
    return parsed
  } catch {
    return null
  }
}

/** All persisted scans for a project, newest first (up to HISTORY_LIMIT). */
export function loadScanHistory(projectUrl: string): ScanRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(projectKey(projectUrl))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as ScanRecord[]
    if (parsed && typeof parsed === "object") return [parsed as ScanRecord]
    return []
  } catch {
    return []
  }
}

/** Save a new scan and trim history to the last HISTORY_LIMIT entries. */
export function saveScan(record: ScanRecord): void {
  if (typeof window === "undefined") return
  try {
    const existingRaw = localStorage.getItem(projectKey(record.projectUrl))
    let history: ScanRecord[] = []
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw)
        if (Array.isArray(parsed)) history = parsed
        else if (parsed && typeof parsed === "object") history = [parsed as ScanRecord]
      } catch {
        history = []
      }
    }
    history.unshift(record)
    history = history.slice(0, HISTORY_LIMIT)
    localStorage.setItem(projectKey(record.projectUrl), JSON.stringify(history))
  } catch {
    // localStorage may be unavailable — silently ignore
  }
}

/** Attach an AI analysis result to the most recent scan (or a specific timestamp). */
export function saveAIAnalysis(projectUrl: string, analysis: unknown, timestamp?: string): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(projectKey(projectUrl))
    if (!raw) return
    const parsed = JSON.parse(raw)
    const history: ScanRecord[] = Array.isArray(parsed) ? parsed : [parsed as ScanRecord]
    const target = timestamp
      ? history.find((r) => r.timestamp === timestamp)
      : history[0]
    if (target) {
      target.aiAnalysis = analysis
      localStorage.setItem(projectKey(projectUrl), JSON.stringify(history))
    }
  } catch {
    // ignore
  }
}

/** Load the AI analysis attached to a scan, if any. */
export function loadAIAnalysis(projectUrl: string, timestamp?: string): unknown | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(projectKey(projectUrl))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const history: ScanRecord[] = Array.isArray(parsed) ? parsed : [parsed as ScanRecord]
    const target = timestamp
      ? history.find((r) => r.timestamp === timestamp)
      : history[0]
    return target?.aiAnalysis ?? null
  } catch {
    return null
  }
}

export function clearScanHistory(projectUrl: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(projectKey(projectUrl))
  } catch {
    // ignore
  }
}

export function diffScans(prev: ScanRecord | null, curr: ScanRecord): ScanDiff {
  if (!prev) {
    return {
      newReadable: [],
      noLongerReadable: [],
      newWritable: [],
      noLongerWritable: [],
      newPublicBuckets: [],
      newListableBuckets: [],
      newAuthEnabled: [],
      newFunctions: [],
    }
  }

  const prevReadable = new Set(prev.db.filter((r) => r.select === "allowed").map((r) => r.name))
  const currReadable = new Set(curr.db.filter((r) => r.select === "allowed").map((r) => r.name))

  const prevWritable = new Set(prev.db.filter((r) => r.insert === "allowed").map((r) => r.name))
  const currWritable = new Set(curr.db.filter((r) => r.insert === "allowed").map((r) => r.name))

  const prevPublic = new Set(prev.storage.filter((r) => r.public).map((r) => r.name))
  const currPublic = new Set(curr.storage.filter((r) => r.public).map((r) => r.name))

  const prevListable = new Set(prev.storage.filter((r) => r.listable === "allowed").map((r) => r.name))
  const currListable = new Set(curr.storage.filter((r) => r.listable === "allowed").map((r) => r.name))

  const prevAuth = new Set(prev.auth.filter((r) => r.status === "enabled").map((r) => r.feature))
  const currAuth = new Set(curr.auth.filter((r) => r.status === "enabled").map((r) => r.feature))

  const prevFns = new Set(prev.functions.filter((r) => r.status === "found").map((r) => r.name))
  const currFns = new Set(curr.functions.filter((r) => r.status === "found").map((r) => r.name))

  const minus = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).sort()

  return {
    newReadable: minus(currReadable, prevReadable),
    noLongerReadable: minus(prevReadable, currReadable),
    newWritable: minus(currWritable, prevWritable),
    noLongerWritable: minus(prevWritable, currWritable),
    newPublicBuckets: minus(currPublic, prevPublic),
    newListableBuckets: minus(currListable, prevListable),
    newAuthEnabled: minus(currAuth, prevAuth),
    newFunctions: minus(currFns, prevFns),
  }
}

export function diffHasChanges(d: ScanDiff): boolean {
  return (
    d.newReadable.length > 0 ||
    d.noLongerReadable.length > 0 ||
    d.newWritable.length > 0 ||
    d.noLongerWritable.length > 0 ||
    d.newPublicBuckets.length > 0 ||
    d.newListableBuckets.length > 0 ||
    d.newAuthEnabled.length > 0 ||
    d.newFunctions.length > 0
  )
}
