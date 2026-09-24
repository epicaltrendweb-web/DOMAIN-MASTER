// /api/register?name=X
// Multi-TLD free subdomain availability checker + auto-registrar.
//
// The user types a custom name (e.g. "banana"). We check availability across
// all FREE custom-name-able subdomain providers in parallel, and for the ones
// we have API credentials for, we auto-register on demand.
//
// Real .dev TLD providers (with custom-name support):
//   - <name>.epicaltrendweb.workers.dev  (Cloudflare Workers — auto-deployable, we have creds)
//   - <name>.deno.dev                    (Deno Deploy — needs Deno token)
//
// Real .app TLD providers (with custom-name support):
//   - <name>.netlify.app                 (Netlify — needs Netlify token)
//   - <name>.vercel.app                  (Vercel — needs Vercel token)
//   - <name>.web.app + <name>.firebaseapp.com  (Firebase Hosting — needs Firebase token)
//
// Other free custom-name subdomain TLDs:
//   - <name>.surge.sh        (Surge — CLI only, public subdomains first-come-first-served)
//   - <name>.glitch.me      (Glitch — needs Glitch token)
//   - <name>.onrender.com    (Render — needs Render token)
//   - <name>.trycloudflare.com (Cloudflare quick tunnel — RANDOM ONLY, no custom)
//
// Availability check strategy:
//   - For subdomain TLDs: HTTP GET/HEAD to https://<name>.<tld>/ — 200/404-with-content = taken,
//     connection error/DNS NXDOMAIN = available
//   - For Cloudflare Workers: try to deploy directly (the deploy itself fails if name is taken
//     within the account's subdomain, but cross-account is fine since each account has its
//     own <account>.workers.dev)

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Tld = {
  slug: string;
  pattern: string; // e.g. "{name}.netlify.app"
  tld: string; // e.g. ".netlify.app"
  provider: string;
  realTld: string; // e.g. "app" or "dev" or "sh"
  autoRegistrable: boolean; // can DOMAIN-MASTER register it for the user?
  requiresToken?: string; // env var name needed
  checkUrl: (name: string) => string;
  claimUrl?: (name: string) => string; // manual claim URL if auto not possible
  notes: string;
};

const TLDS: Tld[] = [
  {
    slug: "cf-workers",
    pattern: "{name}.epicaltrendweb.workers.dev",
    tld: ".workers.dev",
    provider: "Cloudflare Workers (account subdomain)",
    realTld: "dev",
    autoRegistrable: true,
    checkUrl: (n) => `https://${n}.epicaltrendweb.workers.dev/`,
    notes: "Auto-deployable. Each Worker gets <name>.epicaltrendweb.workers.dev on the REAL .dev TLD. Free, permanent, with global CDN + HTTPS.",
  },
  {
    slug: "deno-deploy",
    pattern: "{name}.deno.dev",
    tld: ".deno.dev",
    provider: "Deno Deploy",
    realTld: "dev",
    autoRegistrable: false,
    requiresToken: "DENO_DEPLOY_TOKEN",
    checkUrl: (n) => `https://${n}.deno.dev/`,
    claimUrl: () => "https://dash.deno.com",
    notes: "Free, custom name on the REAL .dev TLD. Need Deno Deploy account. Register manually at dash.deno.com.",
  },
  {
    slug: "netlify",
    pattern: "{name}.netlify.app",
    tld: ".netlify.app",
    provider: "Netlify",
    realTld: "app",
    autoRegistrable: false,
    requiresToken: "NETLIFY_TOKEN",
    checkUrl: (n) => `https://${n}.netlify.app/`,
    claimUrl: () => "https://app.netlify.com/start",
    notes: "Free, custom name on the REAL .app TLD. First-come-first-served. Need Netlify account.",
  },
  {
    slug: "vercel",
    pattern: "{name}.vercel.app",
    tld: ".vercel.app",
    provider: "Vercel",
    realTld: "app",
    autoRegistrable: false,
    requiresToken: "VERCEL_TOKEN",
    checkUrl: (n) => `https://${n}.vercel.app/`,
    claimUrl: () => "https://vercel.com/signup",
    notes: "Free Hobby tier, custom name on REAL .app TLD. Need Vercel account.",
  },
  {
    slug: "firebase-hosting",
    pattern: "{name}.web.app + {name}.firebaseapp.com",
    tld: ".web.app + .firebaseapp.com",
    provider: "Firebase Hosting",
    realTld: "app",
    autoRegistrable: false,
    requiresToken: "FIREBASE_TOKEN",
    checkUrl: (n) => `https://${n}.web.app/`,
    claimUrl: () => "https://console.firebase.google.com",
    notes: "Free, custom project name on REAL .app TLD. Both web.app and firebaseapp.com are auto-assigned when you create a Firebase project. Project name = your custom name (must be unique across all Firebase).",
  },
  {
    slug: "surge",
    pattern: "{name}.surge.sh",
    tld: ".surge.sh",
    provider: "Surge.sh",
    realTld: "sh",
    autoRegistrable: false,
    checkUrl: (n) => `https://${n}.surge.sh/`,
    claimUrl: () => "https://surge.sh",
    notes: "Free, custom name. CLI-based: `npm i -g surge && surge publish`. First-come-first-served.",
  },
  {
    slug: "glitch",
    pattern: "{name}.glitch.me",
    tld: ".glitch.me",
    provider: "Glitch",
    realTld: "me",
    autoRegistrable: false,
    checkUrl: (n) => `https://${n}.glitch.me/`,
    claimUrl: () => "https://glitch.com/signup",
    notes: "Free, custom name. Need Glitch account.",
  },
  {
    slug: "render",
    pattern: "{name}.onrender.com",
    tld: ".onrender.com",
    provider: "Render",
    realTld: "com",
    autoRegistrable: false,
    checkUrl: (n) => `https://${n}.onrender.com/`,
    claimUrl: () => "https://render.com/signup",
    notes: "Free tier, custom name. Need Render account.",
  },
];

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

