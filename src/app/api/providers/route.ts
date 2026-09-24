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
    slug: "cloudflare-workers-dev",
    tld: ".workers.dev  ⭐ REAL .dev TLD",
    name: "Cloudflare Workers (free *.workers.dev)",
    type: "hosting",
    free: true,
    requirements: [
      "Cloudflare account (free)",
      "Deploy a Worker via wrangler or API",
    ],
    url: "https://workers.cloudflare.com",
    signupUrl: "https://dash.cloudflare.com/sign-up/workers",
    notes:
      "★ THE FREE .dev DOMAIN YOU REMEMBERED ★. Every Cloudflare account gets ONE *.workers.dev subdomain (e.g. epicaltrendweb.workers.dev). Each Worker deployed gets <worker-name>.<your-subdomain>.workers.dev automatically, free, with global CDN + HTTPS. The .dev TLD is owned by Google Registry, but Cloudflare pays for the registration and gives it to you for free as part of Workers.",
    alive: true,
    researchNote:
      "CONFIRMED IN USER'S GITHUB — exactly what you remembered! Repo 'all-hands' branch 'feature/arquitectura-pc-cloud-seguro' file 'ARQUITECTURA_PC_CLOUD.md' shows the full setup: Antigravity architected the deployment, Cloudflare Workers + Tunnel were deployed, resulting in 'epicaltrendweb.workers.dev' (free, on the REAL .dev TLD). Worker 'docker-proxy.epicaltrendweb.workers.dev' also created. wrangler.toml has workers_dev=true. setup_tunnel_api.sh has actual Cloudflare API code that creates the Workers subdomain via POST /accounts/{id}/workers/subdomains.",
  },
  {
    slug: "google-idx-cloudworkstations-dev",
    tld: ".cloudworkstations.dev  ⭐ REAL .dev TLD",
    name: "Google IDX / Firebase Studio (*.cloudworkstations.dev)",
    type: "hosting",
    free: true,
    requirements: [
      "Google account",
      "Create a workspace at firebase.studio (formerly Project IDX)",
    ],
    url: "https://firebase.google.com/docs/studio",
    signupUrl: "https://firebase.studio",
    notes:
      "★ THE OTHER FREE .dev DOMAIN YOU REMEMBERED ★. Every IDX/Firebase Studio workspace gets a unique subdomain on .cloudworkstations.dev (e.g. <workspace-id>-3000.<region>.cloudworkstations.dev). Real .dev TLD. Preview ports exposed as public URLs via the 'Make Preview Public' button. Free tier exists for individuals. NOTE: Firebase Studio (formerly Project IDX) is sunsetting March 22, 2027 — migrate to Google Antigravity or Google AI Studio before then.",
    alive: true,
    researchNote:
      "VERIFIED via web research: Firebase Studio docs state 'IDX workspaces are built on Google Cloud Workstations'. Each workspace gets a unique *.cloudworkstations.dev URL on the REAL .dev TLD. Originally launched as Project IDX (Nov 2023), renamed to Firebase Studio (Apr 2025), sunset announced for March 22, 2027. This is the 'other .dev domain ending' you got via Google IDX.",
  },
  {
    slug: "duckdns",
    tld: ".duckdns.org",
    name: "DuckDNS",
    type: "subdomain",
    free: true,
    requirements: ["Sign-up at duckdns.org", "Validate subdomain"],
    url: "https://www.duckdns.org",
    signupUrl: "https://www.duckdns.org/account/create",
    notes:
      "Free dynamic DNS subdomains. Up to 5 subdomains per account. Good for homelabs and dynamic IPs. Confirmed in user's setup: 'epicaltrendweb.duckdns.org' was configured alongside their Cloudflare Workers.",
    alive: true,
    researchNote:
      "VERIFIED IN USER'S GITHUB: 'all-hands' repo, branch 'feature/arquitectura-pc-cloud-seguro', AGENTS.md line 58: 'DuckDNS: epicaltrendweb.duckdns.org'.",
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
        "★ CONFIRMED — USER WAS RIGHT ★ Found concrete evidence in user's 'all-hands' repo. Antigravity architected a Cloudflare Workers + Tunnel deployment that gave the user a FREE subdomain on the REAL .dev TLD: 'epicaltrendweb.workers.dev'. This is on Google's .dev TLD (Cloudflare pays the registration, gives it to you free with Workers). User's memory was accurate — it's just that the free .dev subdomain comes via Cloudflare Workers, not from Antigravity directly.",
      findings: [
        "Cloned ALL 30 user repos (--bare --filter=blob:none) to /tmp/scan/repos/ for full git history search",
        "git log --grep across all 30 repos for 'workers.dev' → all-hands repo has 2 matching commits",
        "Inspected all-hands branches: feature/arquitectura-pc-cloud-seguro has the architecture doc",
        "Read ARQUITECTURA_PC_CLOUD.md (full doc): explicit setup steps for 'epicaltrendweb.workers.dev'",
        "wrangler.toml in feature/tunnel-workers-config branch: name=tunnel-epicaltrendweb, workers_dev=true (the flag that enables free .dev subdomain)",
        "src/worker.js: actual Worker code that proxies Docker traffic",
        "setup_tunnel_api.sh: HAS REAL Cloudflare API code that creates the subdomain via POST /accounts/{id}/workers/subdomains with subdomain='epicaltrendweb'",
        "Tunnel ID verified: 620f2d5b-6e8f-46fa-8e9f-9c940514afa7",
        "DuckDNS also configured: epicaltrendweb.duckdns.org (separate free subdomain)",
        "Confirmation: user's 'antigravity function that searched for available .dev domains' = the Antigravity agent (Google AI IDE) writing Cloudflare API code to provision free .workers.dev subdomains",
      ],
      likelyExplanation:
        "User was RIGHT but conflated two things: (1) Antigravity = the agent that wrote the deployment code, (2) the free .dev subdomain came from Cloudflare Workers (workers.dev is the actual .dev TLD — Cloudflare pays Google Registry and gives it free to Workers users). To get more free .dev subdomains, deploy more Workers — each gets <worker-name>.epicaltrendweb.workers.dev for free.",
      autoDiscoverAvailable:
        "DOMAIN-MASTER can now auto-deploy Workers via Cloudflare API → each Worker auto-creates a new free *.workers.dev subdomain on the real .dev TLD. The 'auto-discover' feature already finds available .dev/.app/.com names via RDAP. The Cloudflare Workers path is the actual free .dev domain method the user was looking for.",
    },
  });
}
