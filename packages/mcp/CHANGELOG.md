# Changelog

## Unreleased

## 0.4.0 (2026-10-30)

### Fixed — the server reports its real version

`SERVER_VERSION`, which the server sends to clients on connect, was a
hand-written `"0.2.0"` that the 0.3.0 release still reported. It is now read
from `package.json` at build time.

### Security — a large `candles` array could exhaust the server's memory

An array schema in `zod` records one issue per invalid element
(GHSA-mrhx-c7xc-m3w5). The tool inputs `candles` and `candlesArray` were
unbounded arrays of that kind, validated before the handlers checked the
100,000-bar limit, so a client sending a huge array of invalid bars could
exhaust the server's memory. Both schemas now carry the 100,000 bound, and
`zod` is now `^4.6.7`, which checks a bound before walking the elements
(4.6.6 fixed that order). An oversized array is therefore rejected by the
SDK's input validation, before any tool handler runs: the error text
(`INVALID_INPUT: candles must contain at most 100000 entries`) is the same,
but it arrives as an input-validation error rather than from the tool.

### Security — requires `@modelcontextprotocol/sdk` 1.32.1 or later

The dependency range was `^1.29.0`, which admits SDK versions with known
advisories (GHSA-46jr-4wx8-v453, GHSA-22jm-h49p-29qw, GHSA-6qxp-vccf-f47h,
GHSA-rvq5-wwqv-78pq, GHSA-6prh-2h8m-c8cw; fixed by 1.32.0). They concern
the SDK's HTTP and OAuth transports, its bearer authentication and its
experimental tasks; `trendcraft-mcp` serves over stdio only and uses none
of them, so it was not exposed. The range is now `^1.32.1`, so an install
can no longer resolve an affected version.

### Changed — `calc_indicator("dpo")` is causal by default

It follows `trendcraft`'s `dpo()`: each value is now stamped at the bar
where it is first known (`Price[i - shift] - SMA[i]`, `shift` bars later
than before), so it no longer reads future bars. Pass `centered: true` for
the previous, centered series.

### Changed — requires `trendcraft` 0.6.0 or later

The dependency range moves from `^0.5.0` to `^0.6.0`, so installs pick up
the correctness fixes in core 0.6.0. No tool signature changes, but the
**values the tools return change** wherever those fixes apply: besides
`dpo` above, `calc_indicator("supertrend")` has no direction (`supertrend:
null`) until the close first breaks a band, where it used to start in a
downtrend. See the
`trendcraft` 0.6.0 changelog.

### Breaking — requires Node.js 22 or later

`engines.node` is now `>=22.0.0` (was `>=18.0.0`). Node.js 18 and 20 have
reached end of life, and 18 was never tested. CI now tests Node.js 22, 24
and 26. On Node.js 20 or older, most package managers warn when installing
`@trendcraft/mcp`; some refuse (yarn 1, or npm and pnpm with
`engine-strict`). The server is now built for Node.js 22 (esbuild target
`node22`, was `node18`).

### Fixed — `calc_indicator` reported `volumeProfile` as an empty series

`volumeProfile` returns one profile object, not a per-bar series, and
`calc_indicator` replaced any non-series result with `[]`, so it returned a
successful `{ count: 0, series: [] }` and dropped the POC, value area and
levels. A kind whose result is not a series now fails with
`UNSUPPORTED_KIND`. The code's documented meaning now covers both cases: no calc
wrapper, or a result that is not a per-bar series.

### Fixed — `UNSUPPORTED_KIND` promised more kinds than discovery lists

The error told callers that `list_indicators({ calcSupported: true })` would
show "all 59 computable kinds", but it lists 45: the other wrappers have no
manifest entry. The count now comes from the same source as that listing.

### Fixed — manifest-advertised object params were rejected

The manifest's `paramHints` advertise `vwap`'s `session` and
`volatilityRegime`'s `thresholds`, both objects, but `calc_indicator`
rejected every nested object with "pass primitives only". An object is now
accepted for a key the kind's `paramHints` names, with its values (and a
`breaks` array of flat objects) checked by the same rules as top-level
params. Other object values, arrays of objects outside such a param, and
objects on number-style keys such as `period` are still rejected. What the
object means is checked by the indicator itself: `trendcraft` now rejects a
session with missing or out-of-range clock fields and non-numeric
thresholds.

### Breaking — input size limits

Tools now refuse more than 100,000 candles in one call or one
`load_candles` handle, a `symbol` longer than 64 characters, and a `hint`
longer than 1,000, with an `INVALID_INPUT` error. Without them, a session
could retain unbounded data across the up to 50 handles it keeps. The check
runs after a request has been parsed, so it bounds retained data, not the
cost of parsing one huge request.

