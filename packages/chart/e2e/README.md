# Browser (e2e) tests for @trendcraft/chart

The unit suite (`pnpm test`) runs in happy-dom, which has no canvas
rasterizer, no layout and no real input pipeline. These Playwright specs cover
what only a browser can: painted pixels, sizes, and wheel / mouse / touch
gestures with their real timing.

```bash
pnpm test:e2e                 # all specs (starts the fixture server itself)
pnpm test:e2e -g "wheel"      # by title
pnpm exec playwright show-trace test-results/<dir>/trace.zip   # after a failure
```

Locally the installed Google Chrome is used, so no browser download is
needed. CI uses Playwright's Chromium (`playwright install --with-deps
chromium`).

## Layout

- `fixture/` — one page that mounts a chart built from `src/` (not `dist/`)
  with deterministic candles and exposes it as `window.__tc`
  (`chart`, `candles`, `events`, `ready`). Query params: `?bars=N`,
  `?volume=0`.
- `specs/*.e2e.ts` — the tests. `helpers.ts` holds `openChart`,
  `logicalRange`, `chartBox`, `frames`, `isMoving`, `isFlinging`,
  `wheelFlick`, `scrollbarThumb` and `touchDriver` (multi-touch over the
  DevTools protocol).
- `vite.config.ts` — serves the fixture on port 5310. The config never reuses
  a server already on that port, so stop any stray one first.

## Conventions

- Drive the chart the way a user does (`page.mouse`, `page.keyboard`,
  `page.touchscreen` or CDP touch events), and read state back through the
  public API (`getVisibleLogicalRange`, `getVisibleRange`, events), not
  internals.
- Exception: a gesture whose meaning is the spacing between its events (a
  wheel flick, whose velocity comes from that spacing) may be dispatched
  inside the page with `setTimeout` spacing, as `wheelFlick` does. Those
  events are untrusted synthetic events that skip the browser's input
  pipeline (hit-testing, wheel coalescing and latching), so use this only
  where test-runner round trips would make the spacing unreliable; everything
  else goes through `page.mouse` and friends.
- Pixel checks sample colours or coverage rather than comparing full
  screenshots, so they survive font and antialiasing differences between
  machines.
- A known, unfixed bug is written as `test.fail(...)` naming its ops issue.
  When the fix lands the test starts passing, Playwright reports that as a
  failure, and the fix PR drops `.fail`.
- A `test.fail` must not be able to fail before the assertion that names the
  bug, or it goes green for the wrong reason (a slow runner, a broken setup).
  Guard its setup twice: a preceding plain `test` asserts the setup works,
  and a `test.skip(!precondition, ...)` inside the `test.fail` skips rather
  than "fails as expected" when the setup did not happen. The precondition
  must be specific: "the view is moving" also holds for an overscroll
  spring-back at the data edge, so a fling is checked with `isFlinging`
  (fling-rate movement, inside the data).
- Wait on state or on animation frames (`frames`, `expect.poll`), never on
  fixed wall-clock sleeps: inertia and animations run per frame, and frame
  rate differs between machines and CI runners. The one exception is the
  spacing of an in-page gesture such as `wheelFlick`, where the wall-clock
  gap between events is itself the input.

## Exploring with agent-browser

Before writing a spec for a bug, reproduce it by hand with `agent-browser`
against the fixture (or an example app) to find the exact gesture and the
observable that shows it:

```bash
node ./node_modules/vite/bin/vite.js --config e2e/vite.config.ts &
agent-browser open http://localhost:5310/
agent-browser eval "window.__tc.chart.getVisibleLogicalRange()"
agent-browser screenshot /tmp/before.png
agent-browser close
```

Then encode that gesture and observable as a spec.

## Test perspectives

What the browser suite should cover, and where it stands. "ops #N" is the
tracking issue for a known bug; the spec for it is a `test.fail` until fixed.

| Area | Perspective | Status |
|---|---|---|
| Rendering | Candles paint in both colours; canvas fills the container | covered |
| Rendering | Visible range lies inside the data | covered |
| Rendering | A non-finite OHLC value or indicator value does not blank the chart | covered |
| Rendering | Flat or zero price range still draws an axis with ticks | covered by unit tests (`price-scale-degenerate.test.ts`) |
| Rendering | Theme change reaches the legend | covered |
| Rendering | Series `lineWidth` / `channelColors` / `markers` reach band, MACD, ichimoku, line | covered by unit tests (`series-config-reaches-renderer.test.ts`) |
| Rendering | Hidden series keep their pane | todo (ops #25) |
| Rendering | hmmRegime and volume-profile heatmap draw and stay put on scroll | todo (ops #32, #33) |
| Pan / zoom | Wheel up zooms in | covered |
| Pan / zoom | Mouse drag pans | covered |
| Pan / zoom | A horizontal wheel flick starts a fling | covered |
| Pan / zoom | Mouse press stops a wheel fling | covered |
| Pan / zoom | A click, tap or long-press during an edge bounce still settles at the edge | covered |
| Pan / zoom | Scrollbar drag and Home / End keep the zoom level | covered |
| Pan / zoom | Scroll-to-end keeps the right offset exactly | todo (ops #16) |
| Pan / zoom | Scrollbar thumb stays inside the track | todo (ops #18) |
| Crosshair | Pointer move emits `crosshairMove` with the bar index | covered |
| Crosshair | Crosshair value clears past the last bar | todo (ops #18) |
| Touch | Lifting one finger after a pinch leaves the other able to pan | covered |
| Animation | An animation started from another's `onDone` runs | todo (ops #26) |
| Axis | Labels do not overlap at any start offset; DST does not add times | todo (ops #14, #88) |
| Sizing | `setWidth(0)` does not corrupt the viewport | todo (ops #18) |
| Sparkline | Re-attach keeps its CSS size (bitmap does not grow) | todo (ops #98) |
