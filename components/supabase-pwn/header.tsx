"use client"

import { Github, Power } from "lucide-react"

import { useSupabase } from "@/lib/supabase-context"
import { ReticleMark } from "@/components/supabase-pwn/shared/reticle-mark"

// One cell of the drawing title-block: a tiny label over a mono value.
function Cell({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="hidden min-w-0 flex-col justify-center border-l border-border px-3 py-1 md:flex">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`truncate font-mono text-xs ${accent ? "text-armed" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  )
}

export function Header() {
  const { initialized, projectUrl, keyType, disconnect } = useSupabase()

  function handleDisconnect() {
    disconnect()
    try {
      localStorage.removeItem("supabase-pwn-config")
    } catch {
      // ignore
    }
  }

  const target = (() => {
    if (!projectUrl) return "—"
    try {
      return new URL(projectUrl).hostname
    } catch {
      return projectUrl
    }
  })()

  return (
    <header className="relative shrink-0">
      {/* Datum tick + hairline top edge */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="flex items-stretch justify-between border-b border-border bg-card/40">
        {/* Brand lockup */}
        <div className="boot-in flex items-center gap-2.5 px-4 py-2">
          <ReticleMark className="size-6 text-primary" />
          <div className="leading-tight">
            <div className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
              supabase<span className="text-primary">·</span>pwn
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              offensive recon console
            </div>
          </div>
        </div>

        {/* Title-block cells (live status) */}
        <div className="flex flex-1 items-stretch justify-end">
          <Cell label="Target" value={target} />
          <Cell
            label="Key"
            value={initialized ? keyType : "—"}
          />
          <div className="hidden flex-col justify-center border-l border-border px-3 py-1 md:flex">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Status
            </span>
            <span
              key={initialized ? "armed" : "standby"}
              className={`boot-in font-mono text-xs ${
                initialized
                  ? "text-armed [text-shadow:0_0_8px_var(--color-armed)]"
                  : "text-muted-foreground"
              }`}
            >
              {initialized ? "ARMED" : "STANDBY"}
            </span>
          </div>
          {initialized && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 border-l border-border px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-danger"
              title="Disconnect"
            >
              <Power className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          )}
          <a
            href="https://github.com/berodcdev/supabase-pwn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border-l border-border px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  )
}
