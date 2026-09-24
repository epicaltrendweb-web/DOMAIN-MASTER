// /api/workers/deploy
// Auto-deploy a Cloudflare Worker → gets a free .dev subdomain automatically.
// Each Worker deployed = new <worker-name>.epicaltrendweb.workers.dev subdomain
// on the REAL .dev TLD (Cloudflare pays Google Registry, gives it free).
//
// POST { name: "myworker" } → returns { ok, workerName, url: myworker.epicaltrendweb.workers.dev }
// POST { auto: true } → generates a random worker name + deploys
//
// This is the user's actual "Antigravity-style" free .dev domain getter:
// the Antigravity IDE wrote the deployment code, DOMAIN-MASTER now does it
// autonomously. User does nothing.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CfConfig = {
  apiKey: string;
  email: string;
  accountId: string;
  subdomain: string;
};

function loadConfig(): CfConfig | null {
  const apiKey = process.env.CF_API_KEY;
  const email = process.env.CF_EMAIL;
  const accountId = process.env.CF_ACCOUNT_ID;
  const subdomain = process.env.CF_SUBDOMAIN || "epicaltrendweb";
  if (!apiKey || !email || !accountId) return null;
  return { apiKey, email, accountId, subdomain };
}

// Worker script: nice HTML placeholder that shows the user their domain
// is live + reserved + how to edit it. Returns JSON only when ?json=1 is
// appended to the URL (for programmatic verification).
//
// Uses modern ES Modules format (Cloudflare's current standard):
//   export default { async fetch(request, env, ctx) { ... } }
// The legacy addEventListener("fetch") format is rejected by the API
// with error 10068 ("no registered event handlers").
//
// IMPORTANT: We build the Worker code using array.join('\n') to avoid
// template-literal escaping issues with backticks inside the HTML
// template literal. (Previous attempt used String.raw which preserved
// the escape backslash, producing `\`` in the output and breaking
// Cloudflare's parser with error 10021.)
function workerScript(workerName: string): string {
  const sub = process.env.CF_SUBDOMAIN || "epicaltrendweb";
  const fullDomain = `${workerName}.${sub}.workers.dev`;
  // The HTML is built as a regular string with concatenation, then baked
  // into the Worker code as a template-literal constant.
  const htmlContent = [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${fullDomain} — dominio activo</title>`,
    `  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2310b981'/%3E%3Ccircle cx='13' cy='13' r='7' fill='%23fff'/%3E%3Ccircle cx='13' cy='13' r='2.4' fill='%23059669'/%3E%3Cline x1='18' y1='18' x2='26.5' y2='26.5' stroke='%23fff' stroke-width='3.4' stroke-linecap='round'/%3E%3C/svg%3E">`,
    '  <style>',
    '    * { box-sizing: border-box; margin: 0; padding: 0; }',
    '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%); color: #1e293b; padding: 1.5rem; }',
    '    .card { max-width: 480px; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(16,185,129,0.10), 0 10px 10px -5px rgba(16,185,129,0.05); border: 2px solid #d1fae5; text-align: center; }',
    '    .logo { width: 56px; height: 56px; margin: 0 auto 1rem; display: block; }',
    '    .badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.5rem; }',
    '    h1 { font-size: 1.5rem; font-weight: 700; color: #064e3b; margin-bottom: 0.5rem; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }',
    '    p { color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 1rem; }',
    '    .meta { background: #f8fafc; border-radius: 8px; padding: 0.75rem 1rem; font-size: 12px; color: #64748b; margin-bottom: 1.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-align: left; }',
    '    .meta div { display: flex; justify-content: space-between; margin: 2px 0; }',
    '    .meta b { color: #334155; font-weight: 600; }',
    '    .cta { display: inline-block; background: #059669; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s; }',
    '    .cta:hover { background: #047857; }',
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
    '      <div><b>Hosting</b><span>Cloudflare Workers (free tier)</span></div>',
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

  // Build the Worker code. The HTML is embedded as a string literal
  // using backticks. We escape backticks INSIDE the HTML (none here)
  // and use ${} for runtime substitution of `new Date().toISOString()`.
  // The HTML string itself is baked in at deploy time (no runtime
  // substitution needed for the domain name).
  const htmlJsonEscaped = htmlContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  return [
    '// Auto-deployed by DOMAIN-MASTER',
    '// Free .dev subdomain on the REAL .dev TLD via Cloudflare Workers',
    `// Domain: ${fullDomain}`,
    '',
    `const HTML = \`${htmlJsonEscaped}\`;`,
    '',
    'const JSON_RESP = JSON.stringify({',
    '  ok: true,',
    `  domain: "${fullDomain}",`,
    '  deployedBy: "DOMAIN-MASTER",',
    '  deployedAt: new Date().toISOString(),',
    '  path: "auto",',
    '  method: "GET",',
    '  message: "Free .dev subdomain provisioned via Cloudflare Workers"',
    '}, null, 2);',
    '',
    'export default {',
    '  async fetch(request, env, ctx) {',
    '    const url = new URL(request.url);',
    '    if (url.searchParams.get("json") === "1") {',
    '      return new Response(JSON_RESP, {',
    '        headers: { "content-type": "application/json", "access-control-allow-origin": "*" }',
    '      });',
    '    }',
    '    return new Response(HTML, {',
    '      headers: { "content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*" }',
    '    });',
    '  }',
    '};',
  ].join('\n');
}

function randomName(): string {
  const adjectives = ["calm", "deep", "echo", "fair", "iron", "moon", "nova", "onyx", "pure", "swift", "wild", "zen", "atom", "byte"];
  const nouns = ["lab", "hub", "node", "wave", "sky", "flux", "core", "loop", "spark", "forge", "edge", "glow", "port", "gate"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${a}${n}${num}`;
}

function sanitizeName(name: string): string {
  // Worker names: lowercase, alphanumeric + hyphens, max 63 chars, start with letter
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  // Ensure starts with letter
  if (!/^[a-z]/.test(clean)) {
    return `d${clean}`;
  }
  return clean || randomName();
}

async function ensureSubdomain(cfg: CfConfig): Promise<{ ok: boolean; alreadyExists: boolean; error?: string }> {
  // Check if subdomain already exists
  const checkUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/subdomain`;
  const checkResp = await fetch(checkUrl, {
    headers: {
      "X-Auth-Email": cfg.email,
      "X-Auth-Key": cfg.apiKey,
    },
  });
  if (checkResp.ok) {
    return { ok: true, alreadyExists: true };
  }
  if (checkResp.status === 404) {
    // Need to create
    const createUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/subdomains`;
    const createResp = await fetch(createUrl, {
      method: "POST",
      headers: {
        "X-Auth-Email": cfg.email,
        "X-Auth-Key": cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subdomain: cfg.subdomain }),
    });
    if (!createResp.ok) {
      const err = await createResp.text();
      return { ok: false, alreadyExists: false, error: `Failed to create subdomain: ${err.slice(0, 200)}` };
    }
    return { ok: true, alreadyExists: false };
  }
  // Other error
  return { ok: false, alreadyExists: false, error: `Check subdomain HTTP ${checkResp.status}` };
}

async function deployWorker(cfg: CfConfig, workerName: string): Promise<{ ok: boolean; url?: string; error?: string; httpStatus: number }> {
  const script = workerScript(workerName);
  const scriptBlob = new Blob([script], { type: "application/javascript+module" });

  // Metadata: workers_dev=true in metadata alone is NOT enough to enable
  // the *.workers.dev URL. We must also call POST /scripts/{name}/subdomain
  // with {enabled:true} AFTER the upload. (Discovered via trial+error —
  // without that second call, the URL returns Cloudflare error 1042.)
  const metadata = {
    main_module: "worker.js",
    compatibility_date: "2024-09-23",
    workers_dev: true,
  };
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });

  const form = new FormData();
  form.append("metadata", metadataBlob, "metadata.json");
  form.append("worker.js", scriptBlob, "worker.js");

  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/scripts/${workerName}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "X-Auth-Email": cfg.email,
      "X-Auth-Key": cfg.apiKey,
    },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { ok: false, error: `Upload HTTP ${resp.status}: ${err.slice(0, 300)}`, httpStatus: resp.status };
  }

  // STEP 2 (CRITICAL): Enable workers.dev subdomain for this script.
  // Without this, the URL returns Cloudflare error 1042.
  const enableUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/scripts/${workerName}/subdomain`;
  const enableResp = await fetch(enableUrl, {
    method: "POST",
    headers: {
      "X-Auth-Email": cfg.email,
      "X-Auth-Key": cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: true }),
  });

  if (!enableResp.ok) {
    const err = await enableResp.text();
    return {
      ok: false,
      error: `Uploaded but failed to enable subdomain (HTTP ${enableResp.status}): ${err.slice(0, 200)}`,
      httpStatus: enableResp.status,
    };
  }

  return {
    ok: true,
    url: `${workerName}.${cfg.subdomain}.workers.dev`,
    httpStatus: resp.status,
  };
}

export async function POST(req: Request) {
  const cfg = loadConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cloudflare creds not configured. Set CF_API_KEY, CF_EMAIL, CF_ACCOUNT_ID, CF_SUBDOMAIN in .env",
      },
      { status: 503 }
    );
  }

  let workerName: string;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }

  if (body?.auto) {
    workerName = randomName();
  } else if (body?.name) {
    workerName = sanitizeName(String(body.name));
  } else {
    workerName = randomName();
  }

  // Step 1: Ensure the account has a workers.dev subdomain
  const sub = await ensureSubdomain(cfg);
  if (!sub.ok) {
    return NextResponse.json(
      { ok: false, error: sub.error, step: "ensure-subdomain" },
      { status: 500 }
    );
  }

  // Step 2: Deploy the Worker script (workers_dev=true → free .dev subdomain auto-assigned)
  const dep = await deployWorker(cfg, workerName);
  if (!dep.ok) {
    return NextResponse.json(
      { ok: false, error: dep.error, step: "deploy-worker" },
      { status: 500 }
    );
  }

  // Step 3: Verify the deployment by checking the script exists
  // (skip for now — the deploy returning 200 means it worked)

  return NextResponse.json({
    ok: true,
    workerName,
    url: dep.url,
    fullUrl: `https://${dep.url}`,
    subdomainCreated: !sub.alreadyExists,
    tld: "dev (real, via Cloudflare Workers)",
    free: true,
    message: `Worker deployed. Free .dev subdomain: ${dep.url}`,
    deployedAt: new Date().toISOString(),
  });
}

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json({
    ok: true,
    configured: !!cfg,
    subdomain: cfg?.subdomain,
    note: "POST {name:'myworker'} or {auto:true} to deploy a Worker → free <name>.<subdomain>.workers.dev",
  });
}
