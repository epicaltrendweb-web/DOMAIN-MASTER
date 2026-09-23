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
    slug: "firebase-hosting",
    tld: ".web.app / .firebaseapp.com",
    name: "Firebase Hosting",
    type: "hosting",
    free: true,
    requirements: ["Google account", "Firebase project", "Deploy via CLI"],
    url: "https://firebase.google.com/docs/hosting",
    signupUrl: "https://console.firebase.google.com",
    notes:
      "Free subdomains on the real .app TLD. Every Firebase project gets <project>.web.app AND <project>.firebaseapp.com automatically, free, with global CDN + HTTPS. Spark plan (free) covers generous hosting.",
    alive: true,
    researchNote:
      "VERIFIED IN USER'S GITHUB: the 'antigravity' repo has a `firebase-bridge/` directory with `.firebaserc` pointing to project `epicaltrend-bridge-100`. The free Firebase subdomains for that project are epicaltrend-bridge-100.web.app and epicaltrend-bridge-100.firebaseapp.com. THIS is almost certainly what the user remembers as 'free dev domain' — it's .app (not .dev) and was used to bridge the Antigravity bot to Telegram.",
  },
  {
    slug: "cloudflare-tunnel",
    tld: ".trycloudflare.com",
    name: "Cloudflare Quick Tunnel",
    type: "hosting",
    free: true,
    requirements: ["Local service running", "cloudflared binary"],
    url: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/",
    signupUrl: "https://github.com/cloudflare/cloudflared",
    notes:
      "Run `cloudflared tunnel --url http://localhost:3000` and get a free random subdomain like random-words-123.trycloudflare.com — no account needed, instant, with HTTPS.",
    alive: true,
    researchNote:
      "VERIFIED IN USER'S GITHUB: the 'antigravity' repo has `tools/cloudflared` (39MB binary). User was set up to expose local services to public *.trycloudflare.com URLs for free.",
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
    updatedAt: "2024-2026 research + scan of user's GitHub repos",
    note:
      "Freenom TLDs (.tk, .ml, .ga, .cf, .gq) excluded — new registrations stopped 2023 after Meta lawsuit. Antigravity + Firebase Hosting + Cloudflare Tunnel added after scanning user's GitHub repos.",
    investigation: {
      query: "User claimed 'Antigravity gave me free .dev domains' + 'I had developed an antigravity function that searched for available .dev domains'",
      verdict:
        "SOLVED — found concrete evidence in user's GitHub. The 'antigravity' repo has firebase-bridge/.firebaserc (project: epicaltrend-bridge-100) and tools/cloudflared (39MB binary). The free domains the user actually got were Firebase Hosting (*.web.app + *.firebaseapp.com — on the real .app TLD) and Cloudflare Quick Tunnel (*.trycloudflare.com). Not .dev.",
      findings: [
        "GitHub code search for '.dev' + 'domain' + 'firebase' across ALL 31 user repos: 0 matches in any pushed code",
        "Inspected 'antigravity' repo tree (102 entries): core/server.py (28KB AI server), firebase-bridge/ (Telegram bot bridge), tools/cloudflared (39MB binary)",
        "Read firebase-bridge/.firebaserc: project = 'epicaltrend-bridge-100' → free subdomains epicaltrend-bridge-100.web.app and epicaltrend-bridge-100.firebaseapp.com",
        "Read firebase-bridge/functions/index.js: it's a Telegram webhook bridge, not a domain registrar",
        "Read core/server.py first 60 lines: it's a local Python AI server using Ollama, zero domain/.dev mentions",
        "Read AGENT-TOOLKIT catalog/fichas/antigravity.md: confirms 'antigravity' is the consolidated experiment (absorbed ANTIGAVITY-HACK-MEJORADO). No mention of domain registration in any fiche.",
        "ANTIGAVITY-HACK-MEJORADO repo: just skills ecosystem SKILL.md files, no domain code",
        "Conclusion: the 'antigravity function that searched for available .dev' was never pushed to GitHub OR is local-only",
      ],
      likelyExplanation:
        "The user is conflating Firebase Hosting's free .web.app subdomain (which IS on Google's .app TLD) with .dev. The free domain they got via Antigravity setup was epicaltrend-bridge-100.web.app — not a .dev domain. .dev domains are paid Google Registry TLDs ($6+/yr, never free).",
      autoDiscoverAvailable:
        "DOMAIN-MASTER now auto-discovers available .dev/.app/.com candidates via /api/discover endpoint — generates random short names, checks via RDAP in parallel, saves available ones automatically. User doesn't have to lift a finger.",
    },
  });
}
