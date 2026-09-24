"use client"

import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels"
import { cn } from "@/lib/utils"
import { GripHorizontal, GripVertical } from "lucide-react"

function ResizablePanelGroup({
  className,
  ...props
}: GroupProps) {
  return (
    <Group
      className={cn(
        "flex h-full w-full data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel(props: PanelProps) {
  return <Panel {...props} />
}

function ResizableHandle({
  withHandle,
  label,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean; label?: string }) {
  return (
    <Separator
      className={cn(
        "relative flex w-px items-center justify-center bg-primary/25 transition-colors hover:bg-primary/60 data-[resize-handle-state=drag]:bg-primary",
        // generous grab zone
        "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        // horizontal seam (the log expander): full-width line + tall grab zone
        "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0",
        // rotate the plain grip for the horizontal seam; a labelled pill stays flat
        !label && "[&[data-orientation=vertical]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle &&
        (label ? (
          <div className="z-10 flex h-5 items-center gap-1 rounded-sm border border-primary/70 bg-card px-2 font-mono text-[9px] uppercase tracking-widest text-primary shadow-[0_0_12px_-2px_var(--color-primary)] transition-colors hover:bg-primary/15">
            <GripHorizontal className="h-3 w-3" />
            {label}
          </div>
        ) : (
          <div className="z-10 flex h-9 w-4 items-center justify-center rounded-sm border border-primary/70 bg-card text-primary shadow-[0_0_12px_-2px_var(--color-primary)] transition-colors hover:bg-primary/15">
            <GripVertical className="h-4 w-3.5" />
          </div>
        ))}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
