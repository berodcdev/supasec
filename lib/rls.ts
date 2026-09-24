// Static analysis of RLS policies (from an imported schema dump) into ranked
// issues. Pure + string-only so it's easy to test.

import type { RlsPolicy } from "@/lib/supabase-context"

export type RlsSeverity = "critical" | "high" | "medium" | "info"

export type RlsIssue = { severity: RlsSeverity; message: string }

const SEV_RANK: Record<RlsSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  info: 0,
}

const isTrue = (s: string) => {
  const t = s.trim().toLowerCase().replace(/^\(+|\)+$/g, "").trim()
  return t === "true"
}

const refsAuth = (s: string) => /auth\.(uid|role|jwt)\s*\(\)/i.test(s)

export function analyzeRlsPolicy(p: RlsPolicy): RlsIssue[] {
  const issues: RlsIssue[] = []
  const using = p.using ?? ""
  const check = p.withCheck ?? ""
  const write = /^(insert|update|all)$/i.test(p.command)

  if (!p.using && !p.withCheck) {
    issues.push({
      severity: "high",
      message: "No USING or WITH CHECK clause — the policy is unrestricted.",
    })
  }
  if (p.using && isTrue(using)) {
    issues.push({
      severity: "critical",
      message: "USING (true) — every row is returned to anyone the policy applies to.",
    })
  }
  if (p.withCheck && isTrue(check)) {
    issues.push({
      severity: "critical",
      message: "WITH CHECK (true) — any row can be written.",
    })
  }
  if (write && p.command.toUpperCase() !== "SELECT" && !p.withCheck && p.using) {
    issues.push({
      severity: "medium",
      message: `${p.command.toUpperCase()} without WITH CHECK — writes aren't validated.`,
    })
  }
  if (p.using && !isTrue(using) && !refsAuth(using)) {
    issues.push({
      severity: "medium",
      message: "USING doesn't reference auth.uid()/role()/jwt() — may not scope rows to the caller.",
    })
  }

  if (issues.length === 0) {
    issues.push({ severity: "info", message: "No obvious weakness detected." })
  }
  return issues
}

/** Worst severity across a policy's issues. */
export function worstRlsSeverity(issues: RlsIssue[]): RlsSeverity {
  return issues.reduce<RlsSeverity>(
    (worst, i) => (SEV_RANK[i.severity] > SEV_RANK[worst] ? i.severity : worst),
    "info",
  )
}
