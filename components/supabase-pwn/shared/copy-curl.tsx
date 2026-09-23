"use client"

import * as React from "react"
import { Check, Terminal } from "lucide-react"

import { Button } from "@/components/ui/button"

// A small "copy as curl" button. `build` is called on click so the curl string
// always reflects the current form values.
function CopyCurl({
  build,
  disabled,
  className,
}: {
  build: () => string
  disabled?: boolean
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handle = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(build())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — ignore
    }
  }, [build])

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handle}
      disabled={disabled}
      className={className}
      title="Copy this request as a curl command"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Terminal className="size-3.5" />}
      curl
    </Button>
  )
}

export { CopyCurl }
