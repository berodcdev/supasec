"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  Play,
  Search,
  ShieldAlert,
  Waypoints,
} from "lucide-react"

import { useSupabase } from "@/lib/supabase-context"
import { toCurl, restHeaders } from "@/lib/curl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { JsonViewer } from "@/components/supasec/shared/json-viewer"
import { SectionHeader } from "@/components/supasec/shared/section-header"
import { ReticlePanel } from "@/components/supasec/shared/reticle-panel"
import { EmptyState } from "@/components/supasec/shared/empty-state"
import { CopyCurl } from "@/components/supasec/shared/copy-curl"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GqlField = {
  name: string
  type: string
  args?: { name: string; type: string }[]
}

type GqlType = {
  name: string
  kind: string
  fields: GqlField[]
  description?: string | null
}

type IntrospectionResult = {
  types: GqlType[]
  queryFields: GqlField[]
  mutationFields: GqlField[]
  subscriptionFields: GqlField[]
}

type SecurityFinding = {
  severity: "critical" | "warning" | "info"
  title: string
  detail: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTROSPECTION_QUERY = `{
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      name
      kind
      description
      fields {
        name
        type { name kind ofType { name kind ofType { name kind ofType { name kind } } } }
        args { name type { name kind ofType { name kind ofType { name kind } } } }
      }
    }
  }
}`

function graphqlUrl(projectUrl: string): string {
  return `${projectUrl.replace(/\/$/, "")}/graphql/v1`
}

function flattenType(t: { name?: string | null; kind?: string; ofType?: { name?: string | null; kind?: string; ofType?: { name?: string | null; kind?: string; ofType?: { name?: string | null; kind?: string } | null } | null } | null }): string {
  if (t.kind === "NON_NULL") return `${flattenType(t.ofType ?? {})}!`
  if (t.kind === "LIST") return `[${flattenType(t.ofType ?? {})}]`
  return t.name ?? "unknown"
}

function flattenArgType(a: { name: string; type: { name?: string | null; kind?: string; ofType?: { name?: string | null; kind?: string; ofType?: { name?: string | null; kind?: string } | null } | null } }): string {
  return flattenType(a.type)
}

function parseIntrospection(data: unknown): IntrospectionResult {
  const schema = (data as { __schema: unknown }).__schema as {
    queryType?: { name: string } | null
    mutationType?: { name: string } | null
    subscriptionType?: { name: string } | null
    types: {
      name: string
      kind: string
      description?: string | null
      fields?: {
        name: string
        type: { name?: string | null; kind?: string; ofType?: unknown }
        args?: { name: string; type: unknown }[]
      }[] | null
    }[]
  }

  const queryTypeName = schema.queryType?.name ?? "Query"
  const mutationTypeName = schema.mutationType?.name ?? "Mutation"
  const subscriptionTypeName = schema.subscriptionType?.name ?? "Subscription"

  const types: GqlType[] = []
  let queryFields: GqlField[] = []
  let mutationFields: GqlField[] = []
  let subscriptionFields: GqlField[] = []

  for (const t of schema.types) {
    if (t.name.startsWith("__")) continue

    const fields: GqlField[] = (t.fields ?? []).map((f) => ({
      name: f.name,
      type: flattenType(f.type as Parameters<typeof flattenType>[0]),
      args: (f.args ?? []).map((a) => ({
        name: a.name,
        type: flattenArgType(a as Parameters<typeof flattenArgType>[0]),
      })),
    }))

    if (t.name === queryTypeName) {
      queryFields = fields
    } else if (t.name === mutationTypeName) {
      mutationFields = fields
    } else if (t.name === subscriptionTypeName) {
      subscriptionFields = fields
    }

    if (!["Query", "Mutation", "Subscription", "PageInfo", "Cursor"].includes(t.name) && t.kind !== "SCALAR" && t.kind !== "ENUM" && t.kind !== "INPUT_OBJECT") {
      types.push({ name: t.name, kind: t.kind, fields, description: t.description })
    }
  }

  return { types, queryFields, mutationFields, subscriptionFields }
}

function analyzeSchema(result: IntrospectionResult): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  if (result.queryFields.length > 0) {
    findings.push({
      severity: "critical",
      title: "GraphQL introspection enabled",
      detail: `The /graphql/v1 endpoint responds to introspection queries and exposes ${result.types.length} types, ${result.queryFields.length} query fields, and ${result.mutationFields.length} mutation fields. This reveals the full database schema to any holder of the API key.`,
    })
  }

  const collectionQueries = result.queryFields.filter(
    (f) => f.name.endsWith("Collection") || f.name.endsWith("collection"),
  )
  if (collectionQueries.length > 0) {
    findings.push({
      severity: "warning",
      title: `${collectionQueries.length} table collection(s) queryable`,
      detail: `Collections: ${collectionQueries.map((q) => q.name).join(", ")}. Each maps to a table and can be enumerated unless RLS blocks it.`,
    })
  }

  const insertMutations = result.mutationFields.filter(
    (f) => f.name.startsWith("insertInto"),
  )
  const updateMutations = result.mutationFields.filter(
    (f) => f.name.startsWith("update"),
  )
  const deleteMutations = result.mutationFields.filter(
    (f) => f.name.startsWith("deleteFrom"),
  )

  if (insertMutations.length > 0) {
    findings.push({
      severity: "critical",
      title: `${insertMutations.length} INSERT mutation(s) exposed`,
      detail: `Tables writable via GraphQL: ${insertMutations.map((m) => m.name.replace("insertInto", "").replace("Collection", "")).join(", ")}. Verify RLS blocks unauthorized writes.`,
    })
  }
  if (deleteMutations.length > 0) {
    findings.push({
      severity: "critical",
      title: `${deleteMutations.length} DELETE mutation(s) exposed`,
      detail: `Tables deletable via GraphQL: ${deleteMutations.map((m) => m.name.replace("deleteFrom", "").replace("Collection", "")).join(", ")}. Verify RLS blocks unauthorized deletes.`,
    })
  }
  if (updateMutations.length > 0) {
    findings.push({
      severity: "warning",
      title: `${updateMutations.length} UPDATE mutation(s) exposed`,
      detail: `Tables updatable via GraphQL: ${updateMutations.map((m) => m.name.replace("update", "").replace("Collection", "")).join(", ")}.`,
    })
  }

  const nodeTypes = result.types.filter((t) =>
    t.fields.some((f) => f.name === "nodeId"),
  )
  if (nodeTypes.length > 0) {
    findings.push({
      severity: "info",
      title: `${nodeTypes.length} Relay node type(s) with nodeId`,
      detail: `Types with nodeId (global ID): ${nodeTypes.map((t) => t.name).join(", ")}. Node IDs encode table + primary key — they can be decoded to enumerate records.`,
    })
  }

  return findings
}

