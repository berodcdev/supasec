"use client"

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Header } from "@/components/supabase-pwn/header"
import { InitForm } from "@/components/supabase-pwn/init-form"
import { AuthPanel } from "@/components/supabase-pwn/auth-panel"
import { DatabaseExplorer } from "@/components/supabase-pwn/database-explorer"
import { StorageExplorer } from "@/components/supabase-pwn/storage-explorer"
import { EdgeFunctions } from "@/components/supabase-pwn/edge-functions"
import { Realtime } from "@/components/supabase-pwn/realtime"
import { AutoPwn } from "@/components/supabase-pwn/autopwn"
import { OutputLog } from "@/components/supabase-pwn/output-log"
import { ReconDashboard } from "@/components/supabase-pwn/recon-dashboard"
import { ReticleMark } from "@/components/supabase-pwn/shared/reticle-mark"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useSupabase } from "@/lib/supabase-context"
import {
  Crosshair,
  Database,
  HardDrive,
  Zap,
  Radio,
  ShieldAlert,
} from "lucide-react"

export default function Home() {
  const { initialized, activeTab, setActiveTab } = useSupabase()

  return (
    <div className="flex h-screen flex-col bg-background bg-blueprint text-foreground">
      <Header />
      <InitForm />
      <ResizablePanelGroup orientation="vertical" className="flex-1 min-h-0">
        <ResizablePanel id="main-top" defaultSize="75%" minSize="30%">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel id="tabs-panel" defaultSize="70%" minSize="40%">
              {initialized ? (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex h-full flex-col overflow-hidden"
                >
                  <TabsList variant="line" className="mx-4 mt-2 w-fit shrink-0">
                    <TabsTrigger value="recon">
                      <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                      Recon
                    </TabsTrigger>
                    <TabsTrigger value="database">
                      <Database className="mr-1.5 h-3.5 w-3.5" />
                      Database
                    </TabsTrigger>
                    <TabsTrigger value="storage">
                      <HardDrive className="mr-1.5 h-3.5 w-3.5" />
                      Storage
                    </TabsTrigger>
                    <TabsTrigger value="functions">
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                      Edge Functions
                    </TabsTrigger>
                    <TabsTrigger value="realtime">
                      <Radio className="mr-1.5 h-3.5 w-3.5" />
                      Realtime
                    </TabsTrigger>
                    <TabsTrigger value="autopwn">
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                      Autopwn
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="recon"
                    className="flex-1 min-h-0 overflow-auto"
                  >
                    <ReconDashboard />
                  </TabsContent>
                  <TabsContent
                    value="database"
                    className="flex-1 min-h-0 overflow-auto p-4"
                  >
                    <DatabaseExplorer />
                  </TabsContent>
                  <TabsContent
                    value="storage"
                    className="flex-1 min-h-0 overflow-auto p-4"
                  >
                    <StorageExplorer />
                  </TabsContent>
                  <TabsContent
                    value="functions"
                    className="flex-1 min-h-0 overflow-auto p-4"
                  >
                    <EdgeFunctions />
                  </TabsContent>
                  <TabsContent
                    value="realtime"
                    className="flex-1 min-h-0 overflow-auto p-4"
                  >
                    <Realtime />
                  </TabsContent>
                  <TabsContent
                    value="autopwn"
                    className="flex-1 min-h-0 overflow-auto p-4"
                  >
                    <AutoPwn />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <ReticleMark className="size-16 text-primary/20" />
                  <div className="text-center">
                    <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      No target acquired
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground/60">
                      Initialize a Supabase project to begin recon.
                    </p>
                  </div>
                </div>
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="auth-panel" defaultSize="30%" minSize="20%" maxSize="40%">
              {initialized ? (
                <AuthPanel />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <ReticleMark className="size-10 text-primary/15" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Auth module · standby
                  </p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="output-log" defaultSize="25%" minSize="10%">
          <OutputLog />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
