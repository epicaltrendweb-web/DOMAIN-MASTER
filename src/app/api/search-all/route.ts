// /api/search-all?name=X&register=1
// UNIFIED endpoint that runs ALL domain checks in parallel and returns
// results organized into 4 clear categories:
//
//   1. freeForever   — apex domains gratis para siempre (.eu.org, .pp.ua, <user>.github.io)
//   2. freeFirstYear — apex domains 1er año gratis via Student Pack (.app, .dev, etc.)
//   3. paid          — apex domains siempre pago (.com, .io, .ai, etc.)
//   4. freeSubdomains— subdomains gratis para siempre (.workers.dev, .netlify.app, etc.)
//                      + auto-deploys Cloudflare Worker if register=1
//
// One fetch → all 25+ checks in parallel (with concurrency limit to avoid rate limits).

import { NextResponse } from "next/server";
import { checkDomainRdap } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────
type CategoryKey = "freeForever" | "freeFirstYear" | "paid" | "freeSubdomains";

type ResultEntry = {
  tld: string;
  domain: string;
  pattern: string;
  available: boolean | null;
  httpStatus: number;
  responseTimeMs: number;
  registrar?: string | null;
  expiresAt?: string | null;
  registeredAt?: string | null;
  errorMessage?: string;
  claimUrl: string;
  howToGet: string;
  renewal: string;
  notes: string;
  free: boolean;
  freeApex?: boolean;
  autoRegistrable?: boolean;
  live?: boolean;
};

// ─── Catalogs ──────────────────────────────────────────────────────

const APEX_TLDS = [
  // freeForever
  {
    tld: "eu.org", free: true, freeApex: true,
    howToGet: "1) Sign up at nic.eu.org (free). 2) Search for available name. 3) Submit application. Manual approval by volunteer admins takes days/weeks.",
    renewal: "FREE FOREVER — never expires, auto-renewed by EU.org. Run by volunteers since 1996.",
    notes: "Closest thing to a free apex domain. You control DNS records (A, CNAME, MX, etc.).",
    claimUrl: (n: string) => `https://nic.eu.org/panel/request?domain=${n}`,
  },
  {
    tld: "pp.ua", free: true, freeApex: true,
    howToGet: "1) Register at nic.ua/pp.ua. 2) Verify phone + credit card (anti-abuse, even $0 balance OK). 3) Get domain.",
    renewal: "FREE — requires periodic re-verification (phone/CC check) to keep active.",
    notes: "Free Ukrainian domain zone since 2008. Phone + CC verification is anti-abuse only — no charge.",
    claimUrl: (n: string) => `https://nic.ua/domains/search?domain=${n}.pp.ua`,
  },
  // freeFirstYear (Student Pack)
  {
    tld: "app", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "HSTS-preloaded. Real .app TLD by Google Registry. Free 1st year for verified students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.app`,
  },
  {
    tld: "dev", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "HSTS-preloaded. Real .dev TLD by Google Registry. Free 1st year for verified students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.dev`,
  },
  {
    tld: "live", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "Great for streaming/live-content. Free 1st year for GitHub students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.live`,
  },
  {
    tld: "studio", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "For creative portfolios. Free 1st year for GitHub students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.studio`,
  },
  {
    tld: "software", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "For software engineers / SaaS. Free 1st year for GitHub students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.software`,
  },
  {
    tld: "games", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "For game devs / gaming content. Free 1st year for GitHub students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.games`,
  },
  {
    tld: "tattoo", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "Niche. Free 1st year for GitHub students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.tattoo`,
  },
  {
    tld: "dentist", free: true,
    howToGet: "Verify as student at education.github.com/pack → register at name.com/student",
    renewal: "FREE first year — renewal is PAID (~$15/yr) after year 1",
    notes: "Niche. Free 1st year for GitHub students.",
    claimUrl: (n: string) => `https://www.name.com/student?search=${n}.dentist`,
  },
  // paid
  {
    tld: "com", free: false,
    howToGet: "Buy at Porkbun, Cloudflare, or Namecheap",
    renewal: "PAID every year (~$10/yr typical renewal)",
    notes: "$7-12/yr — the classic, cheap everywhere.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=com&search=${n}`,
  },
  {
    tld: "net", free: false,
    howToGet: "Buy at Porkbun or Namecheap",
    renewal: "PAID every year (~$12/yr renewal)",
    notes: "$10-15/yr — alternative to .com.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=net&search=${n}`,
  },
  {
    tld: "org", free: false,
    howToGet: "Buy at Porkbun",
    renewal: "PAID every year (~$10/yr renewal)",
    notes: "$8-12/yr — for organizations / OSS.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=org&search=${n}`,
  },
  {
    tld: "io", free: false,
    howToGet: "Buy at Porkbun or Namecheap",
    renewal: "PAID every year (~$35/yr renewal)",
    notes: "$30-45/yr — popular for tech startups.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=io&search=${n}`,
  },
  {
    tld: "xyz", free: false,
    howToGet: "Buy at Namecheap or Porkbun (coupon APPDEVFOO5 = $5)",
    renewal: "PAID — $1 promo first year, ~$10/yr renewal after",
    notes: "Cheapest real TLD. $1 first-year promos common.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=xyz&search=${n}`,
  },
  {
    tld: "tech", free: false,
    howToGet: "Buy at .tech or Porkbun",
    renewal: "PAID — variable pricing",
    notes: "$5-50/yr (variable) — sometimes free first year via .TECH STARS for startups.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=tech&search=${n}`,
  },
  {
    tld: "page", free: false,
    howToGet: "Buy at Porkbun or Cloudflare",
    renewal: "PAID every year (~$10/yr renewal)",
    notes: "$8-12/yr — Google Registry, HSTS-preloaded.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=page&search=${n}`,
  },
  {
    tld: "ai", free: false,
    howToGet: "Buy at Porkbun",
    renewal: "PAID — ~$70-100/yr renewal (premium TLD)",
    notes: "$70-100/yr — premium TLD for AI projects.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=ai&search=${n}`,
  },
  {
    tld: "co", free: false,
    howToGet: "Buy at Porkbun or Namecheap",
    renewal: "PAID every year (~$25/yr renewal)",
    notes: "$20-30/yr — popular short TLD for startups.",
    claimUrl: (n: string) => `https://porkbun.com/products/domains?tld=co&search=${n}`,
  },
];