function buildSampleQuery(fields: GqlField[]): string {
  if (fields.length === 0) return "# No query fields found"
  const first = fields[0]
  const isCollection = first.name.endsWith("Collection")
  if (isCollection) {
    return `{
  ${first.name}(first: 5) {
    edges {
      node {
        nodeId
      }
    }
  }
}`
  }
  return `{
  ${first.name} {
    __typename
  }
}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FindingCard({ finding }: { finding: SecurityFinding }) {
  const colors = {
    critical: "text-danger border-danger/30 bg-danger/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    info: "text-info border-info/30 bg-info/5",
  }
  const icons = {
    critical: ShieldAlert,
    warning: AlertTriangle,
    info: Search,
  }
  const Icon = icons[finding.severity]

  return (
    <div className={`rounded-sm border p-3 ${colors[finding.severity]}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={finding.severity === "critical" ? "critical" : finding.severity === "warning" ? "warning" : "info"} className="text-[9px]">
              {finding.severity.toUpperCase()}
            </Badge>
            <span className="font-mono text-xs font-medium">{finding.title}</span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-80">{finding.detail}</p>
        </div>
      </div>
    </div>
  )
}

function TypeCard({
  type,
  onQueryField,
}: {
  type: GqlType
  onQueryField: (query: string) => void
}) {
  const [open, setOpen] = useState(false)
  const Chevron = open ? ChevronDown : ChevronRight

  const isNode = type.fields.some((f) => f.name === "nodeId")

  return (
    <div className="rounded-sm border border-border/60 bg-card/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30"
      >
        <Chevron className="size-3 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs font-medium text-foreground">{type.name}</span>
        <Badge variant="neutral" className="text-[8px]">{type.kind}</Badge>
        {isNode && (
          <Badge variant="info" className="text-[8px]">NODE</Badge>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {type.fields.length} fields
        </span>
      </button>

      {open && (
        <div className="border-t border-border/40 px-3 py-2">
          <div className="space-y-1">
            {type.fields.map((f) => (
              <div key={f.name} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-primary">{f.name}</span>
                <span className="text-muted-foreground">:</span>
                <span className="text-warning">{f.type}</span>
                {f.args && f.args.length > 0 && (
                  <span className="text-muted-foreground/60">
                    ({f.args.map((a) => `${a.name}: ${a.type}`).join(", ")})
                  </span>
                )}
              </div>
            ))}
          </div>
          {isNode && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-6 gap-1 font-mono text-[10px] text-primary"
              onClick={() => {
                const collName = type.name.endsWith("Connection")
                  ? type.name
                  : `${type.name[0].toLowerCase()}${type.name.slice(1)}Collection`
                const fieldNames = type.fields
                  .filter((f) => f.name !== "nodeId" && !f.type.includes("Connection"))
                  .slice(0, 5)
                  .map((f) => `        ${f.name}`)
                  .join("\n")
                onQueryField(`{
  ${collName}(first: 3) {
    edges {
      node {
        nodeId
${fieldNames}
      }
    }
  }
}`)
              }}
            >
              <Play className="size-2.5" /> Query this type
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GraphQLExplorer() {
  const { projectUrl, apiKey, addLog, recordRequest } = useSupabase()

  const [loading, setLoading] = useState(false)
  const [schema, setSchema] = useState<IntrospectionResult | null>(null)
  const [findings, setFindings] = useState<SecurityFinding[]>([])
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState("")

  const [query, setQuery] = useState("")
  const [queryResult, setQueryResult] = useState<Record<string, unknown> | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [querying, setQuerying] = useState(false)

  const endpoint = useMemo(() => graphqlUrl(projectUrl), [projectUrl])

  const headers = useMemo(
    () => ({
      ...restHeaders(apiKey),
      "Content-Type": "application/json",
    }),
    [apiKey],
  )

  // -- Introspect -----------------------------------------------------------

  const runIntrospection = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSchema(null)
    setFindings([])
    addLog("info", "GraphQL: running introspection query on /graphql/v1")

    try {
      const url = endpoint
      const body = JSON.stringify({ query: INTROSPECTION_QUERY })

      recordRequest({
        label: "GraphQL introspection",
        method: "POST",
        url,
        headers,
        body,
      })

      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        if (res.status === 404) {
          setError("pg_graphql extension not enabled — /graphql/v1 returned 404. Enable it in Supabase Dashboard → Database → Extensions.")
          addLog("warning", "GraphQL: endpoint not found (404)")
        } else {
          setError(`HTTP ${res.status}: ${text.slice(0, 200)}`)
          addLog("error", `GraphQL: introspection failed — ${res.status}`)
        }
        return
      }

      const json = await res.json()

      if (json.errors) {
        setError(`GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join("; ")}`)
        addLog("error", "GraphQL: introspection returned errors")
        return
      }

      const parsed = parseIntrospection(json.data)
      setSchema(parsed)

      const secFindings = analyzeSchema(parsed)
      setFindings(secFindings)

      addLog(
        "success",
        `GraphQL: introspection OK — ${parsed.types.length} types, ${parsed.queryFields.length} queries, ${parsed.mutationFields.length} mutations`,
      )

      if (parsed.queryFields.length > 0 && !query) {
        setQuery(buildSampleQuery(parsed.queryFields))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      addLog("error", `GraphQL: introspection error — ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [endpoint, headers, addLog, recordRequest, query])

  // -- Run query ------------------------------------------------------------

  const runQuery = useCallback(async () => {
    if (!query.trim()) return
    setQuerying(true)
    setQueryResult(null)
    setQueryError(null)

    try {
      const url = endpoint
      const body = JSON.stringify({ query: query.trim() })

      recordRequest({
        label: "GraphQL query",
        method: "POST",
        url,
        headers,
        body,
      })

      addLog("info", `GraphQL: executing query`)

      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
      })

      const json = await res.json()

      if (json.errors) {
        setQueryError(json.errors.map((e: { message: string }) => e.message).join("\n"))
        addLog("warning", "GraphQL: query returned errors")
      }

      if (json.data) {
        setQueryResult(json.data as Record<string, unknown>)
        addLog("success", "GraphQL: query returned data")
      } else if (!json.errors) {
        setQueryResult(json as Record<string, unknown>)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setQueryError(msg)
      addLog("error", `GraphQL: query error — ${msg}`)
    } finally {
      setQuerying(false)
    }
  }, [query, endpoint, headers, addLog, recordRequest])

  // -- Curl for current query -----------------------------------------------

  const curlCmd = useMemo(() => {
    if (!query.trim()) return ""
    return toCurl({
      method: "POST",
      url: endpoint,
      headers,
      body: JSON.stringify({ query: query.trim() }),
    })
  }, [query, endpoint, headers])

  // -- Filtered types -------------------------------------------------------

  const filteredTypes = useMemo(() => {
    if (!schema) return []
    if (!typeFilter.trim()) return schema.types
    const q = typeFilter.toLowerCase()
    return schema.types.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.fields.some((f) => f.name.toLowerCase().includes(q)),
    )
  }, [schema, typeFilter])

  // -- Render ---------------------------------------------------------------

  return (
    <div className="space-y-4 p-4">
      <SectionHeader
        icon={Waypoints}
        eyebrow="pg_graphql"
        title="GraphQL Explorer"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={runIntrospection}
              disabled={loading}
              className="h-7 gap-1.5 font-mono text-xs"
            >
              {loading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <GitBranch className="size-3" />
              )}
              {loading ? "Probing…" : "Introspect"}
            </Button>
          </div>
        }
      />

      {/* Error */}
      {error && (
        <ReticlePanel label="GQL·ERR" active>
          <div className="p-3 text-xs text-danger">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          </div>
        </ReticlePanel>
      )}

      {/* Empty state */}
      {!schema && !error && !loading && (
        <EmptyState
          icon={Waypoints}
          title="GraphQL endpoint not probed yet"
          description="Run introspection to discover the pg_graphql schema exposed at /graphql/v1. This reveals tables, relationships, and mutations that may bypass REST-level controls."
        />
      )}

      {/* Security findings */}
      {findings.length > 0 && (
        <ReticlePanel label="GQL·FINDINGS" active>
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-3.5 text-primary" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
                Security Findings
              </span>
              <Badge variant="critical" className="text-[9px]">
                {findings.filter((f) => f.severity === "critical").length} CRITICAL
              </Badge>
              <Badge variant="warning" className="text-[9px]">
                {findings.filter((f) => f.severity === "warning").length} WARN
              </Badge>
            </div>
            <div className="space-y-1.5">
              {findings.map((f, i) => (
                <FindingCard key={i} finding={f} />
              ))}
            </div>
          </div>
        </ReticlePanel>
      )}

      {/* Schema browser + Query editor side by side */}
      {schema && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Schema browser */}
          <ReticlePanel label="GQL·SCHEMA">
            <div className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
                  Exposed Types
                </span>
                <Badge variant="neutral" className="text-[9px]">
                  {schema.types.length}
                </Badge>
              </div>

              {/* Stats bar */}
              <div className="flex flex-wrap gap-2">
                <div className="rounded-sm border border-border/60 bg-card/40 px-2 py-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Queries</span>
                  <p className="font-mono text-sm font-semibold text-primary">{schema.queryFields.length}</p>
                </div>
                <div className="rounded-sm border border-border/60 bg-card/40 px-2 py-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Mutations</span>
                  <p className="font-mono text-sm font-semibold text-danger">{schema.mutationFields.length}</p>
                </div>
                <div className="rounded-sm border border-border/60 bg-card/40 px-2 py-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Subscriptions</span>
                  <p className="font-mono text-sm font-semibold text-info">{schema.subscriptionFields.length}</p>
                </div>
                <div className="rounded-sm border border-border/60 bg-card/40 px-2 py-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Types</span>
                  <p className="font-mono text-sm font-semibold text-foreground">{schema.types.length}</p>
                </div>
              </div>

              {/* Filter */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter types or fields…"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-7 pl-7 font-mono text-xs"
                />
              </div>

              {/* Type list */}
              <div className="max-h-[500px] space-y-1.5 overflow-y-auto">
                {filteredTypes.map((t) => (
                  <TypeCard
                    key={t.name}
                    type={t}
                    onQueryField={(q) => setQuery(q)}
                  />
                ))}
                {filteredTypes.length === 0 && (
                  <p className="py-4 text-center font-mono text-xs text-muted-foreground">
                    No types match filter
                  </p>
                )}
              </div>
            </div>
          </ReticlePanel>

          {/* Query editor */}
          <ReticlePanel label="GQL·QUERY" active={querying}>
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
                  Query Editor
                </span>
                <div className="flex items-center gap-1.5">
                  {curlCmd && <CopyCurl build={() => curlCmd} />}
                  <Button
                    size="sm"
                    onClick={runQuery}
                    disabled={querying || !query.trim()}
                    className="h-6 gap-1 font-mono text-[10px]"
                  >
                    {querying ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <Play className="size-2.5" />
                    )}
                    Execute
                  </Button>
                </div>
              </div>

              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={10}
                spellCheck={false}
                className="font-mono text-xs leading-relaxed"
                placeholder="{ __typename }"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    runQuery()
                  }
                }}
              />

              <p className="font-mono text-[9px] text-muted-foreground/60">
                ⌘+Enter to execute
              </p>

              {/* Query error */}
              {queryError && (
                <Card className="border-danger/30 bg-danger/5">
                  <CardContent className="p-3">
                    <p className="font-mono text-xs text-danger">{queryError}</p>
                  </CardContent>
                </Card>
              )}

              {/* Query result */}
              {queryResult && (
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Response
                  </span>
                  <JsonViewer data={queryResult} copyable className="max-h-[400px]" />
                </div>
              )}
            </div>
          </ReticlePanel>
        </div>
      )}
    </div>
  )
}
