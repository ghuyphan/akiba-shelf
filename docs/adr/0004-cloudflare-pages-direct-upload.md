# ADR 0004: Cloudflare Pages Direct Upload

- Status: Accepted
- Date: 2026-07-23

## Context

Matsuri needs atomic static releases, application-route fallback, custom-domain
TLS, immutable asset caching, and one auditable production pipeline.

## Decision

GitHub Actions is the build and release gate. It uploads the verified `dist/`
artifact to the Cloudflare Pages Direct Upload project `matsuri` using Wrangler.
`matsuri.pro` is canonical; `www` redirects at the Cloudflare zone. The workflow
retains only one previous immutable asset generation, publishes deterministic
release metadata, serializes production deployments, and runs post-deploy smoke
checks.

## Consequences

- Do not enable GitHub Pages or a second Git-integrated Pages deployer.
- Provider credentials live only in the protected GitHub environment.
- Rollback uses a prior Pages deployment, followed by the same smoke checks.
- `_headers`, release metadata, service-worker cache versions, and operational
  probes are part of the release contract.
