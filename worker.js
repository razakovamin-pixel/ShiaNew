export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/proxy") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      try {
        const payload = await request.json();

        const upstream = await fetch("https://smartapi.shop/backend/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer sk-smart-l92WNQWk9YT8J16-WrGlqUfsPOAb_VPlZHOZgEr3Mac"
          },
          body: JSON.stringify({
            model: payload.model || "deepseek-v4-flash",
            messages: payload.messages || [],
            temperature: payload.temperature ?? 0.7,
            max_tokens: payload.max_tokens ?? 2048,
            stream: false
          })
        });

        const headers = corsHeaders();
        const contentType = upstream.headers.get("content-type");
        if (contentType) headers["Content-Type"] = contentType;

        return new Response(upstream.body, {
          status: upstream.status,
          headers
        });
      } catch (error) {
        return jsonResponse({
          error: "Proxy error",
          detail: String(error?.message || error)
        }, 502);
      }
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return assetResponse;
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
