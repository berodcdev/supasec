import type { ScanRecord } from "./scan-history"
import { summarizeFindings, type Finding } from "./findings"

// -- Types ----------------------------------------------------------------

export type AIVerdict = "confirmed" | "likely" | "false_positive" | "needs_manual"

export type AIFinding = {
  id: string
  verdict: AIVerdict
  reasoning: string
  exploitability: string
  poc?: string
}

export type AIChain = {
  title: string
  steps: string[]
  severity: string
  impact: string
}

export type AIAnalysis = {
  summary: string
  findings: AIFinding[]
  chains: AIChain[]
  prioritized_remediations: string[]
  overall_risk: string
}

// -- Config ---------------------------------------------------------------

export type AIConfig = {
  apiKey: string
  model: string
}

const STORAGE_KEY = "supabase-pwn-ai-config"

export function loadAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AIConfig
    if (parsed.apiKey && parsed.model) return parsed
    return null
  } catch {
    return null
  }
}

export function saveAIConfig(config: AIConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // localStorage unavailable
  }
}

// -- Popular OpenRouter models --------------------------------------------

export type ModelTier = "premium" | "fast" | "value"

export type AIModel = {
  id: string
  label: string
  provider: string
  tier: ModelTier
  recommended?: boolean
  description: string
  context: string
}

export const AI_MODELS: AIModel[] = [
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    tier: "fast",
    recommended: true,
    description: "Best balance of speed and reasoning for security analysis",
    context: "200K",
  },
  {
    id: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    provider: "Anthropic",
    tier: "premium",
    description: "Deepest reasoning — best for complex attack chain analysis",
    context: "200K",
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    provider: "OpenAI",
    tier: "fast",
    description: "Strong general-purpose model with good security knowledge",
    context: "1M",
  },
  {
    id: "openai/o3",
    label: "o3",
    provider: "OpenAI",
    tier: "premium",
    description: "Extended thinking model — thorough but slower",
    context: "200K",
  },
  {
    id: "openai/o4-mini",
    label: "o4-mini",
    provider: "OpenAI",
    tier: "fast",
    description: "Compact reasoning model — fast and cost-effective",
    context: "200K",
  },
  {
    id: "google/gemini-2.5-pro-preview",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    tier: "premium",
    recommended: true,
    description: "Massive context window — ideal for large scan payloads",
    context: "1M",
  },
  {
    id: "google/gemini-2.5-flash-preview",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    tier: "fast",
    description: "Ultra-fast with strong reasoning capabilities",
    context: "1M",
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    provider: "DeepSeek",
    tier: "value",
    description: "Chain-of-thought reasoning at extremely low cost",
    context: "64K",
  },
  {
    id: "meta-llama/llama-4-maverick",
    label: "Llama 4 Maverick",
    provider: "Meta",
    tier: "value",
    description: "Open-source powerhouse — great value for basic analysis",
    context: "1M",
  },
]

// -- Prompt builder -------------------------------------------------------

export function buildAnalysisPayload(record: ScanRecord, findings: Finding[]) {
  const counts = summarizeFindings(findings)

  const systemPrompt = `You are an expert Supabase & PostgreSQL security auditor. You receive the raw output of an automated security scan (AutoPwn) against a Supabase project and the findings engine's initial triage.

Your job:
1. VALIDATE each finding — confirm, mark as likely, flag as false positive, or flag for manual review. Explain WHY concisely.
2. Identify ATTACK CHAINS — sequences of findings that combine into bigger exploits (e.g. open signup + exposed users table + writable profiles = account takeover). Only include chains that are realistic given the actual scan data.
3. For confirmed/likely findings, write a concrete PROOF OF CONCEPT as a curl command that can be copy-pasted and run. Use the actual project URL and key from the scan data. Include the exact endpoint, headers, and body.
4. PRIORITIZE remediations — what to fix first based on real risk, not just severity labels. Be specific: name the table/bucket/function.
5. Give an OVERALL RISK assessment (critical / high / medium / low) with a one-paragraph executive summary a CISO would read.

Supabase-specific context you MUST consider:
- Row Level Security (RLS): tables without RLS or with "USING (true)" are fully exposed. A 200 OK with 0 rows may mean RLS is filtering or the table is empty — that's NOT the same as "denied". An empty table is low-risk.
- Key types: "anon" and "publishable" keys represent what any browser visitor can do — these are the most impactful findings. "service_role" and "secret" keys bypass RLS — findings with these are expected behavior for admin keys, and only critical if the key itself was leaked to the client.
- PostgREST: Supabase REST API follows PostgREST conventions. Endpoints: /rest/v1/{table}. Headers: apikey, Authorization: Bearer {key}. Query params: select, order, limit, and vertical filtering.
- Storage: /storage/v1/object/list/{bucket} for listing; /storage/v1/object/public/{bucket}/{path} for downloads. Public buckets serve files to anyone. Listable + public = full directory enumeration + download.
- Auth: /auth/v1/signup, /auth/v1/token?grant_type=password. Open signup + exposed PII tables = account takeover chain.
- Edge Functions: /functions/v1/{name}. Reachability alone is informational. Unauthed functions that return data or modify state are high/critical.
- Sample data: when a table's sample row is included, analyze the actual values for leaked secrets (JWTs, API keys, passwords, PII).

Respond in valid JSON matching this schema exactly:
{
  "summary": "executive summary paragraph",
  "findings": [
    {
      "id": "finding id from the input",
      "verdict": "confirmed | likely | false_positive | needs_manual",
      "reasoning": "why this verdict",
      "exploitability": "how easily an attacker can exploit this",
      "poc": "curl command (optional, omit for false_positive and info-level)"
    }
  ],
  "chains": [
    {
      "title": "chain name",
      "steps": ["step 1", "step 2"],
      "severity": "critical | high | medium | low",
      "impact": "what the attacker gains"
    }
  ],
  "prioritized_remediations": [
    "1. Fix X first because...",
    "2. Then fix Y..."
  ],
  "overall_risk": "critical | high | medium | low"
}

IMPORTANT: Return raw JSON only, no markdown fences, no commentary outside the JSON.`

  const scanData = {
    projectUrl: record.projectUrl,
    keyType: record.keyType,
    timestamp: record.timestamp,
    summary: {
      ...counts,
      totalTables: record.db.length,
      tablesExposed: record.db.filter((r) => r.select === "allowed").length,
      tablesWritable: record.db.filter((r) => r.insert === "allowed").length,
      totalBuckets: record.storage.length,
      bucketsPublic: record.storage.filter((r) => r.public).length,
      bucketsListable: record.storage.filter((r) => r.listable === "allowed").length,
      authFeaturesOpen: record.auth.filter((r) => r.status === "enabled").length,
      functionsFound: record.functions.filter((r) => r.status === "found").length,
    },
    database: record.db.map((r) => ({
      table: r.name,
      select: r.select,
      insert: r.insert,
      update: r.update,
      delete: r.delete,
      rowCount: r.rowCount,
      colCount: r.colCount,
      columns: r.columns,
      sample: r.sample,
    })),
    storage: record.storage,
    auth: record.auth,
    functions: record.functions,
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      evidence: f.evidence,
      remediation: f.remediation,
      target: f.target,
    })),
  }

  return {
    system: systemPrompt,
    user: `Analyze this Supabase security scan:\n\n${JSON.stringify(scanData, null, 2)}`,
  }
}