async function checkAvailability(url: string): Promise<{
  available: boolean | null;
  httpStatus: number;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { available: null, httpStatus: 0, latencyMs: 0, error: "invalid url" };
  }

  // STEP 1: DNS resolution check.
  // If the hostname doesn't resolve (NXDOMAIN), the subdomain is AVAILABLE.
  // Many free hosting providers use wildcard DNS that ALWAYS resolves to their
  // servers, so we can't rely on DNS alone — but if DNS fails, that's a strong
  // "available" signal.
  let dnsResolves = false;
  try {
    const dns = await import("node:dns/promises");
    await dns.lookup(hostname, { all: true });
    dnsResolves = true;
  } catch (e: any) {
    if (e.code === "ENOTFOUND" || e.code === "ENODATA") {
      // DNS doesn't resolve = subdomain is definitely available
      return {
        available: true,
        httpStatus: 0,
        latencyMs: Date.now() - start,
      };
    }
    // Other DNS errors → unknown
    return {
      available: null,
      httpStatus: 0,
      latencyMs: Date.now() - start,
      error: `DNS error: ${e.code || e.message}`,
    };
  }

  // STEP 2: HTTP check (for hostnames that DO resolve).
  // Many providers use wildcard DNS, so a resolving DNS doesn't mean "taken".
  // Fetch the body and look for known "not found" patterns to detect available.
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DOMAIN-MASTER/1.0)",
      },
    });
    const latency = Date.now() - start;
    const body = (await resp.text()).slice(0, 8192).toLowerCase();
    const server = (resp.headers.get("server") || "").toLowerCase();
    const xRenderRouting = (resp.headers.get("x-render-routing") || "").toLowerCase();

    // Provider-specific "available" signals based on headers:
    //   - Render: header `x-render-routing: no-server` = no service configured → AVAILABLE
    //   - Surge:  header `server: Surge` AND status 404 = unregistered → AVAILABLE
    //   - Glitch: status 410 Gone = subdomain dead/discontinued → mark as unavailable with note

    if (resp.status === 410) {
      // 410 Gone = permanently gone (Glitch discontinued free subdomains)
      // Treat as TAKEN (not registrable)
      return {
        available: false,
        httpStatus: resp.status,
        latencyMs: latency,
        error: "410 Gone — service discontinued",
      };
    }

    // Render-specific: x-render-routing: no-server header
    if (resp.status === 404 && xRenderRouting.includes("no-server")) {
      return { available: true, httpStatus: resp.status, latencyMs: latency };
    }

    // Surge-specific: server: Surge header + 404
    if (resp.status === 404 && server.includes("surge")) {
      return { available: true, httpStatus: resp.status, latencyMs: latency };
    }

    // Body-based pattern matching (Netlify, Vercel, Firebase, etc.)
    const notFoundPatterns = [
      // Netlify
      "netlify.new",
      "build and deploy your own site for free",
      "site-not-found-text",
      "no such site",
      "site not yet deployed",
      // Vercel
      "deployment_not_found",
      "the deployment could not be found on vercel",
      // Glitch (if it ever returns 404 with content)
      "well, you found a glitch",
      // Firebase Hosting
      "site not found",
      "firebase hosting",
      // Generic
      "page not found",
      "404: not found",
      "subdomain not configured",
      // Cloudflare Workers — 404 + "error code: 1042" for unregistered
      // *.workers.dev subdomains
      "error code: 1042",
      "worker not found",
      "worker was not found",
    ];

    const isAvailable =
      resp.status === 404 &&
      notFoundPatterns.some((p) => body.includes(p));

    return {
      available: isAvailable,
      httpStatus: resp.status,
      latencyMs: latency,
    };
  } catch (e: any) {
    const latency = Date.now() - start;
    const msg = e?.message || String(e);
    // Connection errors after DNS resolves — usually means the site exists but
    // is misconfigured. Treat as "taken" (the subdomain is reserved somehow).
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("ECONNRESET") ||
      msg.includes("ETIMEDOUT")
    ) {
      return { available: false, httpStatus: 0, latencyMs: latency, error: msg };
    }
    return { available: null, httpStatus: 0, latencyMs: latency, error: msg };
  }
}

