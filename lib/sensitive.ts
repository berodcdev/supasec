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
