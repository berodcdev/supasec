export type ParsedCurl = {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export function parseCurl(cmd: string): ParsedCurl | null {
  const cleaned = cmd
    .replace(/\\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned.startsWith("curl")) return null

  const tokens: string[] = []
  let current = ""
  let inSingle = false
  let inDouble = false
  let escaped = false

  for (const ch of cleaned) {
    if (escaped) {
      current += ch
      escaped = false
      continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      continue
    }
    if (ch === " " && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)

  let url = ""
  let method = "GET"
  const headers: Record<string, string> = {}
  let body: string | undefined

  let i = 1
  while (i < tokens.length) {
    const t = tokens[i]

    if (t === "-X" || t === "--request") {
      method = tokens[++i]?.toUpperCase() ?? "GET"
    } else if (t === "-H" || t === "--header") {
      const hdr = tokens[++i] ?? ""
      const colon = hdr.indexOf(":")
      if (colon > 0) {
        headers[hdr.slice(0, colon).trim()] = hdr.slice(colon + 1).trim()
      }
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary") {
      body = tokens[++i] ?? ""
      if (method === "GET") method = "POST"
    } else if (t.startsWith("-")) {
      // skip unknown flags and their values if they look like they take one
      if (!t.startsWith("--") && t.length === 2 && i + 1 < tokens.length && !tokens[i + 1].startsWith("-")) {
        i++
      }
    } else if (!url) {
      url = t
    }

    i++
  }

  if (!url) return null

  return { url, method, headers, body }
}
