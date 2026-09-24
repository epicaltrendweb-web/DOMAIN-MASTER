// src/lib/worker-code.ts
// Shared Worker code generator — produces Cloudflare Worker JS code based on
// the user's chosen content type and body.
//
// Content types supported:
//   - "placeholder": default nice HTML "domain active" page
//   - "html":        serve user-provided HTML
//   - "redirect":    302 redirect to user-provided URL
//   - "proxy":        reverse proxy to user-provided URL (mirror another site)
//   - "json":        serve user-provided JSON
//   - "text":        serve user-provided plain text
//
// All Workers also expose ?json=1 for programmatic verification by DOMAIN-MASTER.

const RUNTIME_JSON = `const JSON_RESP = JSON.stringify({
    ok: true,
    deployedBy: "DOMAIN-MASTER",
    deployedAt: new Date().toISOString(),
    message: "Worker active"
  }, null, 2);`;

function escapeForTemplateLiteral(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function shell(body: string, runtimeFetch = ''): string {
  return [
    '// Auto-deployed by DOMAIN-MASTER',
    '// Free .dev subdomain on the REAL .dev TLD via Cloudflare Workers',
    '',
    runtimeFetch,
    '',
    RUNTIME_JSON,
    '',
    'export default {',
    '  async fetch(request, env, ctx) {',
    '    const url = new URL(request.url);',
    '    if (url.searchParams.get("json") === "1") {',
    '      return new Response(JSON_RESP, {',
    '        headers: { "content-type": "application/json", "access-control-allow-origin": "*" }',
    '      });',
    '    }',
    body,
    '  }',
    '};',
  ].join('\n');
}

function defaultPlaceholderHtml(workerName: string): string {
  const sub = process.env.CF_SUBDOMAIN || "epicaltrendweb";
  const fullDomain = `${workerName}.${sub}.workers.dev`;
  // Use the existing pretty HTML (matches favicon branding)
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${fullDomain} — dominio activo</title>`,
    `  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2310b981'/%3E%3Ccircle cx='13' cy='13' r='7' fill='%23fff'/%3E%3Ccircle cx='13' cy='13' r='2.4' fill='%23059669'/%3E%3Cline x1='18' y1='18' x2='26.5' y2='26.5' stroke='%23fff' stroke-width='3.4' stroke-linecap='round'/%3E%3C/svg%3E">`,
    '  <style>',
    '    * { box-sizing: border-box; margin: 0; padding: 0; }',
    '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%); color: #1e293b; padding: 1.5rem; }',
    '    .card { max-width: 480px; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(16,185,129,0.10); border: 2px solid #d1fae5; text-align: center; }',
    '    .logo { width: 56px; height: 56px; margin: 0 auto 1rem; display: block; }',
    '    .badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; }',
    '    h1 { font-size: 1.5rem; font-weight: 700; color: #064e3b; margin-bottom: 0.5rem; word-break: break-all; font-family: ui-monospace, Menlo, monospace; }',
    '    p { color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 1rem; }',
    '    .meta { background: #f8fafc; border-radius: 8px; padding: 0.75rem 1rem; font-size: 12px; color: #64748b; margin-bottom: 1.25rem; font-family: ui-monospace, Menlo, monospace; text-align: left; }',
    '    .meta div { display: flex; justify-content: space-between; margin: 2px 0; }',
    '    .cta { display: inline-block; background: #059669; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; }',
    '    .footer { margin-top: 1.5rem; font-size: 11px; color: #94a3b8; }',
    '    .footer a { color: #059669; text-decoration: none; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="card">',
    '    <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    '      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>',
    '      <rect width="32" height="32" rx="7" fill="url(#bg)"/>',
    '      <circle cx="13" cy="13" r="7" fill="#fff"/>',
    '      <circle cx="13" cy="13" r="7" fill="none" stroke="#059669" stroke-width="1.4"/>',
    '      <circle cx="13" cy="13" r="2.4" fill="#059669"/>',
    '      <line x1="18" y1="18" x2="26.5" y2="26.5" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>',
    '    </svg>',
    '    <div class="badge">★ .dev · gratis · para siempre</div>',
    `    <h1>${fullDomain}</h1>`,
    '    <p>Tu subdominio está activo en el TLD <strong>.dev</strong> real. Permanente, con HTTPS, CDN global, gratis para siempre.</p>',
    '    <div class="meta">',
    '      <div><b>TLD</b><span>.dev (Google Registry)</span></div>',
    '      <div><b>Hosting</b><span>Cloudflare Workers</span></div>',
    '      <div><b>HTTPS</b><span>✓ automático</span></div>',
    '      <div><b>CDN</b><span>✓ global</span></div>',
    '      <div><b>Requests/día</b><span>100k gratis</span></div>',
    '    </div>',
    '    <a class="cta" href="https://dash.cloudflare.com" target="_blank" rel="noopener">Editar Worker en Cloudflare →</a>',
    '    <div class="footer">Deployado por <a href="https://github.com/epicaltrendweb-web/DOMAIN-MASTER" target="_blank" rel="noopener">DOMAIN-MASTER</a></div>',
    '  </div>',
    '</body>',
    '</html>',
  ].join('\n');
}

