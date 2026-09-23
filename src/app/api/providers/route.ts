// /api/providers
// Static catalog of researched free-domain providers (status as of 2024-2026).
// Freenom (.tk, .ml, .ga, .cf, .gq) is intentionally NOT included (dead since 2023).

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Provider = {
  slug: string;
  tld: string;
  name: string;
  type: "subdomain" | "tld" | "student";
  free: boolean;
  requirements: string[];
  url: string;
  signupUrl?: string;
  notes: string;
  alive: boolean;
};

const PROVIDERS: Provider[] = [
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
      "Up to 10 free real TLD domains per year through Name.com, for verified students.",
    alive: true,
  },
  {
    slug: "dev-google",
    tld: ".dev",
    name: ".dev (Google Registry) — PAID",
    type: "tld",
    free: false,
    requirements: ["Paid (~$12/yr typical)"],
    url: "https://www.registry.google",
    notes:
      "Not free — listed because user mentioned. HSTS-preloaded secure TLD. Buy via Cloudflare, Porkbun, Namecheap, etc.",
    alive: true,
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
      "Not free — listed because user mentioned. HSTS-preloaded, perfect for web apps.",
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
];

export async function GET() {
  return NextResponse.json({
    ok: true,
    total: PROVIDERS.length,
    free: PROVIDERS.filter((p) => p.free).length,
    paid: PROVIDERS.filter((p) => !p.free).length,
    providers: PROVIDERS,
    updatedAt: "2024-2026 research",
    note:
      "Freenom TLDs (.tk, .ml, .ga, .cf, .gq) excluded — new registrations stopped 2023 after Meta lawsuit.",
  });
}
