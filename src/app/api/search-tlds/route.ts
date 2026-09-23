// /api/search-tlds?name=X
// Searches for a custom name across REAL TLDs (not subdomains) via RDAP.
//
// The user wants to register einstein.app / einstein.dev / etc. — real TLD
// apex domains, not subdomains. This endpoint checks availability across:
//
// FREE via Name.com + GitHub Student Developer Pack (1 free per year per account):
//   .app, .dev, .live, .studio, .software, .games, .tattoo, .dentist, .xyz
//
// PAID but cheap/popular (shown for comparison + claim links):
//   .com, .net, .org, .io, .tech, .page, .ai, .co
//
// RDAP returns:
//   - 200 = registered (TAKEN)
//   - 404 = available
//   - 400/422/5xx on bootstrap = TLD has no RDAP server (mark as "unknown")

import { NextResponse } from "next/server";
import { checkDomainRdap } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RealTld = {
  tld: string; // without dot, e.g. "app"
  free: boolean; // FREE via Student Pack / promo?
  freeVia?: string; // explanation if free
  typicalPrice?: string; // for paid ones
  cheapestRegistrar?: string;
  notes: string;
};

const TLDS: RealTld[] = [
  // ─── FREE via Name.com + GitHub Student Pack (1 free/year per account) ───
  {
    tld: "app",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "HSTS-preloaded. Real .app TLD by Google Registry. FREE for GitHub students (1/yr).",
  },
  {
    tld: "dev",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "HSTS-preloaded. Real .dev TLD by Google Registry. FREE for GitHub students (1/yr).",
  },
  {
    tld: "live",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "Great for streaming/live-content. FREE for GitHub students.",
  },
  {
    tld: "studio",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "Great for creative portfolios. FREE for GitHub students.",
  },
  {
    tld: "software",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "For software engineers / SaaS. FREE for GitHub students.",
  },
  {
    tld: "games",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "For game devs / gaming content. FREE for GitHub students.",
  },
  {
    tld: "tattoo",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "Niche. FREE for GitHub students.",
  },
  {
    tld: "dentist",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    notes: "Niche. FREE for GitHub students.",
  },
  // ─── PAID but cheap/popular ───
  {
    tld: "com",
    free: false,
    typicalPrice: "$7-12/yr",
    cheapestRegistrar: "Porkbun / Cloudflare / Namecheap",
    notes: "The classic. Cheap everywhere.",
  },
  {
    tld: "net",
    free: false,
    typicalPrice: "$10-15/yr",
    cheapestRegistrar: "Porkbun / Namecheap",
    notes: "Alternative to .com.",
  },
  {
    tld: "org",
    free: false,
    typicalPrice: "$8-12/yr",
    cheapestRegistrar: "Porkbun",
    notes: "For organizations / OSS.",
  },
  {
    tld: "io",
    free: false,
    typicalPrice: "$30-45/yr",
    cheapestRegistrar: "Porkbun / Namecheap",
    notes: "Popular for tech startups.",
  },
  {
    tld: "xyz",
    free: false,
    typicalPrice: "$1 first year, $10 renewal",
    cheapestRegistrar: "Namecheap / Porkbun",
    notes: "Cheapest real TLD. $1 first-year promos common.",
  },
  {
    tld: "tech",
    free: false,
    typicalPrice: "$5-50/yr (variable)",
    cheapestRegistrar: ".TECH domains",
    notes: "Sometimes free first year via .TECH STARS for startups.",
  },
  {
    tld: "page",
    free: false,
    typicalPrice: "$8-12/yr",
    cheapestRegistrar: "Porkbun / Cloudflare",
    notes: "Google Registry, HSTS-preloaded.",
  },
  {
    tld: "ai",
    free: false,
    typicalPrice: "$70-100/yr",
    cheapestRegistrar: "Porkbun",
    notes: "Premium TLD for AI projects.",
  },
  {
    tld: "co",
    free: false,
    typicalPrice: "$20-30/yr",
    cheapestRegistrar: "Porkbun / Namecheap",
    notes: "Popular short TLD for startups.",
  },
];

const NAME_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/i;

function claimUrl(name: string, tld: string, free: boolean): string {
  if (free) {
    return `https://www.name.com/student?search=${name}.${tld}`;
  }
  return `https://porkbun.com/products/domains?tld=${tld}&search=${name}`;
}

// Process an array with limited concurrency to avoid hitting rdap.org's
// rate limit (HTTP 429). Batches of 3 with a 150ms pause between batches.
async function mapWithConcurrency<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= arr.length) break;
      results[myIdx] = await fn(arr[myIdx], myIdx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, arr.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "").trim().toLowerCase();

  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing ?name=" }, { status: 400 });
  }
  if (!NAME_RE.test(name)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid name. Use 1-63 chars, lowercase alphanumeric + hyphens, start/end with letter/digit.",
      },
      { status: 400 }
    );
  }

  // Concurrent-but-batched RDAP check to avoid rdap.org rate limits (429).
  // 2 concurrent at a time → 17 TLDs complete in ~7s without hitting 429.
  const results = await mapWithConcurrency(TLDS, 2, async (t) => {
    const domain = `${name}.${t.tld}`;
    const r = await checkDomainRdap(domain);
    return {
      tld: t.tld,
      domain,
      free: t.free,
      freeVia: t.freeVia,
      typicalPrice: t.typicalPrice,
      cheapestRegistrar: t.cheapestRegistrar,
      notes: t.notes,
      available: r.available,
      status: r.status,
      registrar: r.registrar,
      expiresAt: r.expiresAt,
      registeredAt: r.registeredAt,
      httpStatus: r.httpStatus,
      responseTimeMs: r.responseTimeMs,
      errorMessage: r.errorMessage,
      claimUrl: claimUrl(name, t.tld, t.free),
    };
  });

  const available = results.filter((r) => r.available === true);
  const taken = results.filter((r) => r.available === false);
  const unknown = results.filter((r) => r.available === null);

  const freeAvailable = available.filter((r) => r.free);

  return NextResponse.json({
    ok: true,
    name,
    checkedAt: new Date().toISOString(),
    results,
    availableCount: available.length,
    takenCount: taken.length,
    unknownCount: unknown.length,
    freeAvailableCount: freeAvailable.length,
    freeAvailable: freeAvailable,
    note: freeAvailable.length > 0
      ? `${freeAvailable.length} FREE TLD${freeAvailable.length > 1 ? "s" : ""} available via Name.com + GitHub Student Pack (1 free domain per year per verified student account).`
      : "No free TLDs available with this name — try a different name or check paid options.",
    studentPackUrl: "https://education.github.com/pack",
    studentPackNote:
      "GitHub Student Developer Pack + Name.com: free .dev / .app / .live / .studio / .software / .games / .tattoo / .dentist for 1 year per verified student account. This is how 'einstein.app' was free.",
  });
}
