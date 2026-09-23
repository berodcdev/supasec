// Build copy-pasteable curl commands that reproduce a request outside the tool
// (for PoCs / reports). All requests hit PostgREST / the functions gateway with
// the same apikey + Authorization headers.

export function restHeaders(
  apiKey: string,
  token?: string | null,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${token || apiKey}`,
    ...(extra ?? {}),
  }
}

type FilterRow = { column: string; operator: string; value: string }

/** PostgREST filter rows → query params (col=op.value). */
export function filtersToParams(filters: FilterRow[]): Record<string, string> {
  const p: Record<string, string> = {}
  for (const f of filters) {
    if (!f.column || !f.operator) continue
    p[f.column] = `${f.operator}.${f.value}`
  }
  return p
}

export function restUrl(
  projectUrl: string,
  path: string,
  params?: Record<string, string>,
): string {
  const base = `${projectUrl.replace(/\/$/, "")}/rest/v1/${path}`
  const qs = params ? new URLSearchParams(params).toString() : ""
  return qs ? `${base}?${qs}` : base
}

export function functionsUrl(projectUrl: string, name: string): string {
  return `${projectUrl.replace(/\/$/, "")}/functions/v1/${encodeURIComponent(name)}`
}

export function storageUrl(projectUrl: string, path: string): string {
  return `${projectUrl.replace(/\/$/, "")}/storage/v1/${path}`
}

/** Render a curl command. Body is JSON-encoded unless already a string. */
export function toCurl(opts: {
  method?: string
  url: string
  headers?: Record<string, string>
  body?: unknown
}): string {
  const method = (opts.method ?? "GET").toUpperCase()
  const lines = [`curl -X ${method} '${opts.url}'`]
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    lines.push(`-H '${k}: ${v}'`)
  }
  if (opts.body !== undefined && opts.body !== null && opts.body !== "") {
    const body =
      typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)
    // Escape single quotes for the shell.
    lines.push(`--data '${body.replace(/'/g, "'\\''")}'`)
  }
  return lines.join(" \\\n  ")
}
