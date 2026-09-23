import { Shield, Github } from "lucide-react"

export function Header() {
  return (
    <header className="relative">
      {/* Accent gradient line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded-sm border border-primary/40">
            <Shield className="h-3.5 w-3.5 text-primary" />
          </div>
          <h1 className="font-mono text-sm font-semibold uppercase tracking-widest text-foreground">
            supabase-pwn
          </h1>
          <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 leading-none">
            v1.0
          </span>
        </div>
        <a
          href="https://github.com/BobTheShoplifter/supabase-pwn"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>
    </header>
  )
}
