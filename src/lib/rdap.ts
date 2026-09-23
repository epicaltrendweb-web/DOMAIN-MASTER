// lib/rdap.ts — RDAP lookup helper
// RDAP = Registration Data Access Protocol (the modern WHOIS).
// Bootstrapped via https://rdap.org/domain/<domain> which redirects
// to the right registry's RDAP server. Returns JSON for registered
// domains, 404 for available ones, and 400/404/5xx on bootstrap for
// TLDs without RDAP support (we then fall back to "unknown").

const RDAP_BOOTSTRAP = "https://rdap.org/domain/";

export type RdapResult = {
  available: boolean | null; // true=available, false=taken, null=unknown
  status: "available" | "taken" | "unknown" | "error";
  registrar: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  nameservers: string[];
  rawStatus: string[];
  responseTimeMs: number;
  httpStatus: number;
  errorMessage?: string;
};

function extractRegistrar(data: any): string | null {
  const entities = data?.entities;
  if (!Array.isArray(entities)) return null;
  for (const e of entities) {
    const roles: string[] = e?.roles ?? [];
    if (roles.includes("registrar")) {
      const vcard = e?.vcardArray?.[1];
      if (Array.isArray(vcard)) {
        for (const field of vcard) {
          if (Array.isArray(field) && field[0] === "fn" && typeof field[3] === "string") {
            return field[3];
          }
        }
      }
      // fallback: handle
      if (typeof e?.handle === "string") return e.handle;
    }
  }
  return null;
}

function extractDate(events: any[], action: string): string | null {
  if (!Array.isArray(events)) return null;
  const ev = events.find((e) => e?.eventAction === action);
  return ev?.eventDate ?? null;
}

export async function checkDomainRdap(domain: string): Promise<RdapResult> {
  const start = Date.now();
  const name = domain.trim().toLowerCase();
  const url = `${RDAP_BOOTSTRAP}${encodeURIComponent(name)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Accept: "application/rdap+json",
        // rdap.org is fronted by Cloudflare and blocks requests with no UA.
        "User-Agent": "DOMAIN-MASTER/1.0 (+https://github.com/epicaltrendweb-web/DOMAIN-MASTER)",
      },
      redirect: "follow",
      // Next.js fetch with no-store so we don't cache stale availability
      cache: "no-store",
    });

    const elapsed = Date.now() - start;

    // 200 → registered (taken)
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      const events = data?.events ?? [];
      const registrar = extractRegistrar(data);
      const registeredAt = extractDate(events, "registration");
      const expiresAt = extractDate(events, "expiration");
      const nameservers: string[] = Array.isArray(data?.nameservers)
        ? data.nameservers
            .map((ns: any) => ns?.ldhName ?? ns?.handle)
            .filter((s: any) => typeof s === "string")
        : [];
      const rawStatus: string[] = Array.isArray(data?.status) ? data.status : [];

      return {
        available: false,
        status: "taken",
        registrar,
        registeredAt,
        expiresAt,
        nameservers,
        rawStatus,
        responseTimeMs: elapsed,
        httpStatus: resp.status,
      };
    }

    // 404 → available
    if (resp.status === 404) {
      return {
        available: true,
        status: "available",
        registrar: null,
        registeredAt: null,
        expiresAt: null,
        nameservers: [],
        rawStatus: [],
        responseTimeMs: elapsed,
        httpStatus: 404,
      };
    }

    // 400, 422, etc → bootstrap can't resolve the TLD → unknown
    if (resp.status === 400 || resp.status === 422 || resp.status === 501) {
      return {
        available: null,
        status: "unknown",
        registrar: null,
        registeredAt: null,
        expiresAt: null,
        nameservers: [],
        rawStatus: [],
        responseTimeMs: elapsed,
        httpStatus: resp.status,
        errorMessage: "TLD has no RDAP server — manual WHOIS lookup needed",
      };
    }

    // Other status codes
    return {
      available: null,
      status: "error",
      registrar: null,
      registeredAt: null,
      expiresAt: null,
      nameservers: [],
      rawStatus: [],
      responseTimeMs: elapsed,
      httpStatus: resp.status,
      errorMessage: `Unexpected HTTP ${resp.status}`,
    };
  } catch (e) {
    const elapsed = Date.now() - start;
    return {
      available: null,
      status: "error",
      registrar: null,
      registeredAt: null,
      expiresAt: null,
      nameservers: [],
      rawStatus: [],
      responseTimeMs: elapsed,
      httpStatus: 0,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}
