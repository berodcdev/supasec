import type { ScanRecord } from "./scan-history"
import { deriveFindings, summarizeFindings, type FindingSeverity } from "./findings"
import type { AIAnalysis } from "./ai-analysis"

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

export function formatMarkdownReport(record: ScanRecord, aiAnalysis?: AIAnalysis | null): string {
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

  // AI Analysis -----------------------------------------------------------
  if (aiAnalysis) {
    const VERDICT_ICON: Record<string, string> = {
      confirmed: "🔴",
      likely: "🟠",
      false_positive: "🟢",
      needs_manual: "🟡",
    }

    lines.push(`## AI Analysis`)
    lines.push("")
    lines.push(`**Overall Risk:** ${aiAnalysis.overall_risk.toUpperCase()}`)
    lines.push("")
    lines.push(`### Executive Summary`)
    lines.push("")
    lines.push(aiAnalysis.summary)
    lines.push("")

    if (aiAnalysis.findings.length > 0) {
      lines.push(`### AI Finding Verdicts`)
      lines.push("")
      for (const af of aiAnalysis.findings) {
        const icon = VERDICT_ICON[af.verdict] ?? "⚪"
        lines.push(`#### ${icon} ${af.id} — ${af.verdict.toUpperCase()}`)
        lines.push("")
        lines.push(`- **Reasoning:** ${af.reasoning}`)
        lines.push(`- **Exploitability:** ${af.exploitability}`)
        if (af.poc) {
          lines.push(`- **PoC:**`)
          lines.push("```bash")
          lines.push(af.poc)
          lines.push("```")
        }
        lines.push("")
      }
    }

    if (aiAnalysis.chains.length > 0) {
      lines.push(`### Attack Chains`)
      lines.push("")
      for (const chain of aiAnalysis.chains) {
        lines.push(`#### [${chain.severity.toUpperCase()}] ${chain.title}`)
        lines.push("")
        for (let i = 0; i < chain.steps.length; i++) {
          lines.push(`${i + 1}. ${chain.steps[i]}`)
        }
        lines.push("")
        lines.push(`**Impact:** ${chain.impact}`)
        lines.push("")
      }
    }

    if (aiAnalysis.prioritized_remediations.length > 0) {
      lines.push(`### Prioritized Remediations`)
      lines.push("")
      for (const rem of aiAnalysis.prioritized_remediations) {
        lines.push(`- ${rem}`)
      }
      lines.push("")
    }
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

function buildAiHtmlSection(aiAnalysis?: AIAnalysis | null): string {
  if (!aiAnalysis) return ""

  const VERDICT_COLORS: Record<string, { fg: string }> = {
    confirmed: { fg: "#ff4444" },
    likely: { fg: "#ff8800" },
    false_positive: { fg: "#44aa44" },
    needs_manual: { fg: "#ffcc00" },
  }

  const riskClass = `ai-risk ai-risk-${aiAnalysis.overall_risk}`

  const findingsHtml = aiAnalysis.findings
    .map((af) => {
      const verdictClass = `ai-verdict ai-verdict-${af.verdict}`
      const badgeClass = `verdict-badge verdict-${af.verdict}`
      const vColor = VERDICT_COLORS[af.verdict]?.fg ?? "#888"
      return `
      <div class="${verdictClass}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="${badgeClass}">${escapeHtml(af.verdict.replace("_", " "))}</span>
          <code style="font-size:13px;color:${vColor}">${escapeHtml(af.id)}</code>
        </div>
        <div style="font-size:13px;color:#ccc;margin-bottom:6px"><strong>Reasoning:</strong> ${escapeHtml(af.reasoning)}</div>
        <div style="font-size:13px;color:#aaa;margin-bottom:6px"><strong>Exploitability:</strong> ${escapeHtml(af.exploitability)}</div>
        ${af.poc ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px"><strong>Proof of Concept:</strong></div><div class="poc-block">${escapeHtml(af.poc)}</div>` : ""}
      </div>`
    })
    .join("\n")

  const chainsHtml = aiAnalysis.chains
    .map((chain) => {
      const sevColor = SEV_COLORS[(chain.severity as FindingSeverity)] ?? SEV_COLORS.medium
      return `
      <div class="chain-card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="sev-badge" style="background:${sevColor.border};color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">${escapeHtml(chain.severity)}</span>
          <span style="font-size:14px;font-weight:600">${escapeHtml(chain.title)}</span>
        </div>
        <ol>${chain.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
        <div class="chain-impact"><strong>Impact:</strong> ${escapeHtml(chain.impact)}</div>
      </div>`
    })
    .join("\n")

  const remHtml = aiAnalysis.prioritized_remediations
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("\n")

  return `
  <section>
    <h2>🤖 AI Analysis</h2>
    <div style="margin-bottom:16px">
      <span style="color:var(--muted);font-size:13px;margin-right:8px">Overall Risk:</span>
      <span class="${riskClass}">${escapeHtml(aiAnalysis.overall_risk)}</span>
    </div>
    <div class="ai-summary">${escapeHtml(aiAnalysis.summary)}</div>
  </section>

  ${aiAnalysis.findings.length > 0 ? `
  <section>
    <h2>AI Finding Verdicts</h2>
    ${findingsHtml}
  </section>` : ""}

  ${aiAnalysis.chains.length > 0 ? `
  <section>
    <h2>Attack Chains</h2>
    ${chainsHtml}
  </section>` : ""}

  ${aiAnalysis.prioritized_remediations.length > 0 ? `
  <section>
    <h2>Prioritized Remediations</h2>
    <ol class="rem-list">${remHtml}</ol>
  </section>` : ""}`
}

export function formatHtmlReport(record: ScanRecord, aiAnalysis?: AIAnalysis | null): string {
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
  .ai-risk{display:inline-block;padding:6px 16px;border-radius:6px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
  .ai-risk-critical{background:#2d0a0a;color:#ff4444;border:1px solid #ff4444}
  .ai-risk-high{background:#2d1a0a;color:#ff8800;border:1px solid #ff8800}
  .ai-risk-medium{background:#2d2a0a;color:#ffcc00;border:1px solid #ffcc00}
  .ai-risk-low{background:#0a1a2d;color:#4488ff;border:1px solid #4488ff}
  .ai-summary{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--teal);padding:16px 20px;border-radius:6px;font-size:14px;line-height:1.7;margin:16px 0}
  .ai-verdict{padding:16px 20px;border-radius:6px;margin-bottom:12px}
  .ai-verdict-confirmed{border-left:3px solid #ff4444;background:#2d0a0a}
  .ai-verdict-likely{border-left:3px solid #ff8800;background:#2d1a0a}
  .ai-verdict-false_positive{border-left:3px solid #44aa44;background:#0a2d0a}
  .ai-verdict-needs_manual{border-left:3px solid #ffcc00;background:#2d2a0a}
  .verdict-badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase}
  .verdict-confirmed{background:#ff4444;color:#000}
  .verdict-likely{background:#ff8800;color:#000}
  .verdict-false_positive{background:#44aa44;color:#000}
  .verdict-needs_manual{background:#ffcc00;color:#000}
  .poc-block{background:#0a0a0c;border:1px solid var(--border);border-radius:4px;padding:12px 16px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:8px 0;color:var(--teal)}
  .chain-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:16px 20px;margin-bottom:12px}
  .chain-card ol{list-style:decimal;padding-left:20px;margin:8px 0}
  .chain-card ol li{padding:4px 0;font-size:13px}
  .chain-card ol li::before{content:none}
  .chain-impact{background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);border-radius:4px;padding:8px 12px;font-size:13px;margin-top:8px}
  .rem-list{list-style:none;padding:0;counter-reset:rem}
  .rem-list li{counter-increment:rem;padding:8px 12px;font-size:13px;border-bottom:1px solid var(--border)}
  .rem-list li::before{content:counter(rem) ". ";color:var(--teal);font-weight:700}
  @media print{.ai-risk-critical,.ai-risk-high,.ai-risk-medium,.ai-risk-low{border-width:2px}.ai-verdict{border-left-width:4px}}
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

  ${buildAiHtmlSection(aiAnalysis)}

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
