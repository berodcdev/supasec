import { describe, it, expect } from "vitest"

import { analyzeRlsPolicy, worstRlsSeverity } from "@/lib/rls"
import type { RlsPolicy } from "@/lib/supabase-context"

const pol = (p: Partial<RlsPolicy>): RlsPolicy => ({
  table: "t",
  command: "SELECT",
  name: "p",
  ...p,
})

describe("analyzeRlsPolicy", () => {
  it("flags USING (true) as critical", () => {
    const issues = analyzeRlsPolicy(pol({ using: "(true)" }))
    expect(worstRlsSeverity(issues)).toBe("critical")
  })
  it("flags WITH CHECK true as critical", () => {
    const issues = analyzeRlsPolicy(pol({ command: "INSERT", withCheck: "true" }))
    expect(issues.some((i) => i.severity === "critical")).toBe(true)
  })
  it("flags missing clauses as high", () => {
    const issues = analyzeRlsPolicy(pol({}))
    expect(worstRlsSeverity(issues)).toBe("high")
  })
  it("flags a USING without auth.* as medium", () => {
    const issues = analyzeRlsPolicy(pol({ using: "status = 'public'" }))
    expect(worstRlsSeverity(issues)).toBe("medium")
  })
  it("passes a scoped policy as info", () => {
    const issues = analyzeRlsPolicy(pol({ using: "auth.uid() = user_id" }))
    expect(worstRlsSeverity(issues)).toBe("info")
  })
})
