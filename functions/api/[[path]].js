// Cloudflare Pages Function
// Перехватывает все запросы вида /api/* и пересылает их на
// https://smartapi.shop/backend/* СО СТОРОНЫ СЕРВЕРА.
// Браузер обращается к своему же домену (Pages), поэтому CORS не применяется —
// ограничения CORS касаются только запросов "браузер -> чужой домен".

const TARGET_BASE = 'https://smartapi.shop/backend';

// Если smartapi.shop требует секретный ключ/токен, добавьте его в переменные
// окружения проекта в Cloudflare Pages (Settings -> Environment variables),
// например SMARTAPI_KEY, и подставьте сюда — он останется на сервере и
// никогда не попадёт в код браузера.
export async function onRequest(context) {
  const { request, params, env } = context;
  const url = new URL(request.url);

  const pathParts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const targetUrl = `${TARGET_BASE}/${pathParts.join('/')}${url.search}`;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version',
  };

  // Ответ на preflight-запрос
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Копируем заголовки запроса, убирая те, что относятся к исходному хосту
  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (!['host', 'content-length', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-proto'].includes(k)) {
      forwardHeaders.set(key, value);
    }
  });

  // Если используется секретный ключ из переменных окружения — раскомментируйте:
  // if (env.SMARTAPI_KEY) forwardHeaders.set('Authorization', `Bearer ${env.SMARTAPI_KEY}`);

  const init = {
    method: request.method,
    headers: forwardHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
  };

  try {
    const upstream = await fetch(targetUrl, init);
    const respHeaders = new Headers(upstream.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
