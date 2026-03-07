import { describe, expect, it, vi } from "vitest";
import { pollUntil, withRetry } from "../retry";

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail1")).mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 1,
      jitter: false,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after max attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fail"));

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 1, jitter: false }),
    ).rejects.toThrow("always fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw immediately for non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("bad type"));

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        initialDelayMs: 1,
        retryableErrors: (err) => err instanceof RangeError,
      }),
    ).rejects.toThrow("bad type");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should use exponential backoff delays", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any, ms?: number) => {
      delays.push(ms ?? 0);
      // Execute immediately for test speed
      return originalSetTimeout(fn, 0);
    });

    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");

    await withRetry(asyncFn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      jitter: false,
    });

    // First retry delay: 100 * 2^0 = 100
    // Second retry delay: 100 * 2^1 = 200
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);

    vi.restoreAllMocks();
  });

  it("should cap delay at maxDelayMs", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any, ms?: number) => {
      delays.push(ms ?? 0);
      return originalSetTimeout(fn, 0);
    });

    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockResolvedValue("ok");

    await withRetry(asyncFn, {
      maxAttempts: 4,
      initialDelayMs: 100,
      backoffMultiplier: 10,
      maxDelayMs: 500,
      jitter: false,
    });

    // 100*10^0=100, 100*10^1=1000→capped to 500, 100*10^2=10000→capped to 500
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(500);
    expect(delays[2]).toBe(500);

    vi.restoreAllMocks();
  });

  it("should apply jitter when enabled", async () => {
    const asyncFn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("ok");

    // Just verify it doesn't throw — jitter is random so we can't assert exact values
    const result = await withRetry(asyncFn, {
      maxAttempts: 2,
      initialDelayMs: 1,
      jitter: true,
    });
    expect(result).toBe("ok");
  });
});

describe("pollUntil", () => {
  it("should return immediately when predicate matches on first poll", async () => {
    const fn = vi.fn().mockResolvedValue({ status: "filled" });
    const { result, settled } = await pollUntil<{ status: string }>(
      fn,
      (r) => r.status === "filled",
    );

    expect(settled).toBe(true);
    expect(result.status).toBe("filled");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should poll until predicate matches", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValue({ status: "filled" });

    const { result, settled } = await pollUntil<{ status: string }>(
      fn,
      (r) => r.status === "filled",
      {
        maxAttempts: 10,
        initialIntervalMs: 1,
      },
    );

    expect(settled).toBe(true);
    expect(result.status).toBe("filled");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should return settled=false when max attempts exhausted", async () => {
    const fn = vi.fn().mockResolvedValue({ status: "pending" });

    const { result, settled } = await pollUntil<{ status: string }>(
      fn,
      (r) => r.status === "filled",
      {
        maxAttempts: 3,
        initialIntervalMs: 1,
      },
    );

    expect(settled).toBe(false);
    expect(result.status).toBe("pending");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should use backoff between polls", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any, ms?: number) => {
      delays.push(ms ?? 0);
      return originalSetTimeout(fn, 0);
    });

    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValue({ status: "filled" });

    await pollUntil<{ status: string }>(fn, (r) => r.status === "filled", {
      maxAttempts: 5,
      initialIntervalMs: 100,
      backoffMultiplier: 2,
      maxIntervalMs: 500,
    });

    // First interval: 100, second: min(100*2, 500) = 200
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);

    vi.restoreAllMocks();
  });

  it("should cap interval at maxIntervalMs", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any, ms?: number) => {
      delays.push(ms ?? 0);
      return originalSetTimeout(fn, 0);
    });

    const fn = vi.fn().mockResolvedValue({ status: "pending" });

    await pollUntil<{ status: string }>(fn, (r) => r.status === "filled", {
      maxAttempts: 4,
      initialIntervalMs: 100,
      backoffMultiplier: 100,
      maxIntervalMs: 300,
    });

    // 100, min(100*100, 300)=300, min(300*100, 300)=300
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(300);
    expect(delays[2]).toBe(300);

    vi.restoreAllMocks();
  });
});
