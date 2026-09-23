// /api/discover
// Auto-discover available domain candidates so the user doesn't have to do anything.
//
// Strategy:
//   1. Generate candidate names from a word bank + patterns
//   2. Check each via RDAP in parallel (Promise.allSettled)
//   3. Return available ones + save to TrackedDomain with notes="auto-discovered"
//   4. Already-tracked names are skipped
//
// Domain endings checked (mixed: real paid TLDs the user mentioned + truly free
// subdomain hosts like github.io / web.app / trycloudflare.com that the user
// might have used via Antigravity + Firebase bridge).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkDomainRdap } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADJECTIVES = [
  "bright", "calm", "deep", "echo", "fair", "gentle", "high", "iron",
  "keen", "light", "moon", "nova", "onyx", "pure", "quick", "rapid",
  "silent", "swift", "true", "vivid", "wild", "zen", "atom", "byte",
];

const NOUNS = [
  "lab", "hub", "node", "wave", "sky", "flux", "core", "loop",
  "spark", "forge", "edge", "field", "glow", "stream", "trail", "vault",
  "haven", "port", "gate", "scope",
];

const SUFFIXES = ["dev", "app", "io", "build", "ship", "run", "stack"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCandidates(count: number): string[] {
  // TLDs we want to scan. .dev and .app are paid Google Registry (user asked).
  // .com is the universal baseline (some patterns will be free).
  // .xyz and .page included for variety.
  const TLDS = ["dev", "app", "com"];
  const seen = new Set<string>();
  const out: string[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 6) {
    attempts++;
    const pattern = Math.floor(Math.random() * 4);
    let name: string;
    switch (pattern) {
      case 0:
        name = `${pick(ADJECTIVES)}${pick(NOUNS)}`;
        break;
      case 1:
        name = `${pick(NOUNS)}${pick(SUFFIXES)}`;
        break;
      case 2:
        name = `${pick(ADJECTIVES)}${pick(NOUNS)}${pick(SUFFIXES)}`;
        break;
      default:
        name = `${pick(NOUNS)}${Math.floor(Math.random() * 90 + 10)}`;
        break;
    }
    const tld = pick(TLDS);
    const full = `${name}.${tld}`;
    if (!seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const count = Math.min(
    Math.max(parseInt(url.searchParams.get("count") || "12", 10), 1),
    25
  );
  const saveParam = url.searchParams.get("save");
  const save = saveParam !== "0" && saveParam !== "false";

  const candidates = generateCandidates(count);

  // Skip names already in DB
  const existing = await db.trackedDomain.findMany({
    where: { name: { in: candidates } },
    select: { name: true },
  });
  const existingSet = new Set(existing.map((t) => t.name));
  const toCheck = candidates.filter((c) => !existingSet.has(c));

  // Parallel RDAP check
  const settled = await Promise.allSettled(
    toCheck.map(async (name) => {
      const r = await checkDomainRdap(name);
      return { name, ...r };
    })
  );

  const available: Array<{
    name: string;
    responseTimeMs: number;
    saved?: boolean;
  }> = [];
  const taken: Array<{ name: string; registrar: string | null }> = [];
  const unknown: Array<{ name: string; errorMessage?: string }> = [];

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const r = s.value;
    if (r.status === "available") {
      let saved = false;
      if (save) {
        try {
          await db.trackedDomain.create({
            data: {
              name: r.name,
              tld: r.name.split(".").pop() || "",
              status: "available",
              lastChecked: new Date(),
              notes: "auto-discovered",
            },
          });
          await db.checkLog.create({
            data: {
              domainId: (await db.trackedDomain.findUnique({ where: { name: r.name } }))!.id,
              status: "available",
              available: true,
              responseTime: r.responseTimeMs,
            },
          });
          saved = true;
        } catch {
          /* race or already exists */
        }
      }
      available.push({ name: r.name, responseTimeMs: r.responseTimeMs, saved });
    } else if (r.status === "taken") {
      taken.push({ name: r.name, registrar: r.registrar });
    } else {
      unknown.push({ name: r.name, errorMessage: r.errorMessage });
    }
  }

  return NextResponse.json({
    ok: true,
    candidatesChecked: settled.length,
    skipped: existingSet.size,
    available,
    taken,
    unknown,
    checkedAt: new Date().toISOString(),
  });
}
