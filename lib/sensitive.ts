// Shared heuristic for spotting sensitive / PII column names in exposed data.
// Used by the findings engine to escalate "table is readable" into "table leaks
// PII". Substring match against lower-cased column names.

const SENSITIVE_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "password", label: "password" },
  { pattern: "passwd", label: "password" },
  { pattern: "secret", label: "secret" },
  { pattern: "token", label: "token" },
  { pattern: "api_key", label: "api key" },
  { pattern: "apikey", label: "api key" },
  { pattern: "private_key", label: "private key" },
  { pattern: "email", label: "email" },
  { pattern: "phone", label: "phone" },
  { pattern: "ssn", label: "SSN" },
  { pattern: "cpf", label: "CPF" },
  { pattern: "cnpj", label: "CNPJ" },
  { pattern: "credit", label: "credit card" },
  { pattern: "card_number", label: "card number" },
  { pattern: "cardnumber", label: "card number" },
  { pattern: "iban", label: "bank account" },
  { pattern: "address", label: "address" },
  { pattern: "birth", label: "date of birth" },
  { pattern: "dob", label: "date of birth" },
  { pattern: "salary", label: "salary" },
  { pattern: "stripe", label: "Stripe id" },
  { pattern: "session", label: "session" },
  { pattern: "hash", label: "hash" },
]

/** True when a single column name looks sensitive/PII. */
export function isSensitiveColumn(name: string): boolean {
  const c = name.toLowerCase()
  return SENSITIVE_PATTERNS.some(({ pattern }) => c.includes(pattern))
}

// Table names that, by themselves, are a lead worth flagging during discovery.
const SENSITIVE_TABLE_PATTERNS = [
  "user", "admin", "account", "auth", "credential", "password", "secret",
  "token", "session", "payment", "billing", "card", "invoice", "customer",
  "member", "profile", "wallet", "transaction", "bank", "ssn", "cpf", "cnpj",
  "api_key", "apikey", "subscription", "license", "private", "webhook",
]

/** A human label if the table NAME itself looks sensitive, else null. */
export function sensitiveTableHint(name: string): string | null {
  const c = name.toLowerCase()
  const hit = SENSITIVE_TABLE_PATTERNS.find((p) => c.includes(p))
  return hit ?? null
}

// Detect secrets by the VALUE, not the column name — catches leaks hidden in
// innocuously-named columns (e.g. a "data" column holding a JWT).
const VALUE_SIGNATURES: { kind: string; re: RegExp }[] = [
  { kind: "JWT", re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/ },
  { kind: "Supabase key", re: /sb_(?:publishable|secret)_[A-Za-z0-9]{8,}/ },
  { kind: "private key", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { kind: "AWS key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "Stripe key", re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { kind: "credit card", re: /\b(?:\d[ -]?){15,16}\b/ },
  { kind: "bcrypt hash", re: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/ },
]

/**
 * Scan a row's VALUES for secret-looking content. Returns the distinct kinds
 * found and which columns carried them.
 */
export function flagSensitiveValues(
  row: Record<string, unknown>,
): { kinds: string[]; hits: { column: string; kind: string }[] } {
  const hits: { column: string; kind: string }[] = []
  const kinds = new Set<string>()
  for (const [col, val] of Object.entries(row)) {
    if (val == null) continue
    const s = typeof val === "string" ? val : JSON.stringify(val)
    if (s.length > 20000) continue // skip huge blobs
    for (const { kind, re } of VALUE_SIGNATURES) {
      if (re.test(s)) {
        hits.push({ column: col, kind })
        kinds.add(kind)
      }
    }
  }
  return { kinds: [...kinds], hits }
}

// Curated column names worth probing on tables whose rows are RLS-blocked, to
// reveal structure without reading data (see column bruteforce).
export const SENSITIVE_COLUMN_PROBES = [
  "email", "password", "password_hash", "token", "access_token", "api_key",
  "apikey", "secret", "phone", "cpf", "ssn", "credit_card", "card_number",
  "stripe_customer_id", "is_admin", "role", "balance",
]

// File names that are a lead when found in a storage bucket.
const SENSITIVE_FILE_PATTERNS = [
  ".env", "backup", "dump", ".sql", "id_rsa", ".pem", ".key", ".ppk",
  "credential", "secret", "password", ".pfx", ".p12", ".bak", "private",
  "wallet", ".kdbx", "config.json", ".htpasswd", "serviceaccount",
]

/** A human label if a file NAME looks sensitive, else null. */
export function sensitiveFileHint(name: string): string | null {
  const c = name.toLowerCase()
  return SENSITIVE_FILE_PATTERNS.find((p) => c.includes(p)) ?? null
}

/** Decode a JWT payload (no verification), or null. */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    const json =
      typeof atob !== "undefined"
        ? atob(pad)
        : Buffer.from(pad, "base64").toString("utf8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g

function describeJwtsInString(s: string): string[] {
  const out = new Set<string>()
  JWT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = JWT_RE.exec(s)) !== null) {
    const claims = decodeJwtClaims(m[0])
    if (!claims) continue
    const role = claims.role ? String(claims.role) : "?"
    const exp =
      typeof claims.exp === "number"
        ? new Date(claims.exp * 1000).toISOString().slice(0, 10)
        : "?"
    out.add(`role=${role}, exp=${exp}`)
  }
  return [...out]
}

/** Describe any JWTs embedded in a row's values (role + expiry) — leaked
 *  service_role tokens are the crown jewels. */
export function describeJwtsInRow(row: Record<string, unknown>): string[] {
  const out = new Set<string>()
  for (const val of Object.values(row)) {
    if (val == null) continue
    const s = typeof val === "string" ? val : JSON.stringify(val)
    for (const d of describeJwtsInString(s)) out.add(d)
  }
  return [...out]
}

/** Scan an arbitrary JSON response (any shape) for secret-looking content and
 *  embedded JWTs — used on RPC / Edge Function / Realtime payloads. */
export function scanJsonForSecrets(data: unknown): {
  kinds: string[]
  jwts: string[]
} {
  let s: string
  try {
    s = typeof data === "string" ? data : JSON.stringify(data)
  } catch {
    return { kinds: [], jwts: [] }
  }
  if (!s || s.length > 200000) return { kinds: [], jwts: [] }
  const kinds = new Set<string>()
  for (const { kind, re } of VALUE_SIGNATURES) {
    if (re.test(s)) kinds.add(kind)
  }
  return { kinds: [...kinds], jwts: describeJwtsInString(s) }
}

/**
 * Given a list of column names, return the distinct human labels of the
 * sensitive kinds detected (e.g. ["email", "password"]).
 */
export function flagSensitiveColumns(columns: string[] | undefined): string[] {
  if (!columns || columns.length === 0) return []
  const found = new Set<string>()
  for (const col of columns) {
    const c = col.toLowerCase()
    for (const { pattern, label } of SENSITIVE_PATTERNS) {
      if (c.includes(pattern)) found.add(label)
    }
  }
  return [...found]
}
