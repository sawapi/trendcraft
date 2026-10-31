# CLAUDE.md

TrendCraft is a TypeScript technical-analysis library: indicators, signal detection, backtesting and optimization for stocks, crypto and other market data. It is a pnpm workspace monorepo with three independently published packages.

| Package | npm name | What it is |
|---|---|---|
| `packages/core` | `trendcraft` | Indicators (130+), signals, backtest, optimization, scoring, screening, risk, strategy JSON, streaming |
| `packages/chart` | `@trendcraft/chart` | Canvas chart that auto-detects TrendCraft series; React/Vue wrappers, headless API, sparkline, replay |
| `packages/mcp` | `@trendcraft/mcp` | MCP server exposing indicator manifests and calc/signal dispatchers to LLM clients |

The public API of each package is its `src/index.ts` (chart also has `headless.ts`, `presets.ts`, `replay.ts`, `sparkline/`, and the `react/` and `vue/` wrappers). Package docs are under `packages/core/docs/` and `packages/chart/docs/`.

## Commands

```bash
pnpm install --frozen-lockfile   # always --frozen-lockfile; see below
pnpm lint                        # Biome (pnpm lint:fix to apply fixes)
pnpm build                       # all workspace packages, plus strategy-studio
pnpm typecheck                   # needs pnpm build first: chart/mcp check against core's dist types
pnpm test                        # Vitest in every package
pnpm check:links                 # relative links and #anchors in every tracked .md file
```

Package-level commands:

- **core:** `pnpm test:crossval` runs the TA-Lib cross-validation, `pnpm bench` the benchmarks, and `pnpm exec size-limit` the bundle size check.
- **chart:**
  - `pnpm test:e2e` runs the Playwright browser tests (see `e2e/README.md`).
  - `pnpm size-check` checks the bundle sizes.
  - `pnpm gen:llms` regenerates `llms-full.txt` after doc changes. CI fails on drift.

Use `--frozen-lockfile` for every install. A plain `pnpm install` in a fresh `git worktree` has produced an incomplete dependency graph: vue/react types failed to resolve inside vite-plugin-dts (TS2305 during `pnpm build`), even though the lockfile was reported as up to date.

`minimumReleaseAge` in `pnpm-workspace.yaml` blocks package versions younger than 3 days. Dependabot PRs and upgrades must respect it. For an urgent security fix, exempt that one package rather than lowering the age.

## Examples

Examples live in `packages/core/examples/` and `packages/chart/examples/`; list the directories for the current set. They are not like the packages:

- **Install:** every example except strategy-studio installs on its own with `pnpm install --ignore-workspace` and has its own lockfile.
  - strategy-studio is a workspace member, and it also keeps a standalone lockfile. After a dependency change, update that lockfile with `pnpm install --ignore-workspace --lockfile-only`.
- **Workspace prerequisite:**
  - **Chart examples:** Vite aliases `trendcraft` and `@trendcraft/chart` to their sources, so `pnpm dev` works standalone. `pnpm build` type-checks those sources, so it needs the workspace install at the repo root first.
  - **Core examples** (echarts-viewer, trading-simulator): these have no alias. `trendcraft` resolves through core's package exports to its `dist`, so both `pnpm dev` and `pnpm build` need `pnpm build` at the root first.
  - **Anything else that imports a `dist`** also needs that root build: docs-screenshots, the strategy-studio tests, and `USE_DIST=1`.
- **Config files:** each `vite.config.ts` is type-checked through a `tsconfig.node.json` next to it. In the packages this runs in `typecheck`; in the examples it runs in `build`. A new config file goes into that `include`.
- **Typecheck:** core's `typecheck` also type-checks the quick-start and sp500-showcase examples, through `packages/core/tsconfig.examples.json`.
- **CI coverage:** CI builds only some examples standalone; see the "Build examples" step in `.github/workflows/ci.yml`. For an example outside that list, run its `pnpm build` yourself.
- **Alpaca:** the Alpaca dev proxies in strategy-studio, echarts-viewer and trading-simulator allow only the GET endpoints those apps use. Keep that allowlist when touching them.

### echarts-viewer and trading-simulator (`packages/core/examples/`)

Both are ECharts apps, and each has its own settings dialog.

- A new indicator or feature with UI settings must be added to that app's `src/components/IndicatorSettingsDialog.tsx`. The UI does not discover indicators on its own.
- ECharts layout:
  - Account for label height, title heights, margins and dataZoom position, and check that nothing overlaps.
  - Overlay indicators go on the main chart, not in a subchart, unless asked otherwise.
- ECharts colours:
  - A line series takes its legend and tooltip colour from `itemStyle.color` or the palette, not `lineStyle.color`. Set `itemStyle.color` too.
  - For a histogram coloured per bar, set the series `itemStyle.color` to one representative bar colour (the up or high one), so the legend shows a real colour.

## Conventions

- **Language:** English for all code, comments, UI text, READMEs and docs.
- **Indicators:**
  - Return `Series<T>` (`{ time: number; value: T }[]`).
  - Use Wilder's smoothing where the indicator defines it (RSI, ATR, …).
  - Include a JSDoc comment with an `@example`.
- **Size:** if a file is over 500 lines, propose splitting it before adding more.
- **Tests:** go in `__tests__/` next to the code they cover.
- **`@trendcraft/chart` bundle size:**
  - `size-limit` in `packages/chart/package.json` is the source of truth. React/Vue wrappers include main, so main's growth counts against them too.
  - Raising a limit needs explicit approval from the maintainer.
  - Zero runtime dependencies. `trendcraft`, `react` and `vue` are optional peer deps.
- **Chart presets:** when wiring `connectIndicators(chart, { presets: indicatorPresets, ... })`, also call `registerTrendCraftPresets(chart)` from `@trendcraft/chart/presets` before adding indicators. Without it, TrendCraft-specific shapes fall through the built-in introspection and silently render as a generic "Series" with no visible line. This affects adaptiveRsi, connorsRsi, klinger, vsa and others. The canonical setup is in `packages/chart/examples/indicator-showcase/src/main.ts`.

## Workflow

- **Questions:** when the maintainer asks about the current state, answer first. Do not change code that was not asked to be changed.
- **Branches:** work on a branch, never directly on `main`. Use one commit per logical change. Fold review fixes into that commit (amend) rather than stacking fix-up commits.
- **Tests:**
  - A bug fix comes with a test that fails on the old code.
  - Where a test runner does not reach (examples, configs), show the failure with a script or a browser check instead, and describe it in the PR.
- **Before pushing:** run `pnpm lint`, `pnpm build` and `pnpm typecheck`, plus `pnpm test` for code changes and `pnpm check:links` for Markdown changes.
- **Pull requests:**
  - Open a PR; once it is reviewed and CI is green, merge it.
  - The PR body states what changed, why, and how it was verified.
  - Do not add attribution lines.
- **Ask first:** dependency major upgrades with breaking changes, size-limit raises, public API removals or renames, and anything outward-facing beyond the PR itself.
  - "Outward-facing" covers releases, tags, npm publish and repository settings.
- **API and design decisions:** check how comparable libraries handle the same problem, and cite what you checked.

Releases: see [RELEASING.md](RELEASING.md).
