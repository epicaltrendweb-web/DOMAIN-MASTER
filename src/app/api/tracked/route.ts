// /api/tracked  — GET (list), POST (create), DELETE (?id=)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkDomainRdap } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function tldFromName(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  // For "foo.co.uk" we'd want "co.uk" — but for simplicity take the last label
  return parts[parts.length - 1];
}

async function refreshDomain(domainId: string, name: string) {
  const result = await checkDomainRdap(name);
  const status: string = result.status;
  const available = result.available === null ? null : result.available;

  await db.trackedDomain.update({
    where: { id: domainId },
    data: {
      status,
      registrar: result.registrar,
      registeredAt: result.registeredAt ? new Date(result.registeredAt) : null,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      lastChecked: new Date(),
    },
  });

  await db.checkLog.create({
    data: {
      domainId,
      status,
      available: available === null ? null : available,
      registrar: result.registrar,
      errorMessage: result.errorMessage,
      responseTime: result.responseTimeMs,
    },
  });
}

export async function GET() {
  const items = await db.trackedDomain.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name: string = (body?.name || "").trim().toLowerCase();

    if (!name) {
      return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    }
    if (!DOMAIN_RE.test(name)) {
      return NextResponse.json(
        { ok: false, error: "Invalid domain. Use format like 'example.com'" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await db.trackedDomain.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Already tracked", item: existing }, { status: 409 });
    }

    // Create with "unknown" then immediately check
    const created = await db.trackedDomain.create({
      data: {
        name,
        tld: tldFromName(name),
        status: "unknown",
        notes: body?.notes ?? null,
      },
    });

    // Best-effort: do the first check inline
    try {
      await refreshDomain(created.id, name);
    } catch (e) {
      // leave status as "unknown"
      console.error("refresh failed:", e);
    }

    const fresh = await db.trackedDomain.findUnique({
      where: { id: created.id },
      include: { checks: { orderBy: { checkedAt: "desc" }, take: 5 } },
    });

    return NextResponse.json({ ok: true, item: fresh });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing ?id=" }, { status: 400 });
    }
    await db.trackedDomain.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
