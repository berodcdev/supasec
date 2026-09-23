import { describe, it, expect } from "vitest"

import {
  isSensitiveColumn,
  sensitiveTableHint,
  sensitiveFileHint,
  flagSensitiveColumns,
  flagSensitiveValues,
  decodeJwtClaims,
  describeJwtsInRow,
  scanJsonForSecrets,
} from "@/lib/sensitive"

// Build a real (unsigned) JWT with the given claims for the value scanners.
function makeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${header}.${payload}.c2ln` // "sig"
}

describe("isSensitiveColumn", () => {
  it("flags PII/secret column names", () => {
    expect(isSensitiveColumn("email")).toBe(true)
    expect(isSensitiveColumn("user_password")).toBe(true)
    expect(isSensitiveColumn("api_key")).toBe(true)
    expect(isSensitiveColumn("PhoneNumber")).toBe(true)
  })
  it("ignores innocuous names", () => {
    expect(isSensitiveColumn("id")).toBe(false)
    expect(isSensitiveColumn("created_at")).toBe(false)
    expect(isSensitiveColumn("title")).toBe(false)
  })
})

describe("sensitiveTableHint / sensitiveFileHint", () => {
  it("matches sensitive table names", () => {
    expect(sensitiveTableHint("users")).toBeTruthy()
    expect(sensitiveTableHint("payment_methods")).toBeTruthy()
    expect(sensitiveTableHint("blog_posts")).toBeNull()
  })
  it("matches sensitive file names", () => {
    expect(sensitiveFileHint(".env")).toBeTruthy()
    expect(sensitiveFileHint("db_backup.sql")).toBeTruthy()
    expect(sensitiveFileHint("id_rsa")).toBeTruthy()
    expect(sensitiveFileHint("cat.png")).toBeNull()
  })
})

describe("flagSensitiveColumns", () => {
  it("returns distinct labels", () => {
    const out = flagSensitiveColumns(["id", "email", "user_email", "password"])
    expect(out).toContain("email")
    expect(out).toContain("password")
  })
  it("empty for none", () => {
    expect(flagSensitiveColumns(["id", "name"])).toEqual([])
    expect(flagSensitiveColumns(undefined)).toEqual([])
  })
})

describe("flagSensitiveValues", () => {
  it("detects secrets in values regardless of column name", () => {
    const row = {
      note: "contact me at john@example.com",
      blob: makeJwt({ role: "authenticated" }),
      k: "sb_secret_abcdefgh12345678",
    }
    const { kinds } = flagSensitiveValues(row)
    expect(kinds).toContain("email")
    expect(kinds).toContain("JWT")
    expect(kinds).toContain("Supabase key")
  })
  it("clean row yields nothing", () => {
    expect(flagSensitiveValues({ id: 1, title: "hello" }).kinds).toEqual([])
  })
})

describe("decodeJwtClaims / describeJwtsInRow", () => {
  it("decodes claims", () => {
    const jwt = makeJwt({ role: "service_role", exp: 9999999999 })
    const claims = decodeJwtClaims(jwt)
    expect(claims?.role).toBe("service_role")
  })
  it("describes JWTs found in a row (role + exp)", () => {
    const row = { data: makeJwt({ role: "service_role", exp: 4102444800 }) }
    const desc = describeJwtsInRow(row)
    expect(desc.length).toBe(1)
    expect(desc[0]).toContain("service_role")
  })
  it("returns null for garbage", () => {
    expect(decodeJwtClaims("not.a.jwt")).toBeNull()
  })
})

describe("scanJsonForSecrets", () => {
  it("scans arbitrary shapes", () => {
    const res = scanJsonForSecrets({
      items: [{ token: makeJwt({ role: "anon" }) }, { email: "a@b.co" }],
    })
    expect(res.kinds).toContain("JWT")
    expect(res.kinds).toContain("email")
    expect(res.jwts.length).toBe(1)
  })
  it("handles strings and empties", () => {
    expect(scanJsonForSecrets("").kinds).toEqual([])
    expect(scanJsonForSecrets(null).kinds).toEqual([])
  })
})