// -- Single-finding deep-dive prompt --------------------------------------

export type AIDeepDive = {
  verdict: AIVerdict
  detailed_reasoning: string
  exploitability: string
  attack_scenarios: string[]
  poc: string
  remediation_steps: string[]
}

export function buildDeepDivePayload(
  finding: Finding,
  record: ScanRecord,
) {
  const table = record.db.find((r) => r.name === finding.target)

  const systemPrompt = `You are an expert Supabase & PostgreSQL security auditor. You are given a SINGLE finding from an automated scan and asked to perform a deep-dive analysis.

Provide:
1. VERDICT: confirmed, likely, false_positive, or needs_manual
2. DETAILED REASONING: thorough explanation of why this is or isn't exploitable
3. EXPLOITABILITY: how easy is it for an attacker — consider skill level, access requirements, and preconditions
4. ATTACK SCENARIOS: 2-3 concrete scenarios where this could be exploited in a real app
5. PROOF OF CONCEPT: a complete, copy-pasteable curl command using the actual project URL and key
6. REMEDIATION STEPS: numbered steps to fix this, specific to Supabase (SQL, dashboard settings, RLS policies)

Use the project URL "${record.projectUrl}" and key type "${record.keyType}" in your PoC.

Respond in valid JSON:
{
  "verdict": "confirmed | likely | false_positive | needs_manual",
  "detailed_reasoning": "thorough explanation",
  "exploitability": "ease of exploitation",
  "attack_scenarios": ["scenario 1", "scenario 2"],
  "poc": "curl command",
  "remediation_steps": ["1. Do X", "2. Then Y"]
}

Return raw JSON only, no markdown fences.`

  const findingData = {
    ...finding,
    tableDetails: table ? {
      rowCount: table.rowCount,
      colCount: table.colCount,
      columns: table.columns,
      sample: table.sample,
      permissions: {
        select: table.select,
        insert: table.insert,
        update: table.update,
        delete: table.delete,
      },
    } : undefined,
  }

  return {
    system: systemPrompt,
    user: `Deep-dive analysis for this finding:\n\n${JSON.stringify(findingData, null, 2)}`,
  }
}

export function parseDeepDiveResponse(text: string): AIDeepDive {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }
  const parsed = JSON.parse(cleaned) as AIDeepDive
  if (!parsed.detailed_reasoning) throw new Error("Invalid deep-dive response")
  if (!Array.isArray(parsed.attack_scenarios)) parsed.attack_scenarios = []
  if (!Array.isArray(parsed.remediation_steps)) parsed.remediation_steps = []
  const validVerdicts = new Set(["confirmed", "likely", "false_positive", "needs_manual"])
  if (!validVerdicts.has(parsed.verdict)) parsed.verdict = "needs_manual"
  return parsed
}

// -- Response parser ------------------------------------------------------

export function parseAIResponse(text: string): AIAnalysis {
  let cleaned = text.trim()

  // Strip markdown fences some models add despite the instruction
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")

  // Some models prepend thinking/commentary before the JSON — find the first `{`
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  const parsed = JSON.parse(cleaned) as AIAnalysis

  if (!parsed.summary || !Array.isArray(parsed.findings)) {
    throw new Error("Invalid AI response structure — missing summary or findings array")
  }

  // Normalize missing arrays
  if (!Array.isArray(parsed.chains)) parsed.chains = []
  if (!Array.isArray(parsed.prioritized_remediations)) parsed.prioritized_remediations = []
  if (!parsed.overall_risk) parsed.overall_risk = "medium"

  // Normalize verdicts
  const validVerdicts = new Set(["confirmed", "likely", "false_positive", "needs_manual"])
  for (const f of parsed.findings) {
    if (!validVerdicts.has(f.verdict)) f.verdict = "needs_manual"
  }

  return parsed
}
