# Vendored simulator ownership

Matsuri owns the production behavior of both simulator workspaces even though
their original licenses, attribution, and standalone documentation remain in
their local README files.

## Sources

- `vendor/gacha-simulator`: forked from AguzzTN54's Genshin Impact Wish
  Simulator lineage; Matsuri owns its dynamic catalog, limits, offline pack,
  accessibility, and storefront-host integration patches.
- `vendor/hsr-simulator`: forked from the Mantan21/AguzzTN54 HSR Warp Simulator
  lineage; Matsuri owns the same integration surface for the HSR game type.

The workspaces are committed source, not generated dependencies. Do not replace
either directory from upstream wholesale. Review upstream changes, port the
smallest relevant patch, preserve Matsuri configuration contracts, and record
the upstream commit or release in the resulting change description.

## Dependency policy

Root `package-lock.json` owns both workspace dependency graphs. Update simulator
dependencies through the root workspace, review browser bundle and offline-pack
impact, and run `npm audit --omit=dev` for any dependency change. Keep each
workspace's SvelteKit generation compatible with the root Node version.

Review simulator dependencies monthly and upstream simulator changes quarterly.
Security fixes affecting production browser code take priority over that cadence.
Never add a nested lockfile; `npm run check:simulator-contracts` enforces package
names, root workspace ownership, required build/check scripts, ignored generated
outputs, and authoritative media roots. Shared build metadata lives in
`scripts/simulator-config.mjs`; do not duplicate workspace or route mappings.

HSR retains sound effects but no music player. Sound effects are instantiated
and fetched only on first unmuted use; importing the sound module or browsing
while muted must create no audio requests. Offline packs still include the SFX
files so an explicitly saved simulator remains complete.

## Required verification

`npm run check:simulators` requires zero Svelte errors, warnings, and hints in
both workspaces. Production builds always rebuild both simulators; retained
`.gacha-dist` and `.hsr-gacha-dist` directories are caches or build outputs,
never release evidence.

For simulator changes, run:

```bash
npm run check:simulators
npm run test:security
npm run test:simulators
npm run build:simulators
```

`npm run verify:simulators` runs the complete sequence above, including the
workspace contract check.

Also run the relevant root unit/e2e, PWA, and performance gates when host
messaging, media routing, offline packs, limits, or visible behavior changes.
Follow `docs/gacha-invariants.md` for product rules and `docs/operations.md` for
R2 delivery, release artifacts, cache retention, and rollback.
