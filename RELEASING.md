# Releasing

Per-package publish checklist for `@trendcraft/chart`: [packages/chart/RELEASE.md](packages/chart/RELEASE.md).

This is a pnpm workspace monorepo with three independently published packages: `trendcraft` (core), `@trendcraft/chart`, and `@trendcraft/mcp`. Treat their versions and releases as independent; only the repository is shared. The serial-release steps below cover the core→chart dependency chain; `@trendcraft/mcp` follows the same conventions (tag `mcp-v<x.y.z>`, finalize its own CHANGELOG, publish after core when it consumes newly-added core APIs).

## When to release

Cut a release of a package when either of these is true, whichever comes first:

- its `Unreleased` section has more than 10 `Breaking` entries, or
- a month has passed since its last release, and its `Unreleased` section is not empty.

[Versioning](#versioning-semver-under-0x) decides whether it is a minor or a patch.

Bug fixes do not wait for either trigger:

- a fix for a bug users can see (a wrong calculation, a broken install, broken types or a rendering bug) ships within a few days. Versioning decides whether that release is a patch or a minor, counting everything already in `Unreleased`. Fixes that land close together share one release;
- documentation-only changes do not trigger a release, unless they correct a published README or `llms` file that leads users to wrong usage.

Once the release PR (version bump and CHANGELOG promotion) is opened, its contents are fixed. Changes merged after that go into the next version, not this one. A late addition means rewriting CHANGELOG entries and migration notes at the last minute.

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
   A pack job runs `prepublishOnly` (build, test, verify) for each ticked package and packs it with `pnpm pack`, which rewrites `workspace:` ranges to the versions in the commit. It logs each tarball's sha512 integrity, uploads the tarballs as an artifact, and then smoke-tests copies of them. The smoke test (`scripts/smoke-test-tarballs.mjs`) installs them into a throwaway project with npm, chart and mcp together with the trendcraft tarball from the same commit, then loads every `exports` entry (ESM and CJS), runs every CLI with `--help`, and runs the MCP handshake. The publish jobs then download those tarballs, refuse any whose integrity differs from what the pack job logged, and publish them with `npm publish`: core, then chart, then mcp, waiting for core to resolve on npm before the others start. Only the publish jobs can request the OIDC token npm accepts for publishing, and they run no package code, so the third-party packages the smoke test installs (react, vue, the MCP SDK) never run next to that token. A dry run runs the same jobs but skips `npm publish` and the npm checks around it, so it publishes nothing and also works before the version bump.

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
- One CHANGELOG per package (`packages/core/CHANGELOG.md`, `packages/chart/CHANGELOG.md`, `packages/mcp/CHANGELOG.md`). Do not maintain a root CHANGELOG.
- Commit messages can be terse; the CHANGELOG is the user-facing surface and should be written for consumers, not reviewers.
- Open each released version, patch releases included, with a summary, directly under its version heading and before the categorized entries:
  - one or two sentences on what the release is;
  - for a release with `Breaking` entries, a "Most likely to affect you" table (What / Was / Now) of the changes most users will hit, and a link to the migration guide if there is one.

  Write it in the release PR, when `Unreleased` is promoted. The GitHub Release notes reuse it.

## Pre-release (optional)

For the first coupled release of core + chart, or any time the API contract between the two is in doubt, consider `core-v0.x.0-rc.0` / `chart-v0.x.0-rc.0` on npm's `next` dist-tag first, verify integration against the real registry, then promote to stable.
