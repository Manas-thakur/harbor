import http from "node:http"

export const INTERNAL = process.env.HARBOR_INTERNAL_TOKEN || "harbor-dev-internal"

export function listen(name, port, handler) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`)
      if (url.pathname !== "/health" && req.headers["x-harbor-internal"] !== INTERNAL) {
        send(res, 401, { error: "This service only accepts calls from the Harbor gateway." })
        return
      }
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const raw = Buffer.concat(chunks).toString("utf8")
      const body = raw ? JSON.parse(raw) : {}
      const result = await handler({ method: req.method || "GET", url, body, headers: req.headers })
      send(res, result.status ?? 200, result.body ?? {}, result.headers)
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : "Service error" })
    }
  })
  server.listen(port, "127.0.0.1", () => {
    console.log(`${name} listening on ${port}`)
  })
  return server
}

export function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { "content-type": "application/json", ...headers })
  res.end(payload)
}

export async function call(port, path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      "x-harbor-internal": INTERNAL,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json()
  return { status: response.status, body: payload }
}