### Fixed — the `detect_signal` response example in `EXAMPLES.md` was missing `processedBars`

The recipe's sample response showed every field except `processedBars`, which
the tool has returned since 0.2.0. The example now shows it.

Every `json` / `jsonc` example in `EXAMPLES.md` and `README.md` is now
executed against the real tool handlers in CI: each fence carries a
`<!-- doctest-example: ... -->` marker naming the tool and kind it shows, and
the keys in the example are compared with a real response (recursively; an
example with an ellipsis may omit keys, one without must show them all). A
field added to or renamed in a response now fails the build until the example
follows — the class of drift that previously reached a release unnoticed.

## 0.3.0 (2026-07-26)

### Fixed — tool descriptions and examples now match runtime behavior

A tool description is not internal documentation here: it is handed to the
model on the other side of the protocol and shapes the calls it makes. Several
had drifted from what the server actually does, so a client was being told the
wrong parameter names and the wrong response shape.

- Corrected the documented parameters for `rsiDivergence` and the detection
  semantics of `volumeBreakout`.
- Documented candlestick-pattern support in `detect_signal`, along with the
  `processedBars` and `symbol` fields it returns.
- Documented the `storeSize` and `capacity` fields returned by `load_candles`.
- Corrected the MACD parameters and the RSI-divergence output shape in
  `EXAMPLES.md`.

### Changed — requires `trendcraft` 0.5.0 or later

The dependency range is raised so that installs pick up the correctness fixes
in core 0.5.0. No tool signature changes, but the **values the tools return
change** wherever those fixes apply — most visibly annualized Sharpe and
Sortino, Cornish-Fisher VaR, the MAR optimization metric, variance-derived
indicators at high price levels, and every time-bucketed indicator when
candles are stamped in epoch seconds. See the `trendcraft` 0.5.0 changelog.

## 0.2.0 (2026-06-09)

### Fixed — reject non-finite candle OHLCV at the input boundary

The candle schemas accepted `NaN` / `±Infinity` (bare `z.number()`), unlike
params, so a non-finite OHLCV value flowed into every indicator/signal and
returned a NaN-poisoned result with `ok: true` instead of a clear
`INVALID_INPUT`. The schemas now require finite numbers.

### Fixed — volume-reading signals require a real volume on every bar

`detect_signal` checked only `volume === undefined`, so a volume-based signal
(or one routed onto volume via `source: "volume"`) silently fabricated a `0`
volume — distorting the volume average — for omitted or `NaN` volumes. Such
input is now rejected with `INVALID_INPUT`; price-only signals still tolerate a
missing volume.

### Changed — bumped `zod` to v4

The runtime `zod` dependency moved from v3 to v4. No schema behavior changes for
callers: the validation contract that callers actually observe (non-finite OHLCV
rejection, candle length, the exactly-one-of `candles` / `candlesArray` /
`candlesRef` rule) is enforced by explicit `INVALID_INPUT` throws in the
resolver/handler and surfaced through the canonical error envelope, not by zod's
own error format — so a major `zod` bump leaves the caller-visible error shape
unchanged.

### Changed — exclude `.d.ts.map` from the published tarball

`dist/**/*.d.ts.map` is now excluded from the npm package `files` list (alongside
the already-excluded `.js.map` / `.cjs.map`). The declaration maps shipped no
consumer value and embedded absolute local source paths; dropping them yields a
smaller tarball and stops leaking build-machine paths.

### Added — upfront `params` shape guard for `calc_indicator` / `detect_signal`

`validateIndicatorParams` rejects structurally broken `params`
objects before the underlying function runs, returning
`INVALID_PARAMETER` with actionable hints:

- non-object / array / `null` `params` → reject with the actual type
- nested-object values → reject (`{ period: { value: 14 } }`)
- `NaN` / `±Infinity` numbers → reject
- arrays containing nested arrays / `null` / `NaN` / non-primitive
  elements → reject; flat `number[]` / `string[]` / `boolean[]` are
  accepted (used by KST `rocPeriods`, candlestick `patterns`, etc.)
- string-where-number-expected on numeric-style keys → reject
  (`{ period: "14" }`); we deliberately do not auto-coerce because
  the string form is more often a serialization bug than intent

Per-parameter range and type contracts are still owned by the
indicator itself; this guard only catches obvious wrong shapes that
would otherwise turn into a downstream NaN or a silent default
fallback.

### Added

