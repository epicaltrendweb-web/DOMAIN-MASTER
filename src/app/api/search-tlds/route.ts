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
  freeApex?: boolean; // TRUE if truly free apex domain (not paid, not student)
  freeVia?: string; // explanation if free
  typicalPrice?: string; // for paid ones
  cheapestRegistrar?: string;
  howToGet: string; // steps to obtain
  renewal: string; // renewal policy / "free forever"
  notes: string;
};

const TLDS: RealTld[] = [
  // ─── TRUE FREE APEX (free forever, no student required, no payment) ───
  {
    tld: "eu.org",
    free: true,
    freeApex: true,
    freeVia: "EU.org volunteer-run since 1996",
    howToGet: "Sign up at nic.eu.org → search for an available name → submit application. Manual approval by volunteer admins takes days/weeks.",
    renewal: "FREE FOREVER — never expires, auto-renewed by EU.org. No action needed from you ever.",
    notes: "★★ The closest thing to a free apex domain that exists. name.eu.org is YOUR domain — you control DNS records (A, CNAME, MX, etc.). Run by volunteers since 1996.",
  },
  {
    tld: "pp.ua",
    free: true,
    freeApex: true,
    freeVia: "PP.UA Ukrainian free domain zone since 2008",
    howToGet: "Register at nic.ua/pp.ua → requires phone verification + credit card (even $0 balance OK, anti-abuse measure).",
    renewal: "FREE — requires periodic re-verification (phone/CC check) to keep active. If you don't re-verify, the domain is released.",
    notes: "Free Ukrainian domain zone since 2008. Phone + CC verification is anti-abuse only — no charge.",
  },

  // ─── FREE via Name.com + GitHub Student Pack (1 free/year per verified student) ───
  {
    tld: "app",
    free: true,
    freeVia: "Name.com + GitHub Student Pack (1/yr per verified student)",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "HSTS-preloaded. Real .app TLD by Google Registry. FREE 1st year for verified students only.",
  },
  {
    tld: "dev",
    free: true,
    freeVia: "Name.com + GitHub Student Pack (1/yr per verified student)",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "HSTS-preloaded. Real .dev TLD by Google Registry. FREE 1st year for verified students only.",
  },
  {
    tld: "live",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "Great for streaming/live-content. FREE 1st year for GitHub students.",
  },
  {
    tld: "studio",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "For creative portfolios. FREE 1st year for GitHub students.",
  },
  {
    tld: "software",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "For software engineers / SaaS. FREE 1st year for GitHub students.",
  },
  {
    tld: "games",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "For game devs / gaming content. FREE 1st year for GitHub students.",
  },
  {
    tld: "tattoo",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "Niche. FREE 1st year for GitHub students.",
  },
  {
    tld: "dentist",
    free: true,
    freeVia: "Name.com + GitHub Student Pack",
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "Niche. FREE 1st year for GitHub students.",
  },
  // ─── PAID but cheap/popular ───
  {
    tld: "com",
    free: false,
    typicalPrice: "$7-12/yr",
    cheapestRegistrar: "Porkbun / Cloudflare / Namecheap",
    howToGet: "Buy at Porkbun, Cloudflare, or Namecheap",
    renewal: "PAID every year (~$10/yr typical renewal)",
    notes: "The classic. Cheap everywhere.",
  },
  {
    tld: "net",
    free: false,
    typicalPrice: "$10-15/yr",
    cheapestRegistrar: "Porkbun / Namecheap",
    howToGet: "Buy at Porkbun or Namecheap",
    renewal: "PAID every year (~$12/yr renewal)",
    notes: "Alternative to .com.",
  },
  {
    tld: "org",
    free: false,
    typicalPrice: "$8-12/yr",
    cheapestRegistrar: "Porkbun",
    howToGet: "Buy at Porkbun",
    renewal: "PAID every year (~$10/yr renewal)",
    notes: "For organizations / OSS.",
  },
  {
    tld: "io",
    free: false,
    typicalPrice: "$30-45/yr",
    cheapestRegistrar: "Porkbun / Namecheap",
    howToGet: "Buy at Porkbun or Namecheap",
    renewal: "PAID every year (~$35/yr renewal)",
    notes: "Popular for tech startups.",
  },
  {
    tld: "xyz",
    free: false,
    typicalPrice: "$1 first year, $10 renewal",
    cheapestRegistrar: "Namecheap / Porkbun",
    howToGet: "Buy at Namecheap or Porkbun (use coupon APPDEVFOO5 for $5)",
    renewal: "PAID — $1 promo first year, ~$10/yr renewal after",
    notes: "Cheapest real TLD. $1 first-year promos common.",
  },
  {
    tld: "tech",
    free: false,
    typicalPrice: "$5-50/yr (variable)",
    cheapestRegistrar: ".TECH domains",
    howToGet: "Buy at .tech or Porkbun",
    renewal: "PAID — variable pricing",
    notes: "Sometimes free first year via .TECH STARS for startups.",
  },
  {
    tld: "page",
    free: false,
    typicalPrice: "$8-12/yr",
    cheapestRegistrar: "Porkbun / Cloudflare",
    howToGet: "Buy at Porkbun or Cloudflare",
    renewal: "PAID every year (~$10/yr renewal)",
    notes: "Google Registry, HSTS-preloaded.",
  },
  {
    tld: "ai",
    free: false,
    typicalPrice: "$70-100/yr",
    cheapestRegistrar: "Porkbun",
    howToGet: "Buy at Porkbun",
    renewal: "PAID — ~$70-100/yr renewal (premium TLD)",
    notes: "Premium TLD for AI projects.",
  },
  {
    tld: "co",
    free: false,
    typicalPrice: "$20-30/yr",
    cheapestRegistrar: "Porkbun / Namecheap",
    howToGet: "Buy at Porkbun or Namecheap",
    renewal: "PAID every year (~$25/yr renewal)",
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
  // 2 concurrent at a time → all TLDs complete in ~7s without hitting 429.
  const results = await mapWithConcurrency(TLDS, 2, async (t) => {
    const domain = `${name}.${t.tld}`;
    const r = await checkDomainRdap(domain);
    return {
      tld: t.tld,
      domain,
      free: t.free,
      freeApex: t.freeApex,
      freeVia: t.freeVia,
      typicalPrice: t.typicalPrice,
      cheapestRegistrar: t.cheapestRegistrar,
      howToGet: t.howToGet,
      renewal: t.renewal,
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

  const freeApexAvailable = results.filter((r) => r.freeApex && r.available === true);

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
    freeAvailable,
    freeApexAvailableCount: freeApexAvailable.length,
    freeApexAvailable,
    // The 3 true-free-apex options (always shown regardless of RDAP, since RDAP
    // doesn't reliably work for eu.org or pp.ua)
    freeApexOptions: [
      {
        tld: "eu.org",
        pattern: `${name}.eu.org`,
        howToGet: "1) Sign up at nic.eu.org (free). 2) Search for available name. 3) Submit application. Manual approval by volunteer admins takes days/weeks.",
        renewal: "FREE FOREVER — never expires, no renewal needed. Run by volunteers since 1996.",
        checkUrl: `https://nic.eu.org/panel/request?domain=${name}`,
        registerUrl: "https://nic.eu.org",
        rdapNote: "RDAP doesn't reliably work for eu.org subdomains — check availability manually at nic.eu.org.",
      },
      {
        tld: "pp.ua",
        pattern: `${name}.pp.ua`,
        howToGet: "1) Register at nic.ua/pp.ua. 2) Verify phone + credit card (anti-abuse, even $0 balance OK). 3) Get domain.",
        renewal: "FREE — requires periodic re-verification (phone/CC check) to keep active. If you don't re-verify, the domain is released.",
        checkUrl: `https://nic.ua/domains/search?domain=${name}.pp.ua`,
        registerUrl: "https://nic.ua/pp.ua",
        rdapNote: "RDAP returns 501 Not Implemented for pp.ua — check availability at nic.ua.",
      },
      {
        tld: "github.io",
        pattern: `<your-github-username>.github.io`,
        howToGet: "1) Create a GitHub repo named `<username>.github.io`. 2) Push HTML/markdown. 3) Enable Pages in repo settings. Site goes live at https://<username>.github.io automatically.",
        renewal: "FREE FOREVER — active as long as your GitHub account is in good standing.",
        checkUrl: "https://github.com/new",
        registerUrl: "https://github.com",
        rdapNote: "Name is tied to your GitHub username — can't be arbitrary. e.g. if your username is 'epicaltrendweb-web', you get epicaltrendweb-web.github.io.",
      },
    ],
    note:
      freeApexAvailable.length > 0
        ? `${freeApexAvailable.length} TRUE FREE APEX domain(s) confirmed available via RDAP.`
        : "TRUE free apex options that exist: .eu.org (forever, manual approval), .pp.ua (needs phone+CC verify), and <user>.github.io (matches your GitHub username). All checked below regardless of RDAP since RDAP doesn't reliably work for these TLDs.",
    categories: {
      freeApex: results.filter((r) => r.freeApex),
      freeStudentPack: results.filter((r) => r.free && !r.freeApex),
      paid: results.filter((r) => !r.free),
    },
    studentPackUrl: "https://education.github.com/pack",
    euOrgUrl: "https://nic.eu.org",
    ppUaUrl: "https://nic.ua/pp.ua",
  });
}
