import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// EmptyState — one format for "nothing here yet" placeholders, replacing the
// divergent inline versions across the screens.
// ---------------------------------------------------------------------------

function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      {Icon && <Icon className="size-8 text-muted-foreground/40" />}
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted-foreground/70">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

export { EmptyState }
