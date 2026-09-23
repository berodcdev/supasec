import * as React from "react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// ReticlePanel — the signature element. An L-corner frame (like an autofocus
// reticle / Burp Repeater's active request) that wraps the element in focus on
// a screen. Nearly invisible until `active`, when the corners take the primary
// colour and pulse. Carries a mono coordinate tag, e.g. [SCAN:RUN].
// ---------------------------------------------------------------------------

function Corner({
  className,
  active,
}: {
  className?: string
  active: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute size-3 transition-colors duration-200",
        active ? "border-primary" : "border-border",
        className,
      )}
    />
  )
}

function ReticlePanel({
  active = false,
  label,
  className,
  children,
}: {
  active?: boolean
  /** Mono coordinate tag, e.g. "TBL:03" or "SCAN:RUN". */
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative rounded-sm p-px transition-colors",
        active && "animate-reticle-pulse rounded-sm",
        className,
      )}
    >
      {/* Four L-corners */}
      <Corner active={active} className="left-0 top-0 border-l border-t" />
      <Corner active={active} className="right-0 top-0 border-r border-t" />
      <Corner active={active} className="bottom-0 left-0 border-b border-l" />
      <Corner active={active} className="bottom-0 right-0 border-b border-r" />

      {/* Coordinate tag */}
      {label && (
        <span
          className={cn(
            "absolute -top-2 left-3 z-10 bg-background px-1 font-mono text-[9px] uppercase tracking-widest transition-colors",
            active ? "text-primary" : "text-muted-foreground",
          )}
        >
          [{label}]
        </span>
      )}

      {children}
    </div>
  )
}

export { ReticlePanel }
