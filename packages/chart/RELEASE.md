# Release checklist — `@trendcraft/chart`

A per-package checklist for publishing `@trendcraft/chart` to npm.
The full cross-package release workflow (including `trendcraft` coordination and tag naming) lives in the root [`RELEASING.md`](../../RELEASING.md).

## Before publishing

- [ ] All intended work is merged to `main`
- [ ] `packages/chart/CHANGELOG.md` has a versioned heading (promoted from `Unreleased`) with a concrete date
- [ ] `packages/chart/package.json` version bumped
- [ ] If chart calls a newly-added `trendcraft` symbol, `peerDependencies.trendcraft` is bumped to `>=<that-version>` (keep `>=`, not pinned)
- [ ] `pnpm --filter @trendcraft/chart build` succeeds
- [ ] `pnpm --filter @trendcraft/chart test` green
- [ ] `pnpm --filter @trendcraft/chart verify:publish` green — confirms every `package.json#exports` subpath resolves in both ESM and CJS and exposes its advertised symbols
- [ ] `pnpm --filter @trendcraft/chart size-check` within limits. The budget lives in `package.json#size-limit` (brotli). If a feature warrants a raise, get the maintainer's approval, then bump it there and call it out in the CHANGELOG `Changed` section.
- [ ] Docs sanity pass — `README.md`, `docs/*.md`, `llms.txt` reflect any new public API. `llms-full.txt` is generated: run `pnpm --filter @trendcraft/chart gen:llms` after any doc change (CI fails on drift via `llms-full-parity.test.ts`)
- [ ] New viewport/navigation option or semantic? Sweep EVERY navigation consumer — mouse drag, wheel pan/zoom, keyboard (arrows / Home / End), **scrollbar (drag + track click)**, live-edge follow, `fitContent`, duration presets, viewport sync — and verify each honors it. The scrollbar is the historically forgotten one
- [ ] Examples still build: `cd packages/chart/examples/simple-chart && pnpm build` (repeat for `simple-react-chart`, `simple-vue-chart`)

## Publish

Use the **Publish** workflow with `@trendcraft/chart` ticked (dry run first), as described in the root [`RELEASING.md`](../../RELEASING.md). It publishes after trendcraft when both are released together. By hand:

```sh
cd packages/chart
pnpm publish           # runs prepublishOnly: build + test + verify:publish
```

Then tag the published commit (tag after publishing, as for every package):

```sh
git tag -a chart-v<x.y.z> -m "@trendcraft/chart <x.y.z>"
git push origin chart-v<x.y.z>
```

## After publish

- [ ] `npm view @trendcraft/chart@<x.y.z> version` returns the new version
- [ ] The Publish workflow installed the packed tarball into a throwaway project and loaded every `exports` entry before publishing (the "Smoke-test the tarballs" step in its pack job). Optionally, once your package manager's minimum release age allows it, install `@trendcraft/chart@<x.y.z>` from npm into a throwaway project and import each entry point (`.`, `/headless`, `/presets`, `/features`, `/sparkline`, `/replay`, `/react`, `/react/sparkline`, `/vue`, `/vue/sparkline`). `npm view @trendcraft/chart@<x.y.z> dist.integrity` should match the sha512 the pack job logged for the tarball
- [ ] Open a new `Unreleased` section in `CHANGELOG.md` for the next cycle

## Rollback

`pnpm` respects `npm deprecate`. If a broken build ships, deprecate the version rather than unpublishing:

```sh
npm deprecate @trendcraft/chart@<x.y.z> "broken: <reason> — use <x.y.z+1>"
```

Then cut a patch release that fixes the issue.
