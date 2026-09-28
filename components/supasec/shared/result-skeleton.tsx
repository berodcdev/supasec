// A blueprint "scanning" placeholder for result areas — faint lines with a
// scan-sweep running over them, so a pending request reads as work in progress
// instead of a blank gap that suddenly pops.
function ResultSkeleton({ label = "querying" }: { label?: string }) {
  const widths = ["70%", "90%", "55%", "80%", "40%"]
  return (
    <div className="animate-scan-sweep relative overflow-hidden rounded-none border border-border/60 bg-card/40 p-3">
      <div className="space-y-2">
        {widths.map((w, i) => (
          <div key={i} className="h-2.5 rounded-none bg-muted/50" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}…
      </div>
    </div>
  )
}

export { ResultSkeleton }
