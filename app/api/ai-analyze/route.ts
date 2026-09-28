import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let body: {
    apiKey?: string
    model?: string
    system?: string
    user?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { apiKey, model, system, user } = body

  if (!apiKey || !model || !system || !user) {
    return NextResponse.json(
      { error: "Missing required fields: apiKey, model, system, user" },
      { status: 400 },
    )
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "supasec",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })

  if (!upstream.ok) {
    const errBody = await upstream.text().catch(() => "")
    let errorMsg = `OpenRouter returned ${upstream.status}`
    try {
      const parsed = JSON.parse(errBody) as { error?: { message?: string } }
      if (parsed.error?.message) errorMsg = parsed.error.message
    } catch {
      if (errBody) errorMsg = errBody.slice(0, 200)
    }
    return NextResponse.json({ error: errorMsg }, { status: upstream.status })
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "No response stream from OpenRouter" }, { status: 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
