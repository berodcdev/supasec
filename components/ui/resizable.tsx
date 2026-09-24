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
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        "group/handle relative flex w-px items-center justify-center bg-border transition-colors hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary",
        // wider invisible grab zone so it's easy to grab
        "after:absolute after:inset-y-0 after:left-1/2 after:w-2.5 after:-translate-x-1/2",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        // horizontal seam (log expander)
        "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-2.5 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-4 items-center justify-center rounded-sm border border-primary/40 bg-card text-primary/70 shadow-sm transition-colors group-hover/handle:border-primary group-hover/handle:text-primary group-data-[orientation=vertical]/handle:h-4 group-data-[orientation=vertical]/handle:w-10">
          <GripVertical className="h-3 w-3 group-data-[orientation=vertical]/handle:hidden" />
          <GripHorizontal className="hidden h-3 w-3 group-data-[orientation=vertical]/handle:block" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