const SUBDOMAIN_TLDS = [
  {
    tld: "epicaltrendweb.workers.dev",
    pattern: (n: string) => `${n}.epicaltrendweb.workers.dev`,
    free: true, autoRegistrable: true,
    howToGet: "Click 'Conseguir' button — DOMAIN-MASTER deploys a Cloudflare Worker automatically, gets you a free .dev subdomain in ~5s.",
    renewal: "FREE FOREVER — Cloudflare Workers free tier (100k requests/day free).",
    notes: "★ REAL .dev TLD via Cloudflare Workers. Auto-deployed by DOMAIN-MASTER.",
    claimUrl: () => "https://dash.cloudflare.com",
    checkUrl: (n: string) => `https://${n}.epicaltrendweb.workers.dev`,
  },
  {
    tld: "deno.dev",
    pattern: (n: string) => `${n}.deno.dev`,
    free: true, autoRegistrable: false,
    howToGet: "Create account at dash.deno.com → deploy a script → subdomain auto-assigned.",
    renewal: "FREE FOREVER — Deno Deploy free tier.",
    notes: "REAL .dev TLD via Deno Deploy. Need Deno account.",
    claimUrl: () => "https://dash.deno.com",
    checkUrl: (n: string) => `https://${n}.deno.dev`,
  },
  {
    tld: "netlify.app",
    pattern: (n: string) => `${n}.netlify.app`,
    free: true, autoRegistrable: false,
    howToGet: "Create site at app.netlify.com → subdomain auto-assigned with custom name.",
    renewal: "FREE FOREVER — Netlify free tier.",
    notes: "REAL .app TLD via Netlify. First-come-first-served on names.",
    claimUrl: () => "https://app.netlify.com/start",
    checkUrl: (n: string) => `https://${n}.netlify.app`,
  },
  {
    tld: "vercel.app",
    pattern: (n: string) => `${n}.vercel.app`,
    free: true, autoRegistrable: false,
    howToGet: "Create project at vercel.com → subdomain auto-assigned with custom name.",
    renewal: "FREE FOREVER — Vercel Hobby free tier.",
    notes: "REAL .app TLD via Vercel. Need Vercel account.",
    claimUrl: () => "https://vercel.com/signup",
    checkUrl: (n: string) => `https://${n}.vercel.app`,
  },
  {
    tld: "web.app",
    pattern: (n: string) => `${n}.web.app`,
    free: true, autoRegistrable: false,
    howToGet: "Create Firebase project at console.firebase.google.com → enable Hosting → project name = your custom name.",
    renewal: "FREE FOREVER — Firebase Hosting free tier (Spark plan).",
    notes: "REAL .app TLD via Firebase Hosting. Project name must be unique across all Firebase.",
    claimUrl: () => "https://console.firebase.google.com",
    checkUrl: (n: string) => `https://${n}.web.app`,
  },
  {
    tld: "surge.sh",
    pattern: (n: string) => `${n}.surge.sh`,
    free: true, autoRegistrable: false,
    howToGet: "Install surge CLI: npm i -g surge → run 'surge' in your project → claim any name.",
    renewal: "FREE FOREVER — Surge is free for custom subdomains.",
    notes: "Free subdomain via Surge CLI. First-come-first-served.",
    claimUrl: () => "https://surge.sh",
    checkUrl: (n: string) => `https://${n}.surge.sh`,
  },
  {
    tld: "onrender.com",
    pattern: (n: string) => `${n}.onrender.com`,
    free: true, autoRegistrable: false,
    howToGet: "Create service at render.com → subdomain auto-assigned.",
    renewal: "FREE FOREVER — Render free tier (with limits).",
    notes: "Free subdomain via Render. Need Render account.",
    claimUrl: () => "https://render.com/signup",
    checkUrl: (n: string) => `https://${n}.onrender.com`,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

const NAME_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/i;

async function mapWithConcurrency<T, R>(
  arr: T[], limit: number, fn: (item: T, i: number) => Promise<R>
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
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, () => worker()));
  return results;
}

