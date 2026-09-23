# DOMAIN-MASTER

> Domain availability search + free domain discovery.
> Find which domains are free to register, and discover providers that give away free TLDs (`.dev`, `.app`, `.page`, `.eu.org`, `.js.org`, and more).

Built with **Next.js 16 + TypeScript + Tailwind CSS 4 + Prisma (SQLite) + shadcn/ui**.

## Features

- **Domain availability search** — uses RDAP (the modern WHOIS replacement, no auth required) to check if a domain is available to register. Falls back gracefully on TLDs without RDAP.
- **Free domain provider catalog** — curated, researched list of providers that still offer free domains (Freenom is dead since 2023; we only list working providers).
- **Tracked domains** — save domains you care about to the local SQLite DB, with last-checked status, registrar, expiration, and per-check history.
- **Re-check** — re-run availability for any tracked domain; full audit log in `CheckLog`.

## Why RDAP?

RDAP (Registration Data Access Protocol) is the IETF standard that replaces WHOIS.
- Returns structured JSON (not plain text like WHOIS).
- Bootstrapped through `https://rdap.org/domain/<domain>` which redirects to the right registry server.
- `200 OK` → registered (taken).
- `404 Not Found` → available to register.
- `400/404/5xx on bootstrap` → TLD has no RDAP server (we mark as "unknown, manual check needed").

## Free domain providers in this catalog

| TLD / Provider   | Type           | Requirement                          | Notes |
|------------------|----------------|--------------------------------------|-------|
| `.eu.org`        | Subdomain TLD | None (manual approval)               | Free, never expires, run by volunteers since 1996. Most reliable free option in 2024-2026. |
| `.js.org`        | Subdomain TLD  | Open-source project on GitHub        | Free for OSS projects hosted on GitHub Pages. |
| DigitalPlat FreeDomain (`*.dpdns.org`, `*.freedomain.one`) | Subdomain | GitHub account, DNS learning | Open-source project on GitHub. |
| Dynu (`*.dynu.net`, `*.freedns.ch`) | Dynamic DNS | Sign-up | Free dynamic DNS subdomains. |
| FreeDNS (afraid.org) | Subdomains | Sign-up | Many shared subdomains available. |
| GitHub Student Pack (Name.com) | Real TLDs (`.live`, `.studio`, `.games`, `.software`, etc.) | Student verification | Up to 10 free domains/year. |
| `.dev`, `.app`, `.page`, `.zip` (Google registry) | Real TLDs | PAID — listed for awareness | Not free; included because user asked. These are HSTS-preloaded secure TLDs. |

> **Note on `.tk`, `.ml`, `.ga`, `.cf`, `.gq`**: Freenom stopped allowing new registrations in 2023 after legal action from Meta. These are NOT included.

## Project structure

```
prisma/
  schema.prisma              # TrackedDomain + CheckLog models
src/
  app/
    page.tsx                  # DOMAIN-MASTER UI (search + providers + tracked)
    layout.tsx
    api/
      domains/check/route.ts  # GET ?name=foo.dev → RDAP lookup
      providers/route.ts      # GET → static catalog of free providers
      tracked/route.ts        # GET (list) + POST (create) + DELETE
  lib/
    db.ts                     # Prisma client
    rdap.ts                   # RDAP lookup helper
```

## Getting started

```bash
# Install
bun install

# Apply DB schema
bun run db:push

# Start dev server
bun run dev
# → http://localhost:3000
```

## API quick reference

| Method | Endpoint                          | Body / Query                  | Returns |
|--------|-----------------------------------|-------------------------------|---------|
| GET    | `/api/domains/check?name=X`       | `name` query                  | `{ available, status, registrar, registeredAt, expiresAt, responseTimeMs }` |
| GET    | `/api/providers`                  | —                             | `[{ slug, tld, name, type, requirements, url, notes }]` |
| GET    | `/api/tracked`                    | —                             | list of `TrackedDomain` with last check |
| POST   | `/api/tracked`                    | `{ name, notes? }`            | created `TrackedDomain` (auto-checks availability) |
| DELETE | `/api/tracked?id=...`             | `id` query                    | `{ ok: true }` |
| POST   | `/api/tracked/check?id=...`       | `id` query                    | re-checks one tracked domain, appends `CheckLog` |

## License

MIT — use it, fork it, ship it.
