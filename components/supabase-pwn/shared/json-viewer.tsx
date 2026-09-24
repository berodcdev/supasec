"use client"

import * as React from "react"
import { Check, ChevronRight, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// JsonViewer — collapsible, syntax-highlighted JSON viewer.
// Nodes (objects/arrays) can be expanded/collapsed by clicking the toggle.
// Primitives are rendered inline with semantic coloring.
// ---------------------------------------------------------------------------

const COLORS = {
  key: "var(--color-primary)",
  string: "var(--color-success)",
  number: "var(--color-warning)",
  boolean: "var(--color-warning)",
  null: "var(--color-info)",
  punctuation: "var(--color-muted-foreground)",
}

function JsonString({ value }: { value: string }) {
  return <span style={{ color: COLORS.string }}>&quot;{value}&quot;</span>
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span style={{ color: COLORS.null }}>null</span>
  if (typeof value === "boolean")
    return <span style={{ color: COLORS.boolean }}>{value ? "true" : "false"}</span>
  if (typeof value === "number")
    return <span style={{ color: COLORS.number }}>{String(value)}</span>
  if (typeof value === "string") return <JsonString value={value} />
  return <span>{String(value)}</span>
}

function Punct({ children }: { children: React.ReactNode }) {
  return <span style={{ color: COLORS.punctuation }}>{children}</span>
}

function Key({ name }: { name: string }) {
  return <span style={{ color: COLORS.key }}>&quot;{name}&quot;</span>
}

function JsonNode({
  value,
  name,
  depth,
  defaultCollapsed,
  last,
}: {
  value: unknown
  name?: string
  depth: number
  defaultCollapsed: boolean
  last: boolean
}) {
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isExpandable = isObject || isArray
  const [collapsed, setCollapsed] = React.useState(
    defaultCollapsed && depth > 0,
  )

  const indent = depth * 16
  const comma = last ? "" : ","

  if (!isExpandable) {
    return (
      <div style={{ paddingLeft: indent }} className="leading-relaxed">
        {name !== undefined && (
          <>
            <Key name={name} />
            <Punct>: </Punct>
          </>
        )}
        <JsonPrimitive value={value} />
        <Punct>{comma}</Punct>
      </div>
    )
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => ({ key: String(i), value: v, showKey: false }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        value: v,
        showKey: true,
      }))

  const openBrace = isArray ? "[" : "{"
  const closeBrace = isArray ? "]" : "}"
  const count = entries.length

  if (collapsed) {
    return (
      <div style={{ paddingLeft: indent }} className="leading-relaxed">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mr-1 inline-flex items-center align-middle text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-3" />
        </button>
        {name !== undefined && (
          <>
            <Key name={name} />
            <Punct>: </Punct>
          </>
        )}
        <Punct>{openBrace}</Punct>
        <span className="text-muted-foreground/60 text-[10px]">
          {" "}{count} {count === 1 ? "item" : "items"}{" "}
        </span>
        <Punct>{closeBrace}{comma}</Punct>
      </div>
    )
  }

  return (
    <div>
      <div style={{ paddingLeft: indent }} className="leading-relaxed">
        {isExpandable && depth > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="mr-1 inline-flex items-center align-middle text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-3 rotate-90 transition-transform" />
          </button>
        )}
        {name !== undefined && (
          <>
            <Key name={name} />
            <Punct>: </Punct>
          </>
        )}
        <Punct>{openBrace}</Punct>
      </div>
      {entries.map((entry, i) => (
        <JsonNode
          key={entry.key}
          value={entry.value}
          name={entry.showKey ? entry.key : undefined}
          depth={depth + 1}
          defaultCollapsed={defaultCollapsed}
          last={i === entries.length - 1}
        />
      ))}
      <div style={{ paddingLeft: indent }} className="leading-relaxed">
        <Punct>{closeBrace}{comma}</Punct>
      </div>
    </div>
  )
}

function JsonViewer({
  json,
  data,
  copyable = false,
  collapsible = true,
  defaultCollapsed = false,
  className,
  padding = "p-3",
}: {
  json?: string
  data?: unknown
  copyable?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
  className?: string
  padding?: string
}) {
  const parsed = React.useMemo(() => {
    if (data !== undefined) return data
    if (!json) return undefined
    try {
      return JSON.parse(json)
    } catch {
      return undefined
    }
  }, [json, data])

  const rawCode = React.useMemo(() => {
    if (typeof parsed === "string") return parsed
    try {
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(parsed)
    }
  }, [parsed])

  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }, [rawCode])

  const canCollapse =
    collapsible &&
    parsed !== undefined &&
    typeof parsed === "object" &&
    parsed !== null

  const block = canCollapse ? (
    <pre
      className={cn(
        "overflow-x-auto rounded-sm border border-border/60 font-mono text-xs tabular-nums",
        padding,
        className,
      )}
      style={{
        color: "var(--color-foreground)",
        backgroundColor: "var(--color-muted)",
      }}
    >
      <JsonNode
        value={parsed}
        depth={0}
        defaultCollapsed={defaultCollapsed}
        last
      />
    </pre>
  ) : (
    <pre
      className={cn(
        "overflow-x-auto rounded-sm border border-border/60 font-mono text-xs tabular-nums whitespace-pre-wrap",
        padding,
        className,
      )}
      style={{
        color: "var(--color-foreground)",
        backgroundColor: "var(--color-muted)",
      }}
    >
      {rawCode}
    </pre>
  )

  if (!copyable) return block

  return (
    <div className="group/json relative">
      {block}
      <button
        type="button"
        onClick={handleCopy}
        title="Copy JSON"
        className="absolute right-2 top-2 rounded-sm border border-border/60 bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-foreground group-hover/json:opacity-100"
      >
        {copied ? (
          <Check className="size-3 text-success" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  )
}

export { JsonViewer }
