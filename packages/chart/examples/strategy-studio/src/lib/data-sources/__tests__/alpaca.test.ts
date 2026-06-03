import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AlpacaAsset, fetchAlpacaBars, searchAssets } from "../alpaca";
import { dataSourceKey } from "../types";

interface PageBars {
  bars: { t: string; o: number; h: number; l: number; c: number; v: number }[];
  next_page_token?: string | null;
}

function jsonResponse(body: PageBars, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Bad",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("fetchAlpacaBars", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns normalized candles for a single page", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bars: [
          { t: "2026-01-01T00:00:00Z", o: 100, h: 101, l: 99, c: 100.5, v: 1000 },
          { t: "2026-01-02T00:00:00Z", o: 100.5, h: 102, l: 100, c: 101.5, v: 1500 },
        ],
        next_page_token: null,
      }),
    );

    const candles = await fetchAlpacaBars("SPY", "1Day");
    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({
      time: new Date("2026-01-01T00:00:00Z").getTime(),
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates via next_page_token", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          bars: [{ t: "2026-01-01T00:00:00Z", o: 1, h: 1, l: 1, c: 1, v: 1 }],
          next_page_token: "abc",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          bars: [{ t: "2026-01-02T00:00:00Z", o: 2, h: 2, l: 2, c: 2, v: 2 }],
          next_page_token: null,
        }),
      );

    const candles = await fetchAlpacaBars("SPY", "1Day");
    expect(candles).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(secondCallUrl).toContain("page_token=abc");
  });

  it("encodes the symbol and includes feed=iex with split adjustment", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ bars: [], next_page_token: null }));
    await fetchAlpacaBars("BRK.B", "1Hour");
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/v2/stocks/BRK.B/bars");
    expect(url).toContain("timeframe=1Hour");
    expect(url).toContain("feed=iex");
    expect(url).toContain("adjustment=split");
  });

  it("throws on non-OK response with status in the message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ bars: [] }, false, 422));
    await expect(fetchAlpacaBars("SPY", "1Day")).rejects.toThrow(/422/);
  });

  it("handles missing bars array as empty", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ bars: [], next_page_token: null }));
    const candles = await fetchAlpacaBars("SPY", "5Min");
    expect(candles).toEqual([]);
  });
});

describe("dataSourceKey", () => {
  it("returns 'synthetic' for synthetic source", () => {
    expect(dataSourceKey({ kind: "synthetic" })).toBe("synthetic");
  });

  it("includes symbol and timeframe for alpaca source", () => {
    expect(dataSourceKey({ kind: "alpaca", symbol: "SPY", timeframe: "1Day" })).toBe(
      "alpaca:SPY:1Day",
    );
    expect(dataSourceKey({ kind: "alpaca", symbol: "QQQ", timeframe: "5Min" })).toBe(
      "alpaca:QQQ:5Min",
    );
  });
});

describe("searchAssets", () => {
  const assets: AlpacaAsset[] = [
    { symbol: "AAPL", name: "Apple Inc Common Stock", exchange: "NASDAQ" },
    { symbol: "MSFT", name: "Microsoft Corporation Common Stock", exchange: "NASDAQ" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "ARCA" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ" },
    { symbol: "NVDA", name: "NVIDIA Corp", exchange: "NASDAQ" },
    { symbol: "GOOGL", name: "Alphabet Inc Class A", exchange: "NASDAQ" },
    { symbol: "TSLA", name: "Tesla Inc Common Stock", exchange: "NASDAQ" },
  ];

  it("returns popular symbols when query is empty", () => {
    const result = searchAssets(assets, "");
    expect(result.map((a) => a.symbol)).toEqual(["SPY", "QQQ", "AAPL", "NVDA", "MSFT"]);
  });

  it("matches by symbol prefix with priority", () => {
    const result = searchAssets(assets, "AA");
    expect(result[0]?.symbol).toBe("AAPL");
  });

  it("matches by company name", () => {
    const result = searchAssets(assets, "tesla");
    expect(result.map((a) => a.symbol)).toContain("TSLA");
  });

  it("matches by name prefix even when symbol does not start with query", () => {
    const result = searchAssets(assets, "alphabet");
    expect(result[0]?.symbol).toBe("GOOGL");
  });

  it("ranks symbol prefix above name prefix", () => {
    const result = searchAssets(assets, "S");
    // "SPY" starts with S (symbol prefix) — should appear before any
    // pure-name-prefix-only matches.
    expect(result[0]?.symbol).toBe("SPY");
  });

  it("is case insensitive", () => {
    const lower = searchAssets(assets, "apple");
    const upper = searchAssets(assets, "APPLE");
    expect(lower.map((a) => a.symbol)).toEqual(upper.map((a) => a.symbol));
  });

  it("respects the limit option", () => {
    const result = searchAssets(assets, "", { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("returns no matches as empty array", () => {
    const result = searchAssets(assets, "ZZZNOMATCH");
    expect(result).toEqual([]);
  });
});