- **`load_candles` tool + `candlesRef` input** — cache OHLCV candles in the
  session and pass an opaque `handle` as `candlesRef` on subsequent
  `calc_indicator` / `detect_signal` calls. Designed for multi-tool screens:
  five parallel indicator calls against the same 124-bar series transmit the
  bars **once** instead of five times. Handles are session-ephemeral (live
  only for the stdio process), capacity 50, oldest evicted silently. Reload
  is cheap.
- **Compact tuple input via `candlesArray`** — `calc_indicator`,
  `detect_signal`, and `load_candles` now accept
  `[[time, open, high, low, close, volume?], ...]` as an alternative to the
  canonical object-per-bar form. ~40% smaller payload because field names
  are not repeated per row.
- **`paramHints` inlined in `calc_indicator` `INVALID_PARAMETER` errors** — when
  a missing-params destructure error fires, the message now embeds the
  manifest's `paramHints` directly (e.g.
  `paramHints: period: 20 for short-term, 50 for medium, 200 for primary trend`)
  instead of pointing to `get_indicator_manifest`. Matches the parity that
  `detect_signal` already had.
- **`INVALID_HANDLE` canonical error** — surfaced when a `candlesRef` is
  unknown / evicted / never loaded; the message instructs the caller to
  re-run `load_candles`.
- **`processedBars` on `detect_signal` output** — number of input candle bars
  the signal was evaluated against. Resolves the ambiguity on `events`-shape
  results between *"no events fired"* and *"no data was processed"* (the
  existing `totalLength` field counts events for events-shape outputs, not
  bars).
- **`symbol` echoed on `calc_indicator` / `detect_signal` output** — when the
  caller used `candlesRef`, the `symbol` recorded on the handle at
  `load_candles` time is included on the response so the LLM can correlate
  handle → symbol without keeping a side-table. Omitted when no symbol was
  set or when inline `candles` / `candlesArray` was used.
- **`storeSize` and `capacity` on `load_candles` output** — number of handles
  currently held by the session-scoped store and its LRU capacity. Lets the
  caller spot impending eviction without trial-and-error.

### Changed

- `calc_indicator` and `detect_signal` candle input is now exactly-one-of
  `candles` / `candlesArray` / `candlesRef`. Existing inline `candles`
  callers are unaffected.
- Bumped the advertised server version to `0.2.0`.

## 0.1.0 (2026-04-26)

### Added
- Initial release — `@trendcraft/mcp` v0.1.0.
- Manifest tools backed by `trendcraft/manifest`:
  - `list_indicators` (filter by category / regime / timeframe / `calcSupported`). Each summary includes a `calcSupported: boolean` flag so callers can spot the manifest-vs-calc gap without a second round-trip.
  - `get_indicator_manifest`
  - `suggest_indicators_for_regime`
  - `format_manifest_markdown`
- `calc_indicator` dispatcher tool — single entry point that maps `kind` → `trendcraft/safe` Result-typed wrappers (~60 indicators), with `lastN` slicing (default 200) to stay within MCP token budgets.
- `detect_signal` dispatcher tool — single entry point for trading-signal detection across crossovers (`goldenCross`, `deadCross`), MA alignment (`perfectOrder`), candlestick patterns (`candlestickPatterns`), divergences (`rsiDivergence`, `macdDivergence`, `obvDivergence`), volatility squeeze (`bollingerSqueeze`), and volume signals (`volumeBreakout`, `volumeAccumulation`, `volumeMaCross`, `volumeAboveAverage`). Output envelope includes a `firedAt: number[]` summary so screening callers ("did the signal trigger in the last N bars?") don't have to scan the full series.
- `list_signals` discovery tool — symmetric with `list_indicators`. Returns `kind`, `shape`, `oneLiner`, and `paramsHint` per signal so callers can construct a `detect_signal` request without an error round-trip. Optional `shape` filter narrows to `series` or `events` outputs.
- Canonical error envelope across `calc_indicator`:
  - `INVALID_INPUT` — empty / malformed candles.
  - `INVALID_PARAMETER` — bad params, including missing required `params` (destructure-on-undefined errors are reclassified into this bucket with a message that points the caller at `get_indicator_manifest` for paramHints).
  - `INSUFFICIENT_DATA`, `INDICATOR_ERROR`, `INTERNAL_ERROR` — propagated from the underlying safe wrapper.
  - `UNSUPPORTED_KIND` — manifest entry exists but no calc wrapper. Distinct from `UNKNOWN_KIND` (no manifest entry), which is surfaced by the manifest tools.
- stdio transport bin: `trendcraft-mcp` (registered as the package's `bin`).