async function deployCloudflareWorker(name: string): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
}> {
  // Use the existing /api/workers/deploy endpoint internally
  const base = process.env.NODE_ENV === "production"
    ? "https://domain-master.vercel.app"
    : "http://localhost:3000";
  try {
    const r = await fetch(`${base}/api/workers/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    if (d.ok) {
      return { ok: true, url: d.fullUrl };
    }
    return { ok: false, error: d.error || "Unknown deploy error" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "").trim().toLowerCase();
  const autoRegister = url.searchParams.get("register") === "1";

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Missing ?name=" },
      { status: 400 }
    );
  }
  if (!NAME_RE.test(name)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid name. Use 3-32 chars, lowercase alphanumeric + hyphens, start and end with letter/digit.",
      },
      { status: 400 }
    );
  }

  // Parallel availability check across all TLDs
  const checks = await Promise.all(
    TLDS.map(async (tld) => {
      const checkUrl = tld.checkUrl(name);
      const result = await checkAvailability(checkUrl);
      return {
        slug: tld.slug,
        pattern: tld.pattern.replace("{name}", name),
        tld: tld.tld,
        provider: tld.provider,
        realTld: tld.realTld,
        autoRegistrable: tld.autoRegistrable,
        requiresToken: tld.requiresToken,
        notes: tld.notes,
        claimUrl: tld.claimUrl ? tld.claimUrl(name) : null,
        checkUrl,
        ...result,
      };
    })
  );

  // Auto-register Cloudflare Worker if requested AND available
  let autoRegistered: { url: string; error?: string } | null = null;
  if (autoRegister) {
    const cfEntry = checks.find((c) => c.slug === "cf-workers");
    if (cfEntry?.available) {
      const dep = await deployCloudflareWorker(name);
      if (dep.ok) {
        autoRegistered = { url: dep.url! };
      } else {
        autoRegistered = { url: "", error: dep.error };
      }
    }
  }

  const available = checks.filter((c) => c.available === true);
  const taken = checks.filter((c) => c.available === false);
  const unknown = checks.filter((c) => c.available === null);

  return NextResponse.json({
    ok: true,
    name,
    checkedAt: new Date().toISOString(),
    results: checks,
    availableCount: available.length,
    takenCount: taken.length,
    unknownCount: unknown.length,
    autoRegistered,
  });
}
