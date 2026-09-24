"use client"

import { uuid } from "@/lib/utils"

import { useCallback, useState } from "react"
import { Plus, X, Play, Zap, Search, Loader2 } from "lucide-react"

import { useSupabase, FUNCTION_WORDLIST } from "@/lib/supabase-context"
import { scanJsonForSecrets } from "@/lib/sensitive"
import { toCurl, functionsUrl, restHeaders } from "@/lib/curl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { JsonViewer } from "@/components/supabase-pwn/shared/json-viewer"
import { SectionHeader } from "@/components/supabase-pwn/shared/section-header"
import { EmptyState } from "@/components/supabase-pwn/shared/empty-state"
import { CopyCurl } from "@/components/supabase-pwn/shared/copy-curl"
import { ResultSkeleton } from "@/components/supabase-pwn/shared/result-skeleton"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HeaderRow = {
  id: string
  key: string
  value: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createHeaderRow(): HeaderRow {
  return {
    id: uuid(),
    key: "",
    value: "",
  }
}

// ---------------------------------------------------------------------------
// EdgeFunctions Component
// ---------------------------------------------------------------------------

export function EdgeFunctions() {
  const { client, addLog, projectUrl, apiKey, recordRequest } = useSupabase()

  // -- State ----------------------------------------------------------------
  const [functionName, setFunctionName] = useState("")
  const [bodyJson, setBodyJson] = useState("")
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [found, setFound] = useState<string[]>([])

  // -- Header row management ------------------------------------------------

  const addHeaderRow = useCallback(() => {
    setHeaderRows((prev) => [...prev, createHeaderRow()])
  }, [])

  const removeHeaderRow = useCallback((id: string) => {
    setHeaderRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateHeaderRow = useCallback(
    (id: string, field: "key" | "value", value: string) => {
      setHeaderRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
      )
    },
    [],
  )

  // -- Invoke ---------------------------------------------------------------

  const handleInvoke = useCallback(async () => {
    if (!client) return

    const name = functionName.trim()
    if (!name) {
      addLog("warning", "Function name is required")
      return
    }

    // Parse body
    let body: unknown = undefined
    if (bodyJson.trim()) {
      try {
        body = JSON.parse(bodyJson)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Invalid JSON in request body"
        addLog("error", `Invalid JSON body: ${msg}`)
        return
      }
    }

    // Build headers object from key/value rows
    const headers = Object.fromEntries(
      headerRows.filter((r) => r.key).map((r) => [r.key, r.value]),
    )

    setLoading(true)
    setResult(null)

    try {
      addLog("info", `Invoking edge function: ${name}`, {
        body,
        headers,
      })
      recordRequest({
        label: `edge ${name}`,
        method: "POST",
        url: functionsUrl(projectUrl, name),
        headers: { ...restHeaders(apiKey), "content-type": "application/json", ...headers },
        body: bodyJson.trim() || "{}",
      })

      const { data, error } = await client.functions.invoke(name, {
        body: body !== undefined ? JSON.parse(JSON.stringify(body)) : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })

      if (error) {
        addLog("error", `Edge function error: ${error.message}`, error)
        setResult(JSON.stringify({ error: error.message }, null, 2))
      } else {
        addLog("success", `Edge function "${name}" responded`, data)
        // Handle different response types
        let displayData: unknown
        if (data instanceof Blob) {
          const text = await data.text()
          try {
            displayData = JSON.parse(text)
          } catch {
            displayData = text
          }
        } else {
          displayData = data
        }
        setResult(JSON.stringify(displayData, null, 2))
        const { kinds, jwts } = scanJsonForSecrets(displayData)
        if (kinds.length > 0 || jwts.length > 0) {
          const parts: string[] = []
          if (kinds.length > 0) parts.push(`secrets: ${kinds.join(", ")}`)
          if (jwts.length > 0) parts.push(`JWT(s): ${jwts.join(" | ")}`)
          addLog(
            "warning",
            `🔎 CLUE — edge function "${name}" response — ${parts.join("; ")}`,
            { function: name },
          )
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      addLog("error", `Edge function exception: ${msg}`, err)
      setResult(JSON.stringify({ error: msg }, null, 2))
    } finally {
      setLoading(false)
    }
  }, [client, functionName, bodyJson, headerRows, addLog, recordRequest, projectUrl, apiKey])

  // -- Discover (bruteforce function names) ---------------------------------

  const handleDiscover = useCallback(async () => {
    if (!projectUrl || !apiKey) return
    setDiscovering(true)
    setFound([])
    try {
      addLog("info", `Probing ${FUNCTION_WORDLIST.length} edge function names…`)
      const hits: string[] = []
      const batchSize = 10
      for (let i = 0; i < FUNCTION_WORDLIST.length; i += batchSize) {
        const batch = FUNCTION_WORDLIST.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(async (name) => {
            try {
              const res = await fetch(functionsUrl(projectUrl, name), {
                method: "POST",
                headers: { ...restHeaders(apiKey), "content-type": "application/json" },
                body: "{}",
              })
              return res.status === 404 ? null : name
            } catch {
              return name // CORS/network usually means a deployed function exists
            }
          }),
        )
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) hits.push(r.value)
        }
      }
      setFound(hits)
      addLog(
        hits.length > 0 ? "success" : "info",
        `Edge function discovery: ${hits.length} found${hits.length ? ` — ${hits.join(", ")}` : ""}`,
        hits,
      )
    } finally {
      setDiscovering(false)
    }
  }, [projectUrl, apiKey, addLog])

  // -- Build a curl for the current invoke ----------------------------------

  const buildInvokeCurl = useCallback(() => {
    const custom = Object.fromEntries(
      headerRows.filter((r) => r.key).map((r) => [r.key, r.value]),
    )
    return toCurl({
      method: "POST",
      url: functionsUrl(projectUrl, functionName.trim() || "<function>"),
      headers: { ...restHeaders(apiKey), "content-type": "application/json", ...custom },
      body: bodyJson.trim() || "{}",
    })
  }, [projectUrl, apiKey, functionName, bodyJson, headerRows])

  // =========================================================================
  // Render
  // =========================================================================

  if (!client) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="Connect to a Supabase project first." />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionHeader icon={Zap} eyebrow="EDGE" title="Invoke Supabase Edge Functions" />

      {/* Function Name */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="fn-name">Function Name</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscover}
                disabled={discovering}
              >
                {discovering ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                {discovering ? "Discovering…" : "Discover"}
              </Button>
            </div>
            <Input
              id="fn-name"
              placeholder="e.g. hello-world"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
            />
            {found.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {found.map((f) => (
                  <Badge
                    key={f}
                    variant="secondary"
                    className="cursor-pointer font-mono text-[10px]"
                    onClick={() => setFunctionName(f)}
                    title="Use this function"
                  >
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Request Body */}
          <div className="space-y-1.5">
            <Label htmlFor="fn-body">Request Body (JSON)</Label>
            <Textarea
              id="fn-body"
              className="font-mono text-sm min-h-24"
              placeholder={'{"key": "value"}'}
              value={bodyJson}
              onChange={(e) => setBodyJson(e.target.value)}
            />
          </div>

          {/* Custom Headers */}
          <div className="space-y-2">
            <Label>Custom Headers</Label>
            {headerRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Header name"
                  value={row.key}
                  onChange={(e) =>
                    updateHeaderRow(row.id, "key", e.target.value)
                  }
                />
                <Input
                  className="flex-1"
                  placeholder="Header value"
                  value={row.value}
                  onChange={(e) =>
                    updateHeaderRow(row.id, "value", e.target.value)
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHeaderRow(row.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHeaderRow}>
              <Plus className="h-4 w-4 mr-1" />
              Add Header
            </Button>
          </div>

          {/* Invoke Button + curl */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleInvoke}
              disabled={loading || !functionName.trim()}
            >
              {loading ? (
                <Play className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              {loading ? "Invoking..." : "Invoke"}
            </Button>
            <CopyCurl build={buildInvokeCurl} disabled={!functionName.trim()} />
          </div>
        </CardContent>
      </Card>

      {/* Response Display */}
      {loading && <ResultSkeleton label="invoking function" />}
      {result !== null && (
        <Card>
          <CardContent className="p-3">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Response
            </Label>
            <JsonViewer json={result} className="max-h-96" copyable />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
