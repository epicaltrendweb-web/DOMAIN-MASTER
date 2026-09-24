// /api/domains/check?name=foo.dev
// RDAP-based domain availability check (no auth, free).

import { NextResponse } from "next/server";
import { checkDomainRdap } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "").trim().toLowerCase();

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Missing ?name=" },
      { status: 400 }
    );
  }
  if (!DOMAIN_RE.test(name)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid domain. Must be like 'example.com'",
      },
      { status: 400 }
    );
  }

  const result = await checkDomainRdap(name);

  return NextResponse.json({
    ok: true,
    name,
    ...result,
    checkedAt: new Date().toISOString(),
  });
}
