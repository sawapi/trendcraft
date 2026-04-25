# Release checklist — `@trendcraft/chart`

A per-package checklist for publishing `@trendcraft/chart` to npm.
The full cross-package release workflow (including `trendcraft` coordination and tag naming) lives in the root `CLAUDE.md`.

## Before tagging

- [ ] All intended work is merged to `main`
- [ ] `packages/chart/CHANGELOG.md` has a versioned heading (promoted from `Unreleased`) with a concrete date
- [ ] `packages/chart/package.json` version bumped
- [ ] If chart calls a newly-added `trendcraft` symbol, `peerDependencies.trendcraft` is bumped to `>=<that-version>` (keep `>=`, not pinned)
- [ ] `pnpm --filter @trendcraft/chart build` succeeds
- [ ] `pnpm --filter @trendcraft/chart test` green
- [ ] `pnpm --filter @trendcraft/chart verify:publish` green — confirms every `package.json#exports` subpath resolves in both ESM and CJS and exposes its advertised symbols
- [ ] `pnpm --filter @trendcraft/chart size-check` within limits. The authoritative budget lives in `package.json#size-limit` (currently main ≤ 36 kB, headless ≤ 11 kB, React/Vue ≤ 30 kB, brotli). If a feature warrants a raise, bump it there and call it out in the CHANGELOG `Changed` section.
- [ ] Docs sanity pass — `README.md`, `docs/*.md`, `llms.txt`, `llms-full.txt` reflect any new public API
- [ ] Examples still build: `cd packages/chart/examples/simple-chart && pnpm build` (repeat for `simple-react-chart`, `simple-vue-chart`)

## Publish

```sh
cd packages/chart
pnpm publish           # runs prepublishOnly: build + test + verify:publish
git tag chart-v<x.y.z>
git push origin chart-v<x.y.z>
```

## After publish

- [ ] `npm view @trendcraft/chart@<x.y.z> version` returns the new version
- [ ] Spot-install into a throwaway project and import each entry point (`.`, `/headless`, `/presets`, `/react`, `/vue`) to confirm the published tarball behaves like the local build
- [ ] Open a new `Unreleased` section in `CHANGELOG.md` for the next cycle

## Rollback

`pnpm` respects `npm deprecate`. If a broken build ships, deprecate the version rather than unpublishing:

```sh
npm deprecate @trendcraft/chart@<x.y.z> "broken: <reason> — use <x.y.z+1>"
```

Then cut a patch release that fixes the issue.
