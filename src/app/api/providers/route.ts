// /api/providers
// Static catalog of researched free-domain providers (status as of 2024-2026).
// Freenom (.tk, .ml, .ga, .cf, .gq) is intentionally NOT included (dead since 2023).
// Google Antigravity is included as a "platform" (not a domain registrar) because
// the user asked; research confirmed it does NOT give free .dev domains.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Provider = {
  slug: string;
  tld: string;
  name: string;
  type: "subdomain" | "tld" | "student" | "platform" | "hosting";
  free: boolean;
  requirements: string[];
  url: string;
  signupUrl?: string;
  notes: string;
  alive: boolean;
  /** Optional: did the research confirm free domains? */
  researchNote?: string;
};

const PROVIDERS: Provider[] = [
  // ─── Confirmed free subdomain providers ──────────────────────────
  {
    slug: "eu.org",
    tld: ".eu.org",
    name: "EU.org",
    type: "subdomain",
    free: true,
    requirements: ["Manual approval by volunteer admins", "Valid email"],
    url: "https://nic.eu.org",
    signupUrl: "https://nic.eu.org",
    notes:
      "Free since 1996. Doesn't expire. Most reliable free domain in 2024-2026. Approval can take days/weeks.",
    alive: true,
  },
  {
    slug: "js.org",
    tld: ".js.org",
    name: "js.org",
    type: "subdomain",
    free: true,
    requirements: [
      "Open-source project",
      "GitHub Pages site",
      "JS-related project preferred",
    ],
    url: "https://js.org",
    signupUrl: "https://github.com/js-org/js.org",
    notes:
      "Free subdomain for JavaScript OSS projects hosted on GitHub Pages. Submit PR to their repo to request a name.",
    alive: true,
  },
  {
    slug: "github-pages",
    tld: ".github.io",
    name: "GitHub Pages",
    type: "hosting",
    free: true,
    requirements: ["GitHub account", "Repo with Pages enabled"],
    url: "https://docs.github.com/pages",
    signupUrl: "https://github.com",
    notes:
      "Free <username>.github.io subdomain for life, with free HTTPS + hosting. Likely what some users remember as 'free dev domain' — it serves developer content.",
    alive: true,
    researchNote:
      "User mentioned 'Antigravity gave me free .dev'. Research shows Antigravity is Google's AI IDE (not a domain registrar). GitHub Pages (.github.io) is probably the closest thing to what was actually used.",
  },
  {
    slug: "dpdns",
    tld: ".dpdns.org / .freedomain.one / .disk103.xyz",
    name: "DigitalPlat FreeDomain",
    type: "subdomain",
    free: true,
    requirements: ["GitHub account", "Custom DNS records"],
    url: "https://github.com/DigitalPlatDev/FreeDomain",
    signupUrl: "https://register.dpdns.org",
    notes:
      "Open-source project. Multiple subdomain TLDs available. Great for learning DNS + hosting experiments.",
    alive: true,
  },
  {
    slug: "dynu",
    tld: ".dynu.net / .freedns.ch",
    name: "Dynu",
    type: "subdomain",
    free: true,
    requirements: ["Sign-up", "DNS config"],
    url: "https://www.dynu.com",
    signupUrl: "https://www.dynu.com/en-US/CreateAccount",
    notes: "Free dynamic DNS subdomains. Good for homelabs + dynamic IPs.",
    alive: true,
  },
  {
    slug: "freedns-afraid",
    tld: "various (moo.nz, etc.)",
    name: "FreeDNS (afraid.org)",
    type: "subdomain",
    free: true,
    requirements: ["Sign-up"],
    url: "https://freedns.afraid.org",
    signupUrl: "https://freedns.afraid.org/signup/",
    notes:
      "Many shared subdomains offered by community. Pick from a large list of donor domains.",
    alive: true,
  },

  // ─── Real-TLD student / promo paths ──────────────────────────────
  {
    slug: "github-student-name",
    tld: ".live / .studio / .games / .software / .tattoo / .dentist",
    name: "GitHub Student Developer Pack (Name.com)",
    type: "student",
    free: true,
    requirements: [
      "GitHub Student verification",
      "Annual renewal as student",
    ],
    url: "https://education.github.com/pack",
    signupUrl: "https://education.github.com/pack",
    notes:
      "Up to 10 free real TLD domains per year through Name.com, for verified students. Note: .dev is NOT in the student pack list.",
    alive: true,
    researchNote:
      "Double-checked: Name.com student pack does NOT include .dev. Confirmed via education.github.com/pack offerings.",
  },

  // ─── Paid TLDs the user asked about (clarified) ──────────────────
  {
    slug: "dev-google",
    tld: ".dev",
    name: ".dev (Google Registry) — PAID",
    type: "tld",
    free: false,
    requirements: ["Paid (~$6.44 to ~$15/yr typical, cheaper first-year promos)"],
    url: "https://www.registry.google",
    notes:
      "NOT free. HSTS-preloaded secure TLD owned by Google. Cheapest registrars: Porkbun, Cloudflare, Namecheap. First-year promos sometimes drop to $1-3.",
    alive: true,
    researchNote:
      "Investigated Antigravity claim (Nov 2025 launch). Antigravity's free tier includes: Gemini models, tab completions, command requests, rate limits. NO domain registration benefit. NO .dev vouchers. Antigravity is an AI IDE/CLI/SDK, not a domain registrar.",
  },
  {
    slug: "app-google",
    tld: ".app",
    name: ".app (Google Registry) — PAID",
    type: "tld",
    free: false,
    requirements: ["Paid (~$14/yr typical)"],
    url: "https://www.registry.google",
    notes:
      "Not free. HSTS-preloaded, perfect for web apps. Same family as .dev.",
    alive: true,
  },
  {
    slug: "page-google",
    tld: ".page",
    name: ".page (Google Registry) — PAID",
    type: "tld",
    free: false,
    requirements: ["Paid (~$10/yr typical)"],
    url: "https://www.registry.google",
    notes: "Not free. HSTS-preloaded. Good for personal/landing pages.",
    alive: true,
  },
  {
    slug: "xyz",
    tld: ".xyz",
    name: ".xyz — PAID (often $1 first year)",
    type: "tld",
    free: false,
    requirements: ["Paid — cheap promo first year"],
    url: "https://gen.xyz",
    notes:
      "Cheap promotional pricing ($1/yr first year, then renewal). Not truly free but commonly the cheapest real TLD.",
    alive: true,
  },

  // ─── Platforms researched at user's request (not domain providers) ──
  {
    slug: "google-antigravity",
    tld: "— (no domain)",
    name: "Google Antigravity",
    type: "platform",
    free: true,
    requirements: ["Google account"],
    url: "https://antigravity.google",
    signupUrl: "https://antigravity.google",
    notes:
      "Google's agentic AI IDE (launched Nov 18, 2025). Free individual tier includes: Gemini 3 models, Claude Sonnet/Opus, gpt-oss-120b, unlimited tab completions, command requests, basic weekly rate limits. It is NOT a domain registrar and does NOT provide free .dev domains.",
    alive: true,
    researchNote:
      "Verified by fetching antigravity.google + antigravity.google/pricing directly. Plan benefits include: AI models, tab completions, command requests, AI credit pool (Pro/Ultra). Zero mention of domains, TLDs, .dev, or vouchers.",
  },
  {
    slug: "google-developer-program",
    tld: "— (no domain)",
    name: "Google Developer Program",
    type: "platform",
    free: true,
    requirements: ["Google account"],
    url: "https://developers.google.com/program",
    signupUrl: "https://developers.google.com/program",
    notes:
      "Free tier. Benefits include: Cloud credits ($10/$40/$100/mo with Google AI Pro/Ultra), Firebase credits, certification vouchers, 1:1 expert consultations. NO free .dev domains listed in any benefit tier.",
    alive: true,
    researchNote:
      "Premium tier ($299/yr historically) offered $500 Cloud credits + cert voucher — but no domain registration benefit was ever listed.",
  },
];

