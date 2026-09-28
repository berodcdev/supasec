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

const STORAGE_KEY = "supasec-ai-config"

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

export function buildAnalysisPayload(record: ScanRecord, findings: Finding[], supabaseKey?: string) {
  const counts = summarizeFindings(findings)
  const keyVal = supabaseKey || `YOUR_${record.keyType.toUpperCase()}_KEY`

  const systemPrompt = `You are a senior penetration tester specializing in Supabase, PostgREST, and cloud-native PostgreSQL infrastructure. You operate in a red team engagement context — your role is to think like an attacker, not a compliance auditor.

You receive raw output from AutoPwn, an automated Supabase security scanner, plus the scanner's initial findings triage. The scan was performed with a "${record.keyType}" API key, which means ${record.keyType === "anon" || record.keyType === "publishable" ? "this represents the attack surface visible to ANY unauthenticated browser visitor — every confirmed finding is externally exploitable without credentials" : record.keyType === "service_role" || record.keyType === "secret" ? "this is a PRIVILEGED key that bypasses RLS by design — findings here are expected behavior UNLESS the key itself was leaked to the client-side (check the scan context for how the key was obtained)" : "the privilege level of this key is unclear — assess each finding conservatively"}.

## YOUR OBJECTIVES

### 1. VALIDATE findings — think adversarially
For each finding, determine: could a real attacker exploit this RIGHT NOW with just a browser and the information in this scan?
- "confirmed": the scan data proves exploitability (e.g. SELECT returned rows with anon key = data leak is real)
- "likely": the scan suggests exploitability but you'd need one more step to confirm (e.g. INSERT returned 200 but we didn't verify the row was created)
- "false_positive": the finding is noise — explain specifically why (e.g. "service_role key bypasses RLS by design, this is expected")
- "needs_manual": automated analysis is insufficient — describe exactly what a human tester should check

Be ruthless about false positives. An empty table with RLS returning 0 rows is NOT a vulnerability — it means RLS is working. A reachable edge function is NOT a finding unless it leaks data or accepts unauthorized writes. Don't inflate severity to look thorough.

### 2. IDENTIFY attack chains — the real danger
Individual findings are often low-impact. The critical question is: what can an attacker CHAIN together?
Common Supabase chains:
- Open signup + exposed users table + writable profiles = account takeover / privilege escalation
- Public + listable storage bucket + sensitive filenames = data exfiltration
- Exposed table with JWTs or API keys in values = lateral movement / full compromise
- GraphQL introspection + INSERT/DELETE mutations + no RLS = full CRUD on the database via an alternative path
- Realtime subscription open on RLS-blocked tables = data leak bypass (attacker subscribes and waits for changes)
- Writable table + no input validation = stored XSS / SQL injection via PostgREST

Only include chains that are REALISTIC given the actual scan data. Don't invent hypothetical chains.

### 3. WRITE proof-of-concept commands
For every confirmed or likely finding, produce a complete, copy-pasteable curl command that PROVES the vulnerability. Use the ACTUAL project URL and API key from the scan data.

The API key for all PoCs is: ${keyVal}

PostgREST patterns:
  curl -s "${record.projectUrl}/rest/v1/{table}?select=*&limit=5" -H "apikey: ${keyVal}" -H "Authorization: Bearer ${keyVal}"
  curl -s -X POST "${record.projectUrl}/rest/v1/{table}" -H "apikey: ${keyVal}" -H "Authorization: Bearer ${keyVal}" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"col":"value"}'

Storage patterns:
  curl -s "${record.projectUrl}/storage/v1/object/list/{bucket}" -H "apikey: ${keyVal}" -H "Authorization: Bearer ${keyVal}" -H "Content-Type: application/json" -d '{"prefix":"","limit":100}'
  curl -s "${record.projectUrl}/storage/v1/object/public/{bucket}/{path}"

Auth patterns:
  curl -s -X POST "${record.projectUrl}/auth/v1/signup" -H "apikey: ${keyVal}" -H "Content-Type: application/json" -d '{"email":"test@evil.com","password":"Test1234!"}'

GraphQL patterns:
  curl -s -X POST "${record.projectUrl}/graphql/v1" -H "apikey: ${keyVal}" -H "Authorization: Bearer ${keyVal}" -H "Content-Type: application/json" -d '{"query":"{ {collection}Collection(first:5) { edges { node { id } } } }"}'

Replace {table}, {bucket}, {path}, {collection} with actual names from the scan data.

### 4. PRIORITIZE remediations — by real-world impact
Order by what an attacker would exploit FIRST, not by CVSS-like severity. A writable users table is more urgent than an exposed empty config table, even if both are "critical" by label.
For each remediation, give the EXACT Supabase action: the SQL to run, the dashboard setting to change, or the RLS policy to add. Generic advice like "enable RLS" is worthless — give the specific ALTER TABLE and CREATE POLICY statements with actual table names.

### 5. EXECUTIVE SUMMARY — for the person who owns this project
Write a single paragraph that answers: "How bad is it, what's the worst thing an attacker can do right now, and what's the #1 thing I should fix immediately?" This should be direct, specific, and avoid security jargon where possible.

## RESPONSE FORMAT

Return valid JSON matching this schema EXACTLY. No markdown fences, no commentary, no preamble:
{
  "summary": "executive summary paragraph — direct, specific, no jargon",
  "findings": [
    {
      "id": "finding id from the input (must match exactly)",
      "verdict": "confirmed | likely | false_positive | needs_manual",
      "reasoning": "concise adversarial reasoning — think like an attacker",
      "exploitability": "skill level + access required + preconditions",
      "poc": "complete curl command (omit only for false_positive or info-level)"
    }
  ],
  "chains": [
    {
      "title": "descriptive chain name",
      "steps": ["step 1 with specific table/resource names", "step 2", "step 3"],
      "severity": "critical | high | medium | low",
      "impact": "what the attacker walks away with — be concrete"
    }
  ],
  "prioritized_remediations": [
    "1. [URGENT] Fix X: exact SQL or dashboard action because...",
    "2. Fix Y: exact SQL or dashboard action because..."
  ],
  "overall_risk": "critical | high | medium | low"
}`

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
      realtimeOpen: record.realtime?.filter((r) => r.subscribed).length ?? 0,
      graphqlAvailable: record.graphql?.available ?? false,
      graphqlMutations: record.graphql?.mutations ?? 0,
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
    realtime: record.realtime ?? [],
    graphql: record.graphql ?? null,
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
  supabaseKey?: string,
) {
  const table = record.db.find((r) => r.name === finding.target)

  const tableContext = table ? `
Target resource details:
- Table: "${finding.target}"
- Rows: ${table.rowCount ?? "unknown"}, Columns: ${table.colCount ?? "unknown"}
- Column names: ${table.columns?.join(", ") ?? "unknown"}
- Permissions: SELECT=${table.select}, INSERT=${table.insert}, UPDATE=${table.update}, DELETE=${table.delete}
- Sample data available: ${table.sample ? "yes" : "no"}` : ""

  const bucketContext = (() => {
    const bucket = record.storage.find((b) => b.name === finding.target)
    if (!bucket) return ""
    return `
Target resource details:
- Bucket: "${finding.target}"
- Public: ${bucket.public}
- Listable: ${bucket.listable}
- File count: ${bucket.fileCount ?? "unknown"}`
  })()

  const keyVal = supabaseKey || `YOUR_${record.keyType.toUpperCase()}_KEY`

  const systemPrompt = `You are a senior red team operator performing a targeted deep-dive on a single security finding from a Supabase project. This is NOT a general audit — you are drilling into one specific vulnerability to determine its real-world exploitability.

## CONTEXT
- Project URL: ${record.projectUrl}
- API Key (${record.keyType}): ${keyVal}
- Key privilege: ${record.keyType === "anon" || record.keyType === "publishable" ? "this is what ANY unauthenticated visitor can use — if this works, it's externally exploitable" : record.keyType === "service_role" || record.keyType === "secret" ? "privileged key — expected to bypass security controls. Only critical if this key was exposed client-side" : "unknown privilege level — assess conservatively"}${tableContext}${bucketContext}

## YOUR TASK

### 1. VERDICT — be definitive
Don't hedge. Based on the scan evidence:
- "confirmed": the data proves this is exploitable (rows returned, write succeeded, files listed)
- "likely": strong indicators but one more step needed to prove it (e.g. INSERT returned 201 but we didn't read back)
- "false_positive": this is noise — explain exactly why (e.g. "0 rows returned means RLS is blocking, not that data is exposed", or "service_role key is expected to bypass RLS")
- "needs_manual": you genuinely can't determine from the data — specify exactly what a human should test

### 2. DETAILED REASONING — think like an attacker
Walk through the exploitation logic step by step. What does the attacker see? What do they try? What works and what doesn't? Reference the actual scan data — don't speak in generalities.

If this is a false positive, explain specifically what the scanner got wrong and why this doesn't represent a real risk.

### 3. EXPLOITABILITY — realistic assessment
Rate on three axes:
- Skill: script kiddie / intermediate / advanced / expert
- Access: unauthenticated / requires signup / requires valid session / requires admin
- Preconditions: what else must be true for this to work (e.g. "table must contain sensitive data", "user must have uploaded files")

### 4. ATTACK SCENARIOS — concrete, not theoretical
Give 2-3 scenarios where a real attacker would exploit this in production. Each scenario should:
- Name the attacker (opportunistic scanner, targeted attacker, insider, automated bot)
- Describe what they'd do step by step with this specific table/bucket/endpoint
- State what they'd gain (PII, credentials, ability to modify data, privilege escalation)
Don't include scenarios that require conditions not present in the scan data.

### 5. PROOF OF CONCEPT — copy-paste ready
Write a complete curl command that demonstrates the vulnerability. It must:
- Use the actual project URL: ${record.projectUrl}
- Use the API key: ${keyVal}
- Target the actual resource: ${finding.target || "the specific endpoint"}
- Be copy-pasteable directly into a terminal
- Include expected output description as a comment

For different finding types:
- Data exposure: curl that reads the data
- Write access: curl that inserts/updates a test record (use obviously-fake test data)
- Storage: curl that lists or downloads files
- Auth: curl that tests the auth endpoint
- GraphQL: curl with the specific query/mutation

### 6. REMEDIATION — exact commands, not advice
Give numbered steps with the EXACT SQL, CLI command, or dashboard path. Examples:
- "ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;"
- "CREATE POLICY \\"read_own\\" ON public.{table} FOR SELECT USING (auth.uid() = user_id);"
- "UPDATE storage.buckets SET public = false WHERE name = '{bucket}';"
- "Dashboard → Authentication → Providers → disable email signup"
Don't say "enable RLS" — give the ALTER TABLE. Don't say "add a policy" — give the CREATE POLICY with realistic column references based on the table's actual columns.

## RESPONSE FORMAT

Return valid JSON, no markdown fences, no preamble:
{
  "verdict": "confirmed | likely | false_positive | needs_manual",
  "detailed_reasoning": "step-by-step adversarial analysis referencing actual scan data",
  "exploitability": "skill level + access required + preconditions — one paragraph",
  "attack_scenarios": ["Scenario 1: ...", "Scenario 2: ...", "Scenario 3: ..."],
  "poc": "complete curl command with actual URLs, keys, and resource names",
  "remediation_steps": ["1. exact SQL or command", "2. exact SQL or command", "3. verify with: curl ..."]
}`

  const bucket = record.storage.find((b) => b.name === finding.target)
  const authFeature = record.auth.find((a) => a.feature === finding.target)
  const edgeFunction = record.functions.find((f) => f.name === finding.target)

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
    bucketDetails: bucket ?? undefined,
    authDetails: authFeature ?? undefined,
    functionDetails: edgeFunction ?? undefined,
    scanContext: {
      keyType: record.keyType,
      totalTablesExposed: record.db.filter((r) => r.select === "allowed").length,
      totalTablesWritable: record.db.filter((r) => r.insert === "allowed").length,
      totalBucketsPublic: record.storage.filter((r) => r.public).length,
    },
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
