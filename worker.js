export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/proxy") {
      if (request.method === "OPTIONS") {
        return corsResponse("", 204);
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      try {
        const payload = await request.json();

        const targetUrl = String(payload?.target_url || "").trim();
        if (!targetUrl) {
          return jsonResponse({ error: "target_url is required" }, 400);
        }

        const upstreamMethod = String(payload?.method || "POST").toUpperCase();
        const upstreamHeaders = normalizeHeaders(payload?.headers || {});
        const upstreamBody = buildBody(payload?.body, upstreamHeaders, upstreamMethod);

        const upstream = await fetch(targetUrl, {
          method: upstreamMethod,
          headers: upstreamHeaders,
          body: upstreamBody,
        });

        const respHeaders = new Headers(upstream.headers);
        applyCors(respHeaders);

        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: respHeaders,
        });
      } catch (err) {
        return jsonResponse(
          {
            error: "Proxy error",
            detail: String(err?.message || err),
          },
          502
        );
      }
    }

    if (env?.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse(
      {
        error: "ASSETS binding is missing",
        detail: 'Add "assets": { "directory": "." } to wrangler.jsonc',
      },
      500
    );
  },
};

function normalizeHeaders(input) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(input || {})) {
    const k = String(key || "").toLowerCase();

    if (
      k === "host" ||
      k === "content-length" ||
      k.startsWith("cf-") ||
      k === "connection" ||
      k === "origin" ||
      k === "referer" ||
      k === "sec-fetch-site" ||
      k === "sec-fetch-mode" ||
      k === "sec-fetch-dest"
    ) {
      continue;
    }

    if (value !== undefined && value !== null) {
      headers.set(key, String(value));
    }
  }

  return headers;
}

function buildBody(body, headers, method) {
  if (method === "GET" || method === "HEAD") return undefined;
  if (body === undefined || body === null) return undefined;

  if (typeof body === "string" || body instanceof String) {
    return String(body);
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

function applyCors(headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");
  headers.set("Access-Control-Expose-Headers", "Content-Type");
}

function corsResponse(body, status = 200) {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
  });
  applyCors(headers);
  return new Response(body, { status, headers });
}

function jsonResponse(data, status = 200) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
  });
  applyCors(headers);
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}
