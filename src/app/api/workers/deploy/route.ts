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

// Worker script: minimal "domain active" placeholder
// Uses modern ES Modules format (Cloudflare's current standard):
//   export default { async fetch(request, env, ctx) { ... } }
// The legacy addEventListener("fetch") format is rejected by the API
// with error 10068 ("no registered event handlers").
function workerScript(workerName: string): string {
  const sub = process.env.CF_SUBDOMAIN || "epicaltrendweb";
  const fullDomain = `${workerName}.${sub}.workers.dev`;
  return `// Auto-deployed by DOMAIN-MASTER
// Free .dev subdomain on the REAL .dev TLD via Cloudflare Workers
// Domain: ${fullDomain}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    return new Response(
      JSON.stringify({
        ok: true,
        domain: "${fullDomain}",
        deployedBy: "DOMAIN-MASTER",
        deployedAt: new Date().toISOString(),
        path: url.pathname,
        method: request.method,
        message: "Free .dev subdomain provisioned via Cloudflare Workers"
      }),
      {
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*"
        }
      }
    );
  }
};
`.trim();
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