// DNS + HTTP check for subdomain availability (3-tier strategy)
async function checkSubdomainAvailability(url: string): Promise<{ available: boolean | null; httpStatus: number; latencyMs: number; error?: string }> {
  const start = Date.now();
  let hostname: string;
  try { hostname = new URL(url).hostname; } catch { return { available: null, httpStatus: 0, latencyMs: 0, error: "invalid url" }; }
  try {
    const dns = await import("node:dns/promises");
    await dns.lookup(hostname, { all: true });
  } catch (e: any) {
    if (e.code === "ENOTFOUND" || e.code === "ENODATA") {
      return { available: true, httpStatus: 0, latencyMs: Date.now() - start };
    }
    return { available: null, httpStatus: 0, latencyMs: Date.now() - start, error: `DNS: ${e.code || e.message}` };
  }
  try {
    const resp = await fetch(url, {
      method: "GET", redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DOMAIN-MASTER/1.0)" },
    });
    const latency = Date.now() - start;
    const body = (await resp.text()).slice(0, 8192).toLowerCase();
    const server = (resp.headers.get("server") || "").toLowerCase();
    const xRenderRouting = (resp.headers.get("x-render-routing") || "").toLowerCase();
    if (resp.status === 410) return { available: false, httpStatus: resp.status, latencyMs: latency, error: "410 Gone" };
    if (resp.status === 404 && xRenderRouting.includes("no-server")) return { available: true, httpStatus: resp.status, latencyMs: latency };
    if (resp.status === 404 && server.includes("surge")) return { available: true, httpStatus: resp.status, latencyMs: latency };
    const notFoundPatterns = [
      "netlify.new","build and deploy your own site for free","site-not-found-text",
      "no such site","deployment_not_found","the deployment could not be found on vercel",
      "well, you found a glitch","site not found","firebase hosting","page not found",
      "404: not found","subdomain not configured",
      // Cloudflare Workers — returns 404 + "error code: 1042" for unregistered
      // *.workers.dev subdomains (the subdomain is enabled at account level,
      // but no Worker with that name exists yet)
      "error code: 1042",
      // Cloudflare Workers — sometimes returns this variant for newly-created
      // accounts where the subdomain isn't fully provisioned yet
      "worker not found",
      "worker was not found",
    ];
    return {
      available: resp.status === 404 && notFoundPatterns.some((p) => body.includes(p)),
      httpStatus: resp.status, latencyMs: latency,
    };
  } catch (e: any) {
    const latency = Date.now() - start;
    const msg = e?.message || String(e);
    if (msg.includes("ECONNREFUSED") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT")) {
      return { available: false, httpStatus: 0, latencyMs: latency, error: msg };
    }
    return { available: null, httpStatus: 0, latencyMs: latency, error: msg };
  }
}

