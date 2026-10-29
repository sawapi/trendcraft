# Releasing

Per-package publish checklist for `@trendcraft/chart`: [packages/chart/RELEASE.md](packages/chart/RELEASE.md).

This is a pnpm workspace monorepo with three independently published packages: `trendcraft` (core), `@trendcraft/chart`, and `@trendcraft/mcp`. Treat their versions and releases as independent; only the repository is shared. The serial-release steps below cover the core→chart dependency chain; `@trendcraft/mcp` follows the same conventions (tag `mcp-v<x.y.z>`, finalize its own CHANGELOG, publish after core when it consumes newly-added core APIs).

## Tag naming

Use prefix-dash form so each package's tags are filterable (`git tag -l 'chart-*'`):

- `core-v<major>.<minor>.<patch>` — e.g. `core-v0.2.0`
- `chart-v<major>.<minor>.<patch>` — e.g. `chart-v0.1.0`
- `mcp-v<major>.<minor>.<patch>` — e.g. `mcp-v0.1.0`

The legacy tag `v0.1.0` (no prefix) points to the first `trendcraft` release and is kept as-is. Do not reuse the unprefixed `v*` form for new releases.

## Release order (always serial: core, then chart, then mcp)

1. Merge all changes to `main`.
2. For each package being released, finalize its `CHANGELOG.md` (promote `Unreleased` to the new version with a concrete date) and bump its `package.json` version.
   - If chart calls a newly added core API, raise its `trendcraft` peer minimum to the new core version.
   - mcp depends on core through `"trendcraft": "workspace:^"`. Publishing rewrites that to `^<core version in this commit>`, so bump core first: mcp published against an older core range keeps the older core behaviour.
3. Commit, push and merge the release commit.
4. Publish with the **Publish** workflow (Actions → Publish → Run workflow) on that commit:
   - tick the packages to release, run it once with **Dry run** on, and read the packed files and dependencies in the log;
   - run it again with **Dry run** off.
   For each package it runs `prepublishOnly` (build, test, verify), packs with `pnpm pack`, which rewrites `workspace:` ranges to the versions in the commit, and publishes the tarball with `npm publish`. It publishes core, then chart, then mcp, and waits for core to resolve on npm before the others start. A dry run stops after packing and never contacts the registry, so it also works before the version bump.

   Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC); no npm token is stored. Each of the three packages must list this workflow as its trusted publisher on npmjs.com (package → Settings → Trusted Publisher → GitHub Actions: organization or user `sawapi`, repository `trendcraft`, workflow filename `publish.yml`, no environment). npm attaches provenance automatically.
5. Check `npm view <package>@<x.y.z> version` for each package.
6. Tag the published commit — `core-v<x.y.z>`, `chart-v<x.y.z>`, `mcp-v<x.y.z>` — and push the tags. Tag after publishing, so a tag always names a version that is on npm.

Publishing by hand follows the same order: run `pnpm publish` (never `npm publish` in a package directory, which leaves `workspace:` ranges in the published `package.json`) in `packages/core`, wait for `npm view trendcraft@<x.y.z>` to resolve, then publish chart and mcp, then tag.

Do not publish chart or mcp first when they depend on unreleased core APIs or behaviour; the workspace link hides the gap until users install from npm.

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
