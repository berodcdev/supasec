import { describe, it, expect } from "vitest"

import { deriveFindings, summarizeFindings } from "@/lib/findings"
import type { ScanRecord } from "@/lib/scan-history"

const record: ScanRecord = {
  schemaVersion: 1,
  projectUrl: "https://x.supabase.co",
  keyType: "anon",
  timestamp: new Date().toISOString(),
  db: [
    {
      name: "profiles",
      select: "allowed",
      rowCount: 10,
      colCount: 2,
      columns: ["id", "email"],
      sample: { id: 1, email: "a@b.co" },
    },
    { name: "logs", insert: "allowed" },
    { name: "empty", select: "empty" },
  ],
  storage: [{ name: "avatars", public: true, listable: "allowed" }],
  auth: [{ feature: "Email Signup", status: "enabled", details: "open" }],
  functions: [{ name: "hello", status: "found", statusCode: 200 }],
}

describe("deriveFindings", () => {
  const findings = deriveFindings(record)
  const byId = Object.fromEntries(findings.map((f) => [f.id, f]))

  it("flags an exposed table with PII as critical", () => {
    expect(byId["db-select-profiles"]?.severity).toBe("critical")
    expect(byId["db-select-profiles"]?.evidence).toContain("email")
  })
  it("flags anonymous write as critical", () => {
    expect(byId["db-insert-logs"]?.severity).toBe("critical")
  })
  it("flags a public + listable bucket as critical", () => {
    expect(byId["st-publist-avatars"]?.severity).toBe("critical")
  })
  it("flags open signup as medium", () => {
    expect(byId["auth-signup"]?.severity).toBe("medium")
  })
  it("reports a deployed function as info", () => {
    expect(byId["fn-hello"]?.severity).toBe("info")
  })
  it("sorts by severity (critical first)", () => {
    expect(findings[0].severity).toBe("critical")
  })
})

describe("summarizeFindings", () => {
  it("counts by severity", () => {
    const c = summarizeFindings(deriveFindings(record))
    expect(c.critical).toBeGreaterThanOrEqual(3)
    expect(c.medium).toBe(1)
    expect(c.info).toBe(1)
  })
  it("handles empty", () => {
    expect(summarizeFindings([])).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    })
  })
})