async function deployCloudflareWorker(name: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const r = await fetch("http://localhost:3000/api/workers/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    if (d.ok) return { ok: true, url: d.fullUrl };
    return { ok: false, error: d.error || "Unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Main ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "").trim().toLowerCase();
  const autoRegister = url.searchParams.get("register") === "1";

  if (!name) return NextResponse.json({ ok: false, error: "Missing ?name=" }, { status: 400 });
  if (!NAME_RE.test(name)) {
    return NextResponse.json({
      ok: false,
      error: "Invalid name. Use 1-63 chars, lowercase alphanumeric + hyphens, start/end with letter/digit.",
    }, { status: 400 });
  }

  // ─── Parallel checks ───
  // 1. Apex TLDs (RDAP, concurrency 2)
  // 2. Subdomain TLDs (DNS + HTTP, concurrency 5)
  const apexResults = await mapWithConcurrency(APEX_TLDS, 2, async (t) => {
    const domain = `${name}.${t.tld}`;
    const r = await checkDomainRdap(domain);
    const cat: CategoryKey = t.freeApex ? "freeForever" : t.free ? "freeFirstYear" : "paid";
    return {
      category: cat,
      tld: t.tld, domain, pattern: domain,
      available: r.available, httpStatus: r.httpStatus,
      responseTimeMs: r.responseTimeMs,
      registrar: r.registrar, expiresAt: r.expiresAt, registeredAt: r.registeredAt,
      errorMessage: r.errorMessage,
      claimUrl: t.claimUrl(name),
      howToGet: t.howToGet, renewal: t.renewal,
      notes: t.notes, free: t.free, freeApex: t.freeApex,
    } as ResultEntry;
  });

  const subdomainResults = await mapWithConcurrency(SUBDOMAIN_TLDS, 5, async (t) => {
    const pattern = t.pattern(name);
    const checkUrl = t.checkUrl(name);
    const r = await checkSubdomainAvailability(checkUrl);
    return {
      category: "freeSubdomains" as CategoryKey,
      tld: t.tld, domain: pattern, pattern,
      available: r.available, httpStatus: r.httpStatus,
      responseTimeMs: r.latencyMs,
      errorMessage: r.error,
      claimUrl: t.claimUrl(),
      howToGet: t.howToGet, renewal: t.renewal,
      notes: t.notes, free: t.free, autoRegistrable: t.autoRegistrable,
    } as ResultEntry;
  });

  // ─── Auto-register the .dev via Cloudflare Worker if requested ───
  let autoRegistered: { url?: string; error?: string } | null = null;
  if (autoRegister) {
    const cfEntry = subdomainResults.find((r) => r.tld === "epicaltrendweb.workers.dev");
    if (cfEntry?.available) {
      const dep = await deployCloudflareWorker(name);
      if (dep.ok) autoRegistered = { url: dep.url };
      else autoRegistered = { error: dep.error };
    }
  }

  // ─── Group by category ───
  const categories: Record<CategoryKey, ResultEntry[]> = {
    freeForever: [],
    freeFirstYear: [],
    paid: [],
    freeSubdomains: [],
  };
  for (const r of [...apexResults, ...subdomainResults]) {
    categories[r.category].push(r);
  }

  // Sort each category: available first, then unknown, then taken
  const sortFn = (a: ResultEntry, b: ResultEntry) => {
    const av = a.available === true ? 0 : a.available === null ? 1 : 2;
    const bv = b.available === true ? 0 : b.available === null ? 1 : 2;
    return av - bv;
  };
  for (const k of Object.keys(categories) as CategoryKey[]) {
    categories[k].sort(sortFn);
  }

  const summary = {
    freeForever: {
      total: categories.freeForever.length,
      available: categories.freeForever.filter((r) => r.available === true).length,
    },
    freeFirstYear: {
      total: categories.freeFirstYear.length,
      available: categories.freeFirstYear.filter((r) => r.available === true).length,
    },
    paid: {
      total: categories.paid.length,
      available: categories.paid.filter((r) => r.available === true).length,
    },
    freeSubdomains: {
      total: categories.freeSubdomains.length,
      available: categories.freeSubdomains.filter((r) => r.available === true).length,
    },
  };

  return NextResponse.json({
    ok: true,
    name,
    checkedAt: new Date().toISOString(),
    categories,
    summary,
    autoRegistered,
    totalChecked: apexResults.length + subdomainResults.length,
    totalAvailable:
      summary.freeForever.available +
      summary.freeFirstYear.available +
      summary.paid.available +
      summary.freeSubdomains.available,
  });
}
