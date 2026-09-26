import { NextResponse } from "next/server"

export const runtime = "nodejs"

const GATEWAY = process.env.HARBOR_GATEWAY_URL || "http://127.0.0.1:4100"

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const url = new URL(request.url)
  const target = `${GATEWAY}/api/${path.join("/")}${url.search}`
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
