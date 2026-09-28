"use client"

import * as React from "react"
import { Check, History, Play, Terminal, Trash2 } from "lucide-react"

import { useSupabase } from "@/lib/supabase-context"
import { toCurl, type RequestRecord } from "@/lib/curl"
import { scanJsonForSecrets } from "@/lib/sensitive"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// History of executed read requests (SELECT / RPC / edge invoke) with one-click
// replay and copy-as-curl. Mutating ops are intentionally not recorded, so
// nothing here can re-run a write.
function RequestHistoryButton() {
  const { requestHistory, clearHistory, addLog } = useSupabase()
  const [replaying, setReplaying] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)

  const replay = React.useCallback(
    async (rec: RequestRecord) => {
      setReplaying(rec.id)
      try {
        const res = await fetch(rec.url, {
          method: rec.method,
          headers: rec.headers,
          body: rec.method === "GET" ? undefined : rec.body,
        })
        const text = await res.text()
        let data: unknown = text
        try {
          data = JSON.parse(text)
        } catch {
          /* keep text */
        }
        addLog(
          res.ok ? "success" : "error",
          `Replay ${rec.label} → HTTP ${res.status}`,
          data,
        )
        const scan = scanJsonForSecrets(data)
        if (scan.kinds.length > 0 || scan.jwts.length > 0) {
          const parts: string[] = []
          if (scan.kinds.length > 0) parts.push(`secrets: ${scan.kinds.join(", ")}`)
          if (scan.jwts.length > 0) parts.push(`JWT(s): ${scan.jwts.join(" | ")}`)
          addLog("warning", `🔎 CLUE — replay ${rec.label} — ${parts.join("; ")}`)
        }
      } catch (e) {
        addLog(
          "error",
          `Replay ${rec.label} failed: ${e instanceof Error ? e.message : "error"}`,
        )
      } finally {
        setReplaying(null)
      }
    },
    [addLog],
  )

  const copy = React.useCallback(async (rec: RequestRecord) => {
    try {
      await navigator.clipboard.writeText(toCurl(rec))
      setCopied(rec.id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" title="Request history & replay">
          <History className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Request history</span>
            {requestHistory.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {requestHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No requests yet. Run a SELECT, RPC or edge invoke and it shows up here.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-auto">
            {requestHistory.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-2 rounded-sm border border-border p-2"
              >
                <Badge variant="neutral" className="shrink-0 font-mono text-[10px]">
                  {rec.method}
                </Badge>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs"
                  title={rec.url}
                >
                  {rec.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Copy as curl"
                  onClick={() => copy(rec)}
                >
                  {copied === rec.id ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Terminal className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={replaying === rec.id}
                  onClick={() => replay(rec)}
                >
                  <Play className="size-3.5" />
                  Replay
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { RequestHistoryButton }
