"use client"

import * as React from "react"
import { Highlight, type PrismTheme } from "prism-react-renderer"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// JsonViewer — the single syntax-highlighted JSON block used across the app.
// Replaces the four duplicated `Highlight`/prism implementations that lived in
// database-explorer, edge-functions, realtime and output-log.
//
// The prism theme is remapped onto the app's semantic tokens instead of the
// raw `vsDark` palette, so highlighted JSON reads as part of the instrument.
// ---------------------------------------------------------------------------

const consoleTheme: PrismTheme = {
  plain: {
    color: "var(--color-foreground)",
    backgroundColor: "var(--color-muted)",
  },
  styles: [
    { types: ["string", "char"], style: { color: "var(--color-success)" } },
    {
      types: ["number", "boolean", "constant"],
      style: { color: "var(--color-warning)" },
    },
    {
      types: ["property", "key", "attr-name"],
      style: { color: "var(--color-primary)" },
    },
    {
      types: ["null", "keyword", "builtin"],
      style: { color: "var(--color-info)" },
    },
    {
      types: ["punctuation", "operator"],
      style: { color: "var(--color-muted-foreground)" },
    },
    {
      types: ["comment"],
      style: { color: "var(--color-muted-foreground)", fontStyle: "italic" },
    },
  ],
}

function stringify(data: unknown): string {
  if (typeof data === "string") return data
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function JsonViewer({
  json,
  data,
  copyable = false,
  className,
  padding = "p-3",
}: {
  /** Pre-stringified JSON. */
  json?: string
  /** Alternative to `json`: a value that will be stringified. */
  data?: unknown
  /** Show a copy-to-clipboard button that reveals on hover. */
  copyable?: boolean
  /** Extra classes on the <pre> (e.g. a `max-h-*` cap). */
  className?: string
  /** Padding utility for the <pre>. */
  padding?: string
}) {
  const code = json ?? stringify(data)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API may be unavailable — ignore silently.
    }
  }, [code])

  const block = (
    <Highlight theme={consoleTheme} code={code} language="json">
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          style={style}
          className={cn(
            "overflow-x-auto rounded-sm border border-border/60 text-xs tabular-nums",
            padding,
            className,
          )}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
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
