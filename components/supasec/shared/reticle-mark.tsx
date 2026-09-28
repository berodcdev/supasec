// The brand glyph — a datum / registration crosshair. Uses currentColor so the
// caller controls colour (text-primary, muted, etc.).
function ReticleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <circle cx="16" cy="16" r="6.5" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="1.7" fill="currentColor" stroke="none" />
      <g strokeWidth="1.4" strokeLinecap="round">
        <line x1="16" y1="2.5" x2="16" y2="9" />
        <line x1="16" y1="23" x2="16" y2="29.5" />
        <line x1="2.5" y1="16" x2="9" y2="16" />
        <line x1="23" y1="16" x2="29.5" y2="16" />
      </g>
    </svg>
  )
}

export { ReticleMark }
