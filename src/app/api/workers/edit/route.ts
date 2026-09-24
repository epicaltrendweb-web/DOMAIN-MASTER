// /api/workers/edit
// POST { workerName, contentType, contentBody } → saves config in DB +
// regenerates Worker code + re-uploads to Cloudflare + re-enables subdomain.
//
// contentType: "placeholder" | "html" | "redirect" | "proxy" | "json" | "text"
// contentBody: HTML body / redirect URL / proxy target / JSON body / text body

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateWorkerCode, type ContentType } from "@/lib/worker-code";

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

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

async function uploadWorker(
  cfg: CfConfig,
  workerName: string,
  script: string
): Promise<{ ok: boolean; error?: string }> {
  // Build multipart form: metadata + worker.js
  const metadata = {
    main_module: "worker.js",
    compatibility_date: "2024-09-23",
    workers_dev: true,
  };
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
  const scriptBlob = new Blob([script], { type: "application/javascript+module" });

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
    return { ok: false, error: `Upload HTTP ${resp.status}: ${err.slice(0, 300)}` };
  }

  // Re-enable subdomain (idempotent)
  const enableUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/scripts/${workerName}/subdomain`;
  await fetch(enableUrl, {
    method: "POST",
    headers: {
      "X-Auth-Email": cfg.email,
      "X-Auth-Key": cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: true }),
  });

  return { ok: true };
}

export async function POST(req: Request) {
  const cfg = loadConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Cloudflare creds not configured" },
      { status: 503 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // empty OK
  }

  const workerName = (body?.workerName || "").trim().toLowerCase();
  const contentType = (body?.contentType || "placeholder") as ContentType;
  const contentBody = (body?.contentBody || "").trim();

  if (!workerName || !NAME_RE.test(workerName)) {
    return NextResponse.json(
      { ok: false, error: "Invalid workerName (1-63 chars, alphanumeric + hyphens)" },
      { status: 400 }
    );
  }

  const validTypes: ContentType[] = ["placeholder", "html", "redirect", "proxy", "json", "text"];
  if (!validTypes.includes(contentType)) {
    return NextResponse.json(
      { ok: false, error: `Invalid contentType. Valid: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate contentBody per type
  if (contentType === "redirect" || contentType === "proxy") {
    if (!contentBody) {
      return NextResponse.json(
        { ok: false, error: `contentType=${contentType} requires contentBody (URL)` },
        { status: 400 }
      );
    }
    try {
      new URL(contentBody);
    } catch {
      return NextResponse.json(
        { ok: false, error: `contentBody is not a valid URL: ${contentBody}` },
        { status: 400 }
      );
    }
  }

  // Generate Worker code
  const script = generateWorkerCode(workerName, contentType, contentBody);

  // Upload to Cloudflare
  const upload = await uploadWorker(cfg, workerName, script);
  if (!upload.ok) {
    return NextResponse.json(
      { ok: false, error: upload.error, step: "upload" },
      { status: 502 }
    );
  }

  // Save config in DB (upsert)
  await db.workerConfig.upsert({
    where: { workerName },
    create: {
      workerName,
      contentType,
      contentBody: contentBody || null,
      lastDeployedAt: new Date(),
    },
    update: {
      contentType,
      contentBody: contentBody || null,
      lastDeployedAt: new Date(),
    },
  });

  const fullDomain = `${workerName}.${cfg.subdomain}.workers.dev`;
  return NextResponse.json({
    ok: true,
    workerName,
    fullDomain,
    fullUrl: `https://${fullDomain}`,
    contentType,
    deployedAt: new Date().toISOString(),
    message: `Worker "${workerName}" updated with content type "${contentType}"`,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workerName = (url.searchParams.get("name") || "").trim().toLowerCase();
  if (!workerName) {
    return NextResponse.json({ ok: false, error: "Missing ?name=" }, { status: 400 });
  }

  const cfg = await db.workerConfig.findUnique({ where: { workerName } });
  return NextResponse.json({
    ok: true,
    workerName,
    contentType: cfg?.contentType || "placeholder",
    contentBody: cfg?.contentBody || null,
    lastDeployedAt: cfg?.lastDeployedAt || null,
  });
}
