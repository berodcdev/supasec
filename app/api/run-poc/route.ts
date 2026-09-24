import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_BODY = 64 * 1024
const TIMEOUT_MS = 15_000

export async function POST(req: NextRequest) {
  let body: {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { url, method = "GET", headers = {}, body: reqBody } = body

  if (!url) {
    return NextResponse.json({ error: "Missing required field: url" }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!parsed.hostname.endsWith(".supabase.co") && !parsed.hostname.endsWith(".supabase.in")) {
    return NextResponse.json(
      { error: "Only Supabase project URLs are allowed" },
      { status: 403 },
    )
  }

  const allowedMethods = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"])
  const upper = method.toUpperCase()
  if (!allowedMethods.has(upper)) {
    return NextResponse.json({ error: `Method not allowed: ${method}` }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const fetchOpts: RequestInit = {
      method: upper,
      headers,
      signal: controller.signal,
    }

    if (reqBody && upper !== "GET" && upper !== "HEAD") {
      fetchOpts.body = reqBody
      if (reqBody.length > MAX_BODY) {
        clearTimeout(timer)
        return NextResponse.json({ error: "Request body too large" }, { status: 413 })
      }
    }

    const upstream = await fetch(url, fetchOpts)
    clearTimeout(timer)

    const text = await upstream.text()

    return NextResponse.json({
      status: upstream.status,
      statusText: upstream.statusText,
      headers: Object.fromEntries(
        [...upstream.headers.entries()].filter(([k]) =>
          ["content-type", "x-total-count", "content-range", "x-pgrst-version"].includes(k.toLowerCase()),
        ),
      ),
      body: text.slice(0, MAX_BODY),
      truncated: text.length > MAX_BODY,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed"
    if (msg.includes("abort")) {
      return NextResponse.json({ error: `Request timed out after ${TIMEOUT_MS / 1000}s` }, { status: 504 })
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
