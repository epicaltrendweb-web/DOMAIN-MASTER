// /api/tracked/check?id=...  — re-run availability check for one tracked domain

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkDomainRdap } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing ?id=" }, { status: 400 });
    }

    const domain = await db.trackedDomain.findUnique({ where: { id } });
    if (!domain) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const result = await checkDomainRdap(domain.name);
    const available = result.available === null ? null : result.available;

    await db.trackedDomain.update({
      where: { id },
      data: {
        status: result.status,
        registrar: result.registrar,
        registeredAt: result.registeredAt ? new Date(result.registeredAt) : null,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
        lastChecked: new Date(),
      },
    });

    const log = await db.checkLog.create({
      data: {
        domainId: id,
        status: result.status,
        available: available === null ? null : available,
        registrar: result.registrar,
        errorMessage: result.errorMessage,
        responseTime: result.responseTimeMs,
      },
    });

    return NextResponse.json({ ok: true, result, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
