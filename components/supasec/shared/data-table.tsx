"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// DataTable — one semantic <table> with a sticky header, tabular-aligned
// numeric columns and built-in loading/empty states. Replaces the raw <table>
// in AutoPwn and the CSS `grid grid-cols-*` file/event lists elsewhere.
// ---------------------------------------------------------------------------

export type Column<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T, index: number) => React.ReactNode
  align?: "left" | "right" | "center"
  /** Applied to the <th> and <td> of this column. */
  className?: string
}

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
}

function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  empty = "No data.",
  className,
  onRowClick,
  isRowActive,
  renderExpanded,
}: {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string
  loading?: boolean
  empty?: React.ReactNode
  className?: string
  onRowClick?: (row: T, index: number) => void
  isRowActive?: (row: T, index: number) => boolean
  /**
   * Return expansion content for a row to make it expandable (click to toggle).
   * Return null for rows that should not expand.
   */
  renderExpanded?: (row: T, index: number) => React.ReactNode
}) {
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(
    () => new Set(),
  )
  const hasExpand = !!renderExpanded
  const totalCols = columns.length + (hasExpand ? 1 : 0)

  const toggle = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div
      className={cn(
        "overflow-auto rounded-sm border border-border",
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            {hasExpand && <th className="w-8" />}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                  ALIGN[col.align ?? "left"],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={totalCols}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                <Loader2 className="mx-auto size-4 animate-spin" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalCols}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const key = getRowKey(row, i)
              const expContent = renderExpanded ? renderExpanded(row, i) : null
              const expandable = expContent != null
              const isExpanded = expandable && expandedKeys.has(key)
              const clickable = expandable || !!onRowClick
              const handleClick = expandable
                ? () => toggle(key)
                : onRowClick
                  ? () => onRowClick(row, i)
                  : undefined

              return (
                <React.Fragment key={key}>
                  <tr
                    onClick={handleClick}
                    className={cn(
                      "border-b border-border/40 transition-colors last:border-0",
                      clickable && "cursor-pointer",
                      isRowActive?.(row, i)
                        ? "bg-primary/10"
                        : "hover:bg-muted/30",
                    )}
                  >
                    {hasExpand && (
                      <td className="w-8 px-2 py-1.5 align-top text-muted-foreground">
                        {expandable &&
                          (isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          ))}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-1.5 align-top",
                          ALIGN[col.align ?? "left"],
                          col.className,
                        )}
                      >
                        {col.cell(row, i)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-border/40 bg-muted/20">
                      <td colSpan={totalCols} className="px-3 py-2">
                        {expContent}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export { DataTable }
