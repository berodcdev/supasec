import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// SectionHeader — eyebrow + title + hairline, the single pattern for the
// intro row that opens each screen.
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  actions,
  className,
}: {
  icon?: LucideIcon
  eyebrow?: React.ReactNode
  title: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5 border-b border-border pb-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-primary" />}
          <div>
            {eyebrow && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <p className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
              {title}
            </p>
          </div>
        </div>
        {actions}
      </div>
    </div>
  )
}

export { SectionHeader }
