import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge, badgeVariants } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// StatusBadge — a single, semantic wrapper over Badge for security findings
// and connection/live states. Replaces the ad-hoc `bg-*-600 text-white`
// classes that were scattered across the screens.
// ---------------------------------------------------------------------------

export type Severity =
  | "critical"
  | "high"
  | "warning"
  | "info"
  | "safe"
  | "neutral"

const SEVERITY_VARIANT: Record<
  Severity,
  NonNullable<Parameters<typeof badgeVariants>[0]>["variant"]
> = {
  critical: "critical",
  high: "critical",
  warning: "warning",
  info: "info",
  safe: "success",
  neutral: "neutral",
}

// The little leading dot uses the matching token colour.
const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-danger",
  high: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  safe: "bg-success",
  neutral: "bg-muted-foreground",
}

function StatusBadge({
  severity,
  pulse = false,
  dot = true,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Badge> & {
  severity: Severity
  /** Add a soft pulsing glow — use for live/running states. */
  pulse?: boolean
  /** Show the leading status dot. */
  dot?: boolean
}) {
  return (
    <Badge
      variant={SEVERITY_VARIANT[severity]}
      className={cn(
        "rounded-sm font-mono text-[10px] font-semibold uppercase tracking-wide",
        pulse && "animate-reticle-pulse",
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", SEVERITY_DOT[severity])}
        />
      )}
      {children}
    </Badge>
  )
}

export { StatusBadge }
