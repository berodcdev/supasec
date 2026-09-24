import type { ScanRecord } from "./scan-history"
import { deriveFindings, summarizeFindings, type FindingSeverity } from "./findings"

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

const SEVERITY_ICON: Record<FindingSeverity, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
}

export function formatMarkdownReport(record: ScanRecord): string {
  const lines: string[] = []
  lines.push(`# Supabase AutoPwn Report`)
  lines.push("")
  lines.push(`- **Project:** \`${record.projectUrl}\``)
  lines.push(`- **Key type:** ${record.keyType}`)
  lines.push(`- **Generated:** ${record.timestamp}`)
  lines.push("")

  // Summary --------------------------------------------------------------
  const exposed = record.db.filter((r) => r.select === "allowed").length
  const empty = record.db.filter((r) => r.select === "empty").length
  const writable = record.db.filter((r) => r.insert === "allowed").length
  const publicBuckets = record.storage.filter((r) => r.public).length
  const listableBuckets = record.storage.filter((r) => r.listable === "allowed").length
  const authOpen = record.auth.filter((r) => r.status === "enabled").length
  const fnsFound = record.functions.filter((r) => r.status === "found").length

  lines.push(`## Summary`)
  lines.push("")
  lines.push(`- ${exposed}/${record.db.length} tables expose data`)
  if (empty > 0) lines.push(`- ${empty} tables return 200 OK with 0 rows`)
  if (writable > 0) lines.push(`- ${writable} tables accept INSERT`)
  if (record.storage.length > 0) {
    lines.push(`- ${record.storage.length} bucket(s) found, ${publicBuckets} public, ${listableBuckets} listable`)
  }
  if (record.auth.length > 0) lines.push(`- ${authOpen}/${record.auth.length} auth features open`)
  if (record.functions.length > 0) lines.push(`- ${fnsFound}/${record.functions.length} edge functions discovered`)
  if (record.realtime && record.realtime.length > 0) {
    const rtOpen = record.realtime.filter((r) => r.subscribed).length
    lines.push(`- ${rtOpen}/${record.realtime.length} tables accept Realtime subscriptions`)
  }
  if (record.graphql?.available) {
    const gql = record.graphql
    lines.push(`- GraphQL introspection open — ${gql.types ?? 0} types, ${gql.mutations ?? 0} mutations`)
  }
  lines.push("")

  // Findings (prioritized) ----------------------------------------------
  const findings = deriveFindings(record)
  if (findings.length > 0) {
    const c = summarizeFindings(findings)
    lines.push(`## Findings`)
    lines.push("")
    lines.push(
      `${c.critical} critical · ${c.high} high · ${c.medium} medium · ${c.low} low · ${c.info} info`,
    )
    lines.push("")
    for (const f of findings) {
      lines.push(
        `### ${SEVERITY_ICON[f.severity]} [${f.severity.toUpperCase()}] ${f.title}`,
      )
      lines.push("")
      lines.push(`- **Evidence:** ${f.evidence}`)
      lines.push(`- **Remediation:** ${f.remediation}`)
      lines.push("")
    }
  }

  // Database -------------------------------------------------------------
  if (record.db.length > 0) {
    lines.push(`## Database (RLS)`)
    lines.push("")
    lines.push(`| Table | SELECT | INSERT | UPDATE | DELETE | Details |`)
    lines.push(`| --- | --- | --- | --- | --- | --- |`)
    for (const r of record.db) {
      lines.push(
        `| \`${escapeMd(r.name)}\` | ${r.select ?? "-"} | ${r.insert ?? "-"} | ${r.update ?? "-"} | ${r.delete ?? "-"} | ${escapeMd(r.details ?? "")} |`,
      )
    }
    lines.push("")
  }

  // Storage --------------------------------------------------------------
  if (record.storage.length > 0) {
    lines.push(`## Storage`)
    lines.push("")
    lines.push(`| Bucket | Public | Listable | Files |`)
    lines.push(`| --- | --- | --- | --- |`)
    for (const r of record.storage) {
      lines.push(
        `| \`${escapeMd(r.name)}\` | ${r.public ? "yes" : "no"} | ${r.listable} | ${r.fileCount ?? "-"} |`,
      )
    }
    lines.push("")
  }

  // Auth -----------------------------------------------------------------
  if (record.auth.length > 0) {
    lines.push(`## Auth`)
    lines.push("")
    lines.push(`| Feature | Status | Details |`)
    lines.push(`| --- | --- | --- |`)
    for (const r of record.auth) {
      lines.push(`| ${escapeMd(r.feature)} | ${r.status} | ${escapeMd(r.details ?? "")} |`)
    }
    lines.push("")
  }

  // Functions ------------------------------------------------------------
  if (record.functions.length > 0) {
    lines.push(`## Edge Functions`)
    lines.push("")
    lines.push(`| Name | Status |`)
    lines.push(`| --- | --- |`)
    for (const r of record.functions) {
      lines.push(`| \`${escapeMd(r.name)}\` | ${r.status} |`)
    }
    lines.push("")
  }

  // Realtime -------------------------------------------------------------
  if (record.realtime && record.realtime.length > 0) {
    lines.push(`## Realtime`)
    lines.push("")
    lines.push(`| Table | Subscription |`)
    lines.push(`| --- | --- |`)
    for (const r of record.realtime) {
      const status = r.subscribed ? "🟢 OPEN" : "🔒 denied"
      lines.push(`| \`${escapeMd(r.table)}\` | ${status} |`)
    }
    lines.push("")
  }

  // GraphQL --------------------------------------------------------------
  if (record.graphql) {
    const gql = record.graphql
    lines.push(`## GraphQL (pg_graphql)`)
    lines.push("")
    if (gql.available) {
      lines.push(`- **Introspection:** enabled`)
      lines.push(`- **Types:** ${gql.types ?? 0}`)
      lines.push(`- **Queries:** ${gql.queries ?? 0}`)
      lines.push(`- **Mutations:** ${gql.mutations ?? 0}`)
      if (gql.insertMutations && gql.insertMutations.length > 0) {
        lines.push(`- **INSERT mutations:** ${gql.insertMutations.map((m) => `\`${m}\``).join(", ")}`)
      }
      if (gql.deleteMutations && gql.deleteMutations.length > 0) {
        lines.push(`- **DELETE mutations:** ${gql.deleteMutations.map((m) => `\`${m}\``).join(", ")}`)
      }
    } else {
      lines.push(`- **Introspection:** ${gql.error ? `error — ${gql.error}` : "not available"}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// HTML Report
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const SEV_COLORS: Record<FindingSeverity, { bg: string; fg: string; border: string }> = {
  critical: { bg: "#2d0a0a", fg: "#ff4444", border: "#ff4444" },
  high: { bg: "#2d1a0a", fg: "#ff8800", border: "#ff8800" },
  medium: { bg: "#2d2a0a", fg: "#ffcc00", border: "#ffcc00" },
  low: { bg: "#0a1a2d", fg: "#4488ff", border: "#4488ff" },
  info: { bg: "#1a1a1a", fg: "#888888", border: "#666666" },
}

export function formatHtmlReport(record: ScanRecord): string {
  const findings = deriveFindings(record)
  const counts = summarizeFindings(findings)
  const exposed = record.db.filter((r) => r.select === "allowed").length
  const writable = record.db.filter((r) => r.insert === "allowed").length

  let host = "supabase"
  try {
    host = new URL(record.projectUrl).hostname.split(".")[0] || "supabase"
  } catch { /* keep default */ }

  const totalFindings = findings.length
  const maxSeverity: FindingSeverity = findings[0]?.severity ?? "info"

  const findingsHtml = findings
    .map((f) => {
      const c = SEV_COLORS[f.severity]
      return `
      <div class="finding" style="border-left:3px solid ${c.border};background:${c.bg};padding:16px 20px;border-radius:6px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="sev-badge" style="background:${c.border};color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">${escapeHtml(f.severity)}</span>
          <span style="font-size:14px;font-weight:600;color:${c.fg}">${escapeHtml(f.title)}</span>
        </div>
        <div style="font-size:13px;color:#ccc;margin-bottom:6px"><strong>Evidence:</strong> ${escapeHtml(f.evidence)}</div>
        <div style="font-size:13px;color:#aaa"><strong>Remediation:</strong> ${escapeHtml(f.remediation)}</div>
      </div>`
    })
    .join("\n")

  const dbRows = record.db
    .map((r) => {
      const selClass = r.select === "allowed" ? "cell-danger" : r.select === "empty" ? "cell-warn" : "cell-ok"
      const insClass = r.insert === "allowed" ? "cell-danger" : "cell-ok"
      const updClass = r.update === "allowed" ? "cell-danger" : "cell-ok"
      const delClass = r.delete === "allowed" ? "cell-danger" : "cell-ok"
      return `<tr>
        <td><code>${escapeHtml(r.name)}</code></td>
        <td class="${selClass}">${r.select ?? "-"}</td>
        <td class="${insClass}">${r.insert ?? "-"}</td>
        <td class="${updClass}">${r.update ?? "-"}</td>
        <td class="${delClass}">${r.delete ?? "-"}</td>
      </tr>`
    })
    .join("\n")

  const storageRows = record.storage
    .map(
      (r) =>
        `<tr><td><code>${escapeHtml(r.name)}</code></td><td>${r.public ? "yes" : "no"}</td><td>${r.listable}</td><td>${r.fileCount ?? "-"}</td></tr>`,
    )
    .join("\n")

  const authRows = record.auth
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.feature)}</td><td>${r.status}</td><td>${escapeHtml(r.details ?? "")}</td></tr>`,
    )
    .join("\n")

  const fnRows = record.functions
    .map(
      (r) =>
        `<tr><td><code>${escapeHtml(r.name)}</code></td><td>${r.status}${r.statusCode ? ` (${r.statusCode})` : ""}</td></tr>`,
    )
    .join("\n")

  const realtimeRows = (record.realtime ?? [])
    .map(
      (r) =>
        `<tr><td><code>${escapeHtml(r.table)}</code></td><td class="${r.subscribed ? "cell-danger" : "cell-ok"}">${r.subscribed ? "OPEN" : "denied"}</td></tr>`,
    )
    .join("\n")

  let graphqlSection = ""
  if (record.graphql) {
    const gql = record.graphql
    if (gql.available) {
      const inserts = gql.insertMutations?.map((m) => `<code>${escapeHtml(m)}</code>`).join(", ") ?? ""
      const deletes = gql.deleteMutations?.map((m) => `<code>${escapeHtml(m)}</code>`).join(", ") ?? ""
      graphqlSection = `
      <section>
        <h2>GraphQL (pg_graphql)</h2>
        <ul>
          <li><strong>Introspection:</strong> <span class="cell-danger" style="padding:2px 6px;border-radius:3px">enabled</span></li>
          <li><strong>Types:</strong> ${gql.types ?? 0}</li>
          <li><strong>Queries:</strong> ${gql.queries ?? 0}</li>
          <li><strong>Mutations:</strong> ${gql.mutations ?? 0}</li>
          ${inserts ? `<li><strong>INSERT mutations:</strong> ${inserts}</li>` : ""}
          ${deletes ? `<li><strong>DELETE mutations:</strong> ${deletes}</li>` : ""}
        </ul>
      </section>`
    } else {
      graphqlSection = `
      <section>
        <h2>GraphQL (pg_graphql)</h2>
        <p>Introspection: ${gql.error ? `error — ${escapeHtml(gql.error)}` : "not available"}</p>
      </section>`
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AutoPwn Report — ${escapeHtml(host)}</title>
<style>
  :root{--bg:#0c0c0e;--surface:#141418;--border:#1e1e24;--text:#e0e0e0;--muted:#888;--teal:#00d4aa;--danger:#ff4444;--warn:#ffcc00;--ok:#44aa44}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;line-height:1.6;padding:0}
  @media print{body{background:#fff;color:#111}:root{--bg:#fff;--surface:#f5f5f5;--border:#ddd;--text:#111;--muted:#555;--teal:#008877;--danger:#cc0000;--warn:#aa8800;--ok:#228822}.no-print{display:none!important}}
  .cover{background:linear-gradient(135deg,#0a0a0c 0%,#0d1117 50%,#0a0a0c 100%);border-bottom:2px solid var(--teal);padding:60px 40px;text-align:center}
  @media print{.cover{background:var(--surface);border-bottom:2px solid var(--teal)}}
  .cover h1{font-size:28px;font-weight:700;color:var(--teal);margin-bottom:8px;letter-spacing:2px;text-transform:uppercase}
  .cover .subtitle{font-size:14px;color:var(--muted);margin-bottom:24px}
  .cover .meta{display:inline-flex;gap:24px;font-size:13px;color:var(--muted)}
  .cover .meta span{display:flex;align-items:center;gap:6px}
  .cover .meta code{background:var(--surface);padding:2px 8px;border-radius:4px;color:var(--text);border:1px solid var(--border)}
  .container{max-width:900px;margin:0 auto;padding:32px 24px}
  .score-bar{display:flex;gap:12px;justify-content:center;margin:32px 0;flex-wrap:wrap}
  .score-pill{padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid var(--border);background:var(--surface)}
  .score-pill .num{font-size:24px;font-weight:800;margin-right:4px}
  section{margin-bottom:32px}
  h2{font-size:18px;font-weight:700;color:var(--teal);border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
  th{text-align:left;padding:10px 12px;background:var(--surface);border:1px solid var(--border);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:1px;color:var(--muted)}
  td{padding:8px 12px;border:1px solid var(--border)}
  tr:nth-child(even){background:rgba(255,255,255,0.02)}
  code{font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px}
  .cell-danger{color:var(--danger);font-weight:600}
  .cell-warn{color:var(--warn)}
  .cell-ok{color:var(--muted)}
  ul{list-style:none;padding-left:0}
  ul li{padding:4px 0;font-size:14px}
  ul li::before{content:"→ ";color:var(--teal)}
  .footer{text-align:center;padding:32px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);margin-top:40px}
  @page{size:A4;margin:20mm}
</style>
</head>
<body>

<div class="cover">
  <h1>⚡ AutoPwn Security Report</h1>
  <div class="subtitle">Supabase PostgREST / Storage / Auth / Realtime / GraphQL Assessment</div>
  <div class="meta">
    <span>Project: <code>${escapeHtml(record.projectUrl)}</code></span>
    <span>Key: <code>${escapeHtml(record.keyType)}</code></span>
    <span>${escapeHtml(record.timestamp)}</span>
  </div>
</div>

<div class="container">

  <div class="score-bar">
    <div class="score-pill" style="color:${SEV_COLORS.critical.fg}"><span class="num">${counts.critical}</span> Critical</div>
    <div class="score-pill" style="color:${SEV_COLORS.high.fg}"><span class="num">${counts.high}</span> High</div>
    <div class="score-pill" style="color:${SEV_COLORS.medium.fg}"><span class="num">${counts.medium}</span> Medium</div>
    <div class="score-pill" style="color:${SEV_COLORS.low.fg}"><span class="num">${counts.low}</span> Low</div>
    <div class="score-pill" style="color:${SEV_COLORS.info.fg}"><span class="num">${counts.info}</span> Info</div>
  </div>

  <section>
    <h2>Executive Summary</h2>
    <ul>
      <li><strong>${totalFindings}</strong> findings total — highest severity: <strong style="color:${SEV_COLORS[maxSeverity].fg}">${maxSeverity.toUpperCase()}</strong></li>
      <li><strong>${exposed}</strong> of ${record.db.length} tables expose data via PostgREST</li>
      ${writable > 0 ? `<li><strong>${writable}</strong> tables accept anonymous INSERT</li>` : ""}
      ${record.storage.length > 0 ? `<li>${record.storage.filter((r) => r.public).length} public bucket(s) out of ${record.storage.length}</li>` : ""}
      ${record.realtime && record.realtime.filter((r) => r.subscribed).length > 0 ? `<li>${record.realtime.filter((r) => r.subscribed).length} table(s) accept Realtime subscriptions</li>` : ""}
      ${record.graphql?.available ? `<li>GraphQL introspection enabled — ${record.graphql.mutations ?? 0} mutations exposed</li>` : ""}
    </ul>
  </section>

  ${
    findings.length > 0
      ? `<section>
    <h2>Findings</h2>
    ${findingsHtml}
  </section>`
      : ""
  }

  ${
    record.db.length > 0
      ? `<section>
    <h2>Database (RLS)</h2>
    <table>
      <thead><tr><th>Table</th><th>SELECT</th><th>INSERT</th><th>UPDATE</th><th>DELETE</th></tr></thead>
      <tbody>${dbRows}</tbody>
    </table>
  </section>`
      : ""
  }

  ${
    record.storage.length > 0
      ? `<section>
    <h2>Storage</h2>
    <table>
      <thead><tr><th>Bucket</th><th>Public</th><th>Listable</th><th>Files</th></tr></thead>
      <tbody>${storageRows}</tbody>
    </table>
  </section>`
      : ""
  }

  ${
    record.auth.length > 0
      ? `<section>
    <h2>Auth</h2>
    <table>
      <thead><tr><th>Feature</th><th>Status</th><th>Details</th></tr></thead>
      <tbody>${authRows}</tbody>
    </table>
  </section>`
      : ""
  }

  ${
    record.functions.length > 0
      ? `<section>
    <h2>Edge Functions</h2>
    <table>
      <thead><tr><th>Name</th><th>Status</th></tr></thead>
      <tbody>${fnRows}</tbody>
    </table>
  </section>`
      : ""
  }

  ${
    realtimeRows
      ? `<section>
    <h2>Realtime</h2>
    <table>
      <thead><tr><th>Table</th><th>Subscription</th></tr></thead>
      <tbody>${realtimeRows}</tbody>
    </table>
  </section>`
      : ""
  }

  ${graphqlSection}

</div>

<div class="footer">
  Generated by <strong>Supabase AutoPwn</strong> — ${escapeHtml(record.timestamp)}
</div>

</body>
</html>`
}

export function downloadFile(filename: string, content: string, mime: string): void {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function reportFilenameBase(record: ScanRecord): string {
  let host = "supabase"
  try {
    host = new URL(record.projectUrl).hostname.split(".")[0] || "supabase"
  } catch { /* keep default */ }
  const ts = record.timestamp.replace(/[:.]/g, "-")
  return `autopwn-${host}-${ts}`
}
