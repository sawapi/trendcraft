# Releasing

Per-package publish checklist for `@trendcraft/chart`: [packages/chart/RELEASE.md](packages/chart/RELEASE.md).

This is a pnpm workspace monorepo with three independently published packages: `trendcraft` (core), `@trendcraft/chart`, and `@trendcraft/mcp`. Treat their versions and releases as independent; only the repository is shared. The serial-release steps below cover the core→chart dependency chain; `@trendcraft/mcp` follows the same conventions (tag `mcp-v<x.y.z>`, finalize its own CHANGELOG, publish after core when it consumes newly-added core APIs).

## Tag naming

Use prefix-dash form so each package's tags are filterable (`git tag -l 'chart-*'`):

- `core-v<major>.<minor>.<patch>` — e.g. `core-v0.2.0`
- `chart-v<major>.<minor>.<patch>` — e.g. `chart-v0.1.0`
- `mcp-v<major>.<minor>.<patch>` — e.g. `mcp-v0.1.0`

The legacy tag `v0.1.0` (no prefix) points to the first `trendcraft` release and is kept as-is. Do not reuse the unprefixed `v*` form for new releases.

## Release order (always serial)

When a change spans both packages (chart relies on core's new API), release must be serial to avoid peer dep drift:

1. Merge all changes to `main`
2. Finalize `packages/core/CHANGELOG.md` — promote `Unreleased` to the new version with a concrete date
3. Bump `packages/core/package.json` version
4. Tag `core-v<x.y.z>` on that commit, push tag, run `pnpm publish` for core
5. Wait for `npm view trendcraft@<x.y.z> version` to resolve
6. Update `packages/chart/package.json` peer dep minimum to the just-published core version if chart uses new core APIs
7. Finalize `packages/chart/CHANGELOG.md` — fill in the date
8. Bump `packages/chart/package.json` version
9. Tag `chart-v<x.y.z>`, push tag, run `pnpm publish` for chart

Do not publish chart first when it depends on unreleased core APIs; the `workspace:*` link hides the missing peer until users actually install from npm.

## Peer dep hygiene

- `@trendcraft/chart`'s peer on `trendcraft` must be `>=<latest-core-using-APIs-we-call>`. Bump it whenever chart starts calling a newly-added core symbol.
- Keep the peer a `>=` range, not an exact pin — users should be able to pick up core patch releases freely.

## Versioning (SemVer under 0.x)

- Pre-1.0, minor bumps (`0.x.0`) are allowed to carry breaking changes; patch bumps (`0.x.y`) must be backward compatible.
- API surface changes that are purely additive still warrant a minor bump when the surface meaningfully grows (e.g. a whole new entry point, 50+ new exports).
- Rename/remove of a previously-exported symbol = minor bump (documented in CHANGELOG's "Breaking" subsection). A symbol that was never exported in a published version is not breaking.

## CHANGELOG convention

- Keep an `Unreleased` / draft section at the top while work is in flight. Promote to a versioned heading at release time with a concrete date.
- One CHANGELOG per package (`packages/core/CHANGELOG.md`, `packages/chart/CHANGELOG.md`). Do not maintain a root CHANGELOG.
- Commit messages can be terse; the CHANGELOG is the user-facing surface and should be written for consumers, not reviewers.

## Pre-release (optional)

For the first coupled release of core + chart, or any time the API contract between the two is in doubt, consider `core-v0.x.0-rc.0` / `chart-v0.x.0-rc.0` on npm's `next` dist-tag first, verify integration against the real registry, then promote to stable.
