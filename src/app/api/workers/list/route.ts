// /api/workers/list
// Lists all Workers in the user's Cloudflare account + merges with saved
// WorkerConfig (so the UI can show what content type each Worker has).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

export async function GET() {
  const cfg = loadConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Cloudflare creds not configured" },
      { status: 503 }
    );
  }

  // Fetch list of Workers from Cloudflare
  const listUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/scripts`;
  const resp = await fetch(listUrl, {
    headers: {
      "X-Auth-Email": cfg.email,
      "X-Auth-Key": cfg.apiKey,
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    return NextResponse.json(
      { ok: false, error: `CF API HTTP ${resp.status}: ${err.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const data = await resp.json();
  const scripts: any[] = data.result || [];

  // Fetch saved configs from DB
  const configs = await db.workerConfig.findMany();
  const configMap = new Map(configs.map((c: any) => [c.workerName, c]));

  // Merge
  const workers = scripts.map((s: any) => {
    const cfg = configMap.get(s.id);
    return {
      name: s.id,
      modifiedOn: s.modified_on,
      createdOn: s.created_on,
      tags: s.tags || [],
      url: `${s.id}.${cfg?.subdomain ?? "epicaltrendweb"}.workers.dev`,
      fullUrl: `https://${s.id}.${process.env.CF_SUBDOMAIN || "epicaltrendweb"}.workers.dev`,
      contentType: cfg?.contentType || "placeholder",
      contentBody: cfg?.contentBody || null,
      lastDeployedAt: cfg?.lastDeployedAt || null,
    };
  });

  return NextResponse.json({
    ok: true,
    subdomain: cfg.subdomain,
    count: workers.length,
    workers,
  });
}
