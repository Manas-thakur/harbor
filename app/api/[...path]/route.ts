import { NextResponse } from "next/server"

export const runtime = "nodejs"

const GATEWAY = process.env.HARBOR_GATEWAY_URL || "http://127.0.0.1:4100"

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params
  const url = new URL(request.url)
  if (process.env.VERCEL) {
    process.env.HARBOR_INPROCESS = "1"
    process.env.HARBOR_DATA_DIR = process.env.HARBOR_DATA_DIR || "/tmp/harbor"
    const { handle } = await import("@/services/gateway/server.mjs")
    const bodyText = request.method === "GET" || request.method === "HEAD" ? "" : await request.text()
    const result = await handle(
      { method: request.method, headers: { cookie: request.headers.get("cookie") ?? "" } },
      new URL(`/api/${parts.join("/")}${url.search}`, "http://inprocess"),
      bodyText ? JSON.parse(bodyText) : {}
    )
    const next = new NextResponse(JSON.stringify(result.body ?? {}), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    })
    if (result.headers?.["set-cookie"]) next.headers.append("set-cookie", result.headers["set-cookie"])
    return next
  }
  const target = `${GATEWAY}/api/${parts.join("/")}${url.search}`
  const headers = new Headers(request.headers)
  headers.delete("host")
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  })
  const next = new NextResponse(await response.arrayBuffer(), { status: response.status })
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return
    next.headers.set(key, value)
  })
  for (const cookie of response.headers.getSetCookie()) next.headers.append("set-cookie", cookie)
  return next
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
