"use client"

import { Header } from "@/components/supabase-pwn/header"
import { InitForm } from "@/components/supabase-pwn/init-form"
import { LeftRail } from "@/components/supabase-pwn/left-rail"
import { TelemetryBar } from "@/components/supabase-pwn/telemetry-bar"
import { AuthPanel } from "@/components/supabase-pwn/auth-panel"
import { DatabaseExplorer } from "@/components/supabase-pwn/database-explorer"
import { StorageExplorer } from "@/components/supabase-pwn/storage-explorer"
import { EdgeFunctions } from "@/components/supabase-pwn/edge-functions"
import { Realtime } from "@/components/supabase-pwn/realtime"
import { AutoPwn } from "@/components/supabase-pwn/autopwn"
import { GraphQLExplorer } from "@/components/supabase-pwn/graphql-explorer"
import { ReconDashboard } from "@/components/supabase-pwn/recon-dashboard"
import { CommandPalette } from "@/components/supabase-pwn/command-palette"
import { useSupabase } from "@/lib/supabase-context"

function ActiveTool({ tab }: { tab: string }) {
  switch (tab) {
    case "recon":
      return <ReconDashboard />
    case "database":
      return <DatabaseExplorer />
    case "realtime":
      return <Realtime />
    case "auth":
      return <AuthPanel />
    case "storage":
      return (
        <div className="p-4">
          <StorageExplorer />
        </div>
      )
    case "functions":
      return (
        <div className="p-4">
          <EdgeFunctions />
        </div>
      )
    case "graphql":
      return <GraphQLExplorer />
    case "autopwn":
      return (
        <div className="p-4">
          <AutoPwn />
        </div>
      )
    default:
      return null
  }
}

export default function Home() {
  const { initialized, activeTab } = useSupabase()

  return (
    <div className="flex h-screen flex-col bg-background bg-blueprint text-foreground">
      <Header />
      <CommandPalette />

      {initialized ? (
        <div className="flex min-h-0 flex-1">
          <LeftRail />
          <main className="min-h-0 flex-1 overflow-auto">
            <ActiveTool tab={activeTab} />
          </main>
        </div>
      ) : (
        // Pre-connect: a focused "acquire target" screen.
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          <div className="w-full max-w-2xl">
            <InitForm />
          </div>
        </div>
      )}

      <TelemetryBar />
    </div>
  )
}
