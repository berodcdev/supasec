"use client"

import type { LucideIcon } from "lucide-react"
import {
  Crosshair,
  Database,
  HardDrive,
  KeyRound,
  Radio,
  ShieldAlert,
  Waypoints,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase-context"

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "recon", label: "Recon", icon: Crosshair },
  { id: "database", label: "Database", icon: Database },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "functions", label: "Edge", icon: Zap },
  { id: "realtime", label: "Realtime", icon: Radio },
  { id: "auth", label: "Auth", icon: KeyRound },
  { id: "graphql", label: "GraphQL", icon: Waypoints },
  { id: "autopwn", label: "AutoPwn", icon: ShieldAlert },
]

export function LeftRail() {
  const { activeTab, setActiveTab } = useSupabase()

  return (
    <nav className="flex w-16 shrink-0 flex-col border-r border-border bg-card/40 py-1">
      {NAV.map((item) => {
        const active = activeTab === item.id
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            title={item.label}
            aria-current={active}
            className={cn(
              "group relative flex flex-col items-center gap-1 py-2.5 text-muted-foreground transition-colors hover:text-foreground",
              active && "text-primary",
            )}
          >
            {/* active datum tick on the rail edge */}
            <span
              className={cn(
                "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 transition-colors",
                active ? "bg-primary" : "bg-transparent",
              )}
            />
            <Icon className="size-4" />
            <span className="font-mono text-[9px] uppercase tracking-wider">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
