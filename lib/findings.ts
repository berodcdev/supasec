// Findings engine — turns raw AutoPwn scan results into a ranked, human list of
// vulnerabilities with evidence and remediation. This is the "where is it
// vulnerable" layer that sits on top of ScanRecord.

import type { ScanRecord } from "@/lib/scan-history"
import {
  flagSensitiveColumns,
  flagSensitiveValues,
  describeJwtsInRow,
} from "@/lib/sensitive"

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info"

export type FindingCategory = "database" | "storage" | "auth" | "functions" | "realtime" | "graphql"

export type Finding = {
  id: string
  severity: FindingSeverity
  category: FindingCategory
  title: string
  evidence: string
  remediation: string
  target?: string
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
}

/** Does this key POV represent an external/unauthenticated attacker? */
function isAnonPov(keyType: string): boolean {
  return keyType === "anon" || keyType === "publishable"
}

export function deriveFindings(record: ScanRecord): Finding[] {
  const findings: Finding[] = []
  const anon = isAnonPov(record.keyType)
  const povNote = anon
    ? "readable with a browser-safe (anon/publishable) key"
    : `readable with a ${record.keyType} key (privileged — not an external attacker)`

  // -- Database ------------------------------------------------------------
  for (const r of record.db) {
    if (r.select === "allowed") {
      const sensitive = flagSensitiveColumns(r.columns)
      const isRow =
        r.sample && typeof r.sample === "object" && !Array.isArray(r.sample)
      const sampleRow = isRow ? (r.sample as Record<string, unknown>) : null
      const valSecrets = sampleRow ? flagSensitiveValues(sampleRow).kinds : []
      const jwtDescs = sampleRow ? describeJwtsInRow(sampleRow) : []
      const rowText =
        r.rowCount != null ? `${r.rowCount.toLocaleString()} row(s)` : "readable rows"
      const colText = r.colCount != null ? `${r.colCount} column(s)` : "unknown columns"
      const sensNote =
        sensitive.length > 0 ? ` — includes ${sensitive.join(", ")}` : ""
      const valNote =
        valSecrets.length > 0 ? ` — secret values: ${valSecrets.join(", ")}` : ""
      const jwtNote =
        jwtDescs.length > 0 ? ` — JWT(s): ${jwtDescs.join(" | ")}` : ""
      findings.push({
        id: `db-select-${r.name}`,
        // PII, secret values, or an anon POV makes this critical; otherwise high.
        severity:
          sensitive.length > 0 || valSecrets.length > 0 || anon ? "critical" : "high",
        category: "database",
        target: r.name,
        title: `Table "${r.name}" exposes data`,
        evidence: `${rowText}, ${colText}${sensNote}${valNote}${jwtNote} — ${povNote}`,
        remediation:
          "Enable Row Level Security on the table and add a policy that scopes rows to the authenticated user (e.g. auth.uid() = user_id).",
      })
    }

    for (const op of ["insert", "update", "delete"] as const) {
      if (r[op] === "allowed") {
        findings.push({
          id: `db-${op}-${r.name}`,
          severity: "critical",
          category: "database",
          target: r.name,
          title: `Table "${r.name}" accepts anonymous ${op.toUpperCase()}`,
          evidence: `${op.toUpperCase()} succeeded — ${povNote.replace("readable", "writable")}`,
          remediation: `Add a restrictive RLS policy for ${op.toUpperCase()} (WITH CHECK) so only authorized users can write.`,
        })
      }
    }

    if (r.select === "empty") {
      findings.push({
        id: `db-empty-${r.name}`,
        severity: "low",
        category: "database",
        target: r.name,
        title: `Table "${r.name}" is reachable`,
        evidence:
          "Returned 200 OK with 0 rows — RLS is filtering, or the table is empty.",
        remediation:
          "Confirm RLS is intended here; a 200 with 0 rows can still leak schema existence.",
      })
    }
  }

  // -- Storage -------------------------------------------------------------
  for (const b of record.storage) {
    const listable = b.listable === "allowed"
    if (b.public && listable) {
      findings.push({
        id: `st-publist-${b.name}`,
        severity: "critical",
        category: "storage",
        target: b.name,
        title: `Bucket "${b.name}" is public and listable`,
        evidence: `Anonymous callers can list${
          b.fileCount != null ? ` (${b.fileCount}+ file(s) seen)` : ""
        } and download files.`,
        remediation:
          "Make the bucket private and gate access with Storage RLS policies / signed URLs.",
      })
    } else if (b.public) {
      findings.push({
        id: `st-public-${b.name}`,
        severity: "high",
        category: "storage",
        target: b.name,
        title: `Bucket "${b.name}" is public`,
        evidence: "Files are downloadable by anyone with the object path.",
        remediation:
          "Make the bucket private unless public read is intended; serve via signed URLs.",
      })
    } else if (listable) {
      findings.push({
        id: `st-list-${b.name}`,
        severity: "high",
        category: "storage",
        target: b.name,
        title: `Bucket "${b.name}" is listable`,
        evidence: `Anonymous callers can enumerate objects${
          b.fileCount != null ? ` (${b.fileCount}+ seen)` : ""
        }.`,
        remediation:
          "Add a Storage RLS policy that denies anonymous list on this bucket.",
      })
    }
  }

  // -- Auth ----------------------------------------------------------------
  for (const a of record.auth) {
    if (a.status !== "enabled") continue
    if (/signup/i.test(a.feature)) {
      findings.push({
        id: `auth-signup`,
        severity: "medium",
        category: "auth",
        target: a.feature,
        title: "Open email signup is enabled",
        evidence: a.details ?? "Anyone can create an account.",
        remediation:
          "Disable open signup or require email confirmation / invite, and restrict what a fresh account can read via RLS.",
      })
    } else if (/anon/i.test(a.feature)) {
      findings.push({
        id: `auth-anon`,
        severity: "medium",
        category: "auth",
        target: a.feature,
        title: "Anonymous authentication is enabled",
        evidence: a.details ?? "Anonymous sessions can be created.",
        remediation:
          "Disable anonymous sign-ins if unused; otherwise ensure RLS treats anon users as untrusted.",
      })
    }
  }

  // -- Edge Functions ------------------------------------------------------
  for (const f of record.functions) {
    if (f.status === "found") {
      findings.push({
        id: `fn-${f.name}`,
        severity: "info",
        category: "functions",
        target: f.name,
        title: `Edge function "${f.name}" is deployed`,
        evidence: `Reachable${f.statusCode ? ` (HTTP ${f.statusCode})` : ""}.`,
        remediation:
          "Confirm the function verifies auth/JWT and validates input; deployment alone is not a vuln.",
      })
    }
  }

  // -- GraphQL --------------------------------------------------------------
  if (record.graphql?.available) {
    const gql = record.graphql
    findings.push({
      id: "gql-introspection",
      severity: anon ? "high" : "medium",
      category: "graphql",
      title: "GraphQL introspection enabled",
      evidence: `The /graphql/v1 endpoint responds to introspection and exposes ${gql.types ?? 0} types, ${gql.queries ?? 0} queries, ${gql.mutations ?? 0} mutations. ${povNote}.`,
      remediation:
        "Disable introspection in production or restrict the GraphQL endpoint with RLS policies.",
    })

    if (gql.insertMutations && gql.insertMutations.length > 0) {
      findings.push({
        id: "gql-insert-mutations",
        severity: anon ? "critical" : "high",
        category: "graphql",
        title: `${gql.insertMutations.length} INSERT mutation(s) via GraphQL`,
        evidence: `Tables writable via GraphQL: ${gql.insertMutations.join(", ")}. ${povNote}.`,
        remediation:
          "Verify RLS policies block unauthorized writes through both REST and GraphQL paths.",
      })
    }

    if (gql.deleteMutations && gql.deleteMutations.length > 0) {
      findings.push({
        id: "gql-delete-mutations",
        severity: anon ? "critical" : "high",
        category: "graphql",
        title: `${gql.deleteMutations.length} DELETE mutation(s) via GraphQL`,
        evidence: `Tables deletable via GraphQL: ${gql.deleteMutations.join(", ")}. ${povNote}.`,
        remediation:
          "Verify RLS policies block unauthorized deletes through both REST and GraphQL paths.",
      })
    }
  }

  // -- Realtime -------------------------------------------------------------
  if (record.realtime && record.realtime.length > 0) {
    const subscribable = record.realtime.filter((r) => r.subscribed)
    if (subscribable.length > 0) {
      const dbExposed = new Set(
        record.db.filter((r) => r.select === "allowed").map((r) => r.name),
      )
      const realtimeOnly = subscribable.filter((r) => !dbExposed.has(r.table))

      findings.push({
        id: "rt-subscribe-open",
        severity: anon ? "high" : "medium",
        category: "realtime",
        title: `Realtime subscription open on ${subscribable.length} table(s)`,
        evidence: `Tables accepting postgres_changes subscribe: ${subscribable.map((r) => r.table).join(", ")}. ${povNote}.`,
        remediation:
          "Add Realtime authorization policies (Dashboard → Realtime → Policies) or disable Realtime on tables that don't need it.",
      })

      if (realtimeOnly.length > 0) {
        findings.push({
          id: "rt-bypass-rls",
          severity: "critical",
          category: "realtime",
          title: `Realtime leaks ${realtimeOnly.length} table(s) blocked by RLS on REST`,
          evidence: `These tables are NOT readable via REST/PostgREST but accept Realtime subscriptions: ${realtimeOnly.map((r) => r.table).join(", ")}. An attacker can subscribe and wait for changes to leak data.`,
          remediation:
            "This is a serious bypass — add Realtime authorization policies for these tables immediately, or disable Realtime on them.",
        })
      }
    }
  }

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
  return findings
}

export type FindingCounts = Record<FindingSeverity, number>

export function summarizeFindings(findings: Finding[]): FindingCounts {
  const counts: FindingCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }
  for (const f of findings) counts[f.severity]++
  return counts
}