export type ContentType = "placeholder" | "html" | "redirect" | "proxy" | "json" | "text";

export function generateWorkerCode(workerName: string, contentType: ContentType, contentBody?: string): string {
  switch (contentType) {
    case "placeholder":
    case "html": {
      const html = contentBody && contentBody.trim() ? contentBody : defaultPlaceholderHtml(workerName);
      const escaped = escapeForTemplateLiteral(html);
      return shell(
        `    const HTML = \`${escaped}\`;\n    return new Response(HTML, {\n      headers: { "content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*" }\n    });`
      );
    }
    case "redirect": {
      // contentBody = target URL (e.g. "https://example.com")
      const target = (contentBody || "https://example.com").trim().replace(/"/g, '\\"');
      return shell(
        `    return Response.redirect("${target}", 302);`
      );
    }
    case "proxy": {
      // contentBody = base URL to proxy to (e.g. "https://example.com")
      // Forwards path + query + method + headers, returns the upstream response
      const target = (contentBody || "https://example.com").trim().replace(/"/g, '\\"').replace(/\/+$/, "");
      const proxyCode = `const PROXY_BASE = "${target}";`;
      return shell(
        `    // Reverse proxy: forward this request to ${target} and return response
    const upstreamUrl = PROXY_BASE + url.pathname + url.search;
    try {
      const init = {
        method: request.method,
        headers: request.headers,
        redirect: "follow",
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.text();
      }
      const upstream = await fetch(upstreamUrl, init);
      const respHeaders = new Headers(upstream.headers);
      respHeaders.set("access-control-allow-origin", "*");
      respHeaders.set("x-proxied-by", "DOMAIN-MASTER");
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders,
      });
    } catch (e) {
      return new Response("Proxy error: " + e.message, {
        status: 502,
        headers: { "content-type": "text/plain", "access-control-allow-origin": "*" }
      });
    }`,
        proxyCode
      );
    }
    case "json": {
      const body = (contentBody || "{}").trim();
      const escaped = escapeForTemplateLiteral(body);
      return shell(
        `    const JSON_BODY = \`${escaped}\`;\n    return new Response(JSON_BODY, {\n      headers: { "content-type": "application/json", "access-control-allow-origin": "*" }\n    });`
      );
    }
    case "text": {
      const body = contentBody || "OK";
      const escaped = escapeForTemplateLiteral(body);
      return shell(
        `    const TEXT = \`${escaped}\`;\n    return new Response(TEXT, {\n      headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" }\n    });`
      );
    }
    default:
      return generateWorkerCode(workerName, "placeholder", undefined);
  }
}
