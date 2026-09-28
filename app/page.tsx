"use client"

import { Header } from "@/components/supasec/header"
import { InitForm } from "@/components/supasec/init-form"
import { LeftRail } from "@/components/supasec/left-rail"
import { TelemetryBar } from "@/components/supasec/telemetry-bar"
import { AuthPanel } from "@/components/supasec/auth-panel"
import { DatabaseExplorer } from "@/components/supasec/database-explorer"
import { StorageExplorer } from "@/components/supasec/storage-explorer"
import { EdgeFunctions } from "@/components/supasec/edge-functions"
import { Realtime } from "@/components/supasec/realtime"
import { AutoPwn } from "@/components/supasec/autopwn"
import { GraphQLExplorer } from "@/components/supasec/graphql-explorer"
import { ReconDashboard } from "@/components/supasec/recon-dashboard"
import { CommandPalette } from "@/components/supasec/command-palette"
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