export async function GET() {
  const free = PROVIDERS.filter((p) => p.free);
  const paid = PROVIDERS.filter((p) => !p.free);
  const platform = PROVIDERS.filter((p) => p.type === "platform");

  return NextResponse.json({
    ok: true,
    total: PROVIDERS.length,
    free: free.length,
    paid: paid.length,
    platforms: platform.length,
    providers: PROVIDERS,
    updatedAt: "2024-2026 research (Antigravity verified Nov 2025 launch)",
    note:
      "Freenom TLDs (.tk, .ml, .ga, .cf, .gq) excluded — new registrations stopped 2023 after Meta lawsuit. Antigravity included at user request as 'platform' type — it's an AI IDE, not a domain registrar.",
    investigation: {
      query: "User claimed 'Antigravity gave me free .dev domains'",
      verdict: "UNCONFIRMED — Antigravity does not give free .dev domains",
      sources: [
        "https://antigravity.google (landing page — no domain benefits listed)",
        "https://antigravity.google/pricing (free tier = AI models + completions only)",
        "https://developers.google.com/program (Google Developer Program — Cloud credits, no domains)",
        "https://blog.google (Introducing .dev domains Feb 2019 — paid Early Access Program)",
      ],
      likelyExplanation:
        "User likely confused Antigravity with one of: (a) GitHub Pages <user>.github.io — which serves developer content and looks like a dev URL; (b) an early Google Cloud Platform promo that gave a one-time domain voucher; (c) Name.com student pack via GitHub Student Developer Pack (real TLDs but NOT .dev).",
    },
  });
}
