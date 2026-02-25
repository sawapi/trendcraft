import { describe, expect, it } from "vitest";
import {
  type Result,
  type TrendCraftError,
  collectResults,
  err,
  flatMap,
  mapResult,
  ok,
  partitionResults,
  tcError,
  tryCatch,
  unwrap,
  unwrapOr,
} from "../result";

describe("Result type utilities", () => {
  describe("ok / err", () => {
    it("creates Ok result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it("creates Err result", () => {
      const error = tcError("NO_DATA", "Empty dataset");
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("NO_DATA");
      expect(result.error.message).toBe("Empty dataset");
    });
  });

  describe("tcError", () => {
    it("creates error with code and message", () => {
      const error = tcError("INVALID_PARAMETER", "Period must be positive");
      expect(error.code).toBe("INVALID_PARAMETER");
      expect(error.message).toBe("Period must be positive");
      expect(error.context).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it("creates error with context", () => {
      const error = tcError("INSUFFICIENT_DATA", "Need more data", {
        required: 20,
        actual: 5,
      });
      expect(error.context).toEqual({ required: 20, actual: 5 });
    });

    it("creates error with cause", () => {
      const cause = new Error("original");
      const error = tcError("COMPUTATION_FAILED", "Failed", {}, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("mapResult", () => {
    it("transforms Ok value", () => {
      const result = ok(5);
      const doubled = mapResult(result, (x) => x * 2);
      expect(doubled.ok).toBe(true);
      if (doubled.ok) expect(doubled.value).toBe(10);
    });

    it("passes through Err unchanged", () => {
      const error = tcError("NO_DATA", "Empty");
      const result: Result<number> = err(error);
      const mapped = mapResult(result, (x: number) => x * 2);
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) expect(mapped.error).toBe(error);
    });
  });

  describe("flatMap", () => {
    it("chains successful operations", () => {
      const result = ok(10);
      const divided = flatMap(result, (x) =>
        x > 0 ? ok(100 / x) : err(tcError("INVALID_PARAMETER", "Must be positive")),
      );
      expect(divided.ok).toBe(true);
      if (divided.ok) expect(divided.value).toBe(10);
    });

    it("short-circuits on error", () => {
      const result: Result<number> = err(tcError("NO_DATA", "Empty"));
      const divided = flatMap(result, (x: number) => ok(x * 2));
      expect(divided.ok).toBe(false);
    });

    it("returns error from chained function", () => {
      const result = ok(0);
      const divided = flatMap(result, (x) =>
        x > 0 ? ok(100 / x) : err(tcError("INVALID_PARAMETER", "Zero")),
      );
      expect(divided.ok).toBe(false);
      if (!divided.ok) expect(divided.error.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("unwrapOr", () => {
    it("returns value for Ok", () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it("returns default for Err", () => {
      expect(unwrapOr(err(tcError("NO_DATA", "Empty")), 0)).toBe(0);
    });
  });

  describe("unwrap", () => {
    it("returns value for Ok", () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it("throws for Err", () => {
      const result: Result<number> = err(tcError("NO_DATA", "Empty dataset"));
      expect(() => unwrap(result)).toThrow("Result error [NO_DATA]: Empty dataset");
    });

    it("preserves cause in thrown error", () => {
      const cause = new Error("original");
      const result: Result<number> = err(tcError("COMPUTATION_FAILED", "Failed", {}, cause));
      try {
        unwrap(result);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).cause).toBe(cause);
      }
    });
  });

  describe("collectResults", () => {
    it("collects all Ok values", () => {
      const results = [ok(1), ok(2), ok(3)];
      const collected = collectResults(results);
      expect(collected.ok).toBe(true);
      if (collected.ok) expect(collected.value).toEqual([1, 2, 3]);
    });

    it("returns first error", () => {
      const e1 = tcError("NO_DATA", "first");
      const e2 = tcError("INVALID_PARAMETER", "second");
      const results: Result<number>[] = [ok(1), err(e1), err(e2)];
      const collected = collectResults(results);
      expect(collected.ok).toBe(false);
      if (!collected.ok) expect(collected.error).toBe(e1);
    });

    it("handles empty array", () => {
      const collected = collectResults([]);
      expect(collected.ok).toBe(true);
      if (collected.ok) expect(collected.value).toEqual([]);
    });
  });

  describe("partitionResults", () => {
    it("separates successes and failures", () => {
      const results: Result<number>[] = [
        ok(1),
        err(tcError("NO_DATA", "a")),
        ok(3),
        err(tcError("INVALID_PARAMETER", "b")),
      ];
      const { successes, failures } = partitionResults(results);
      expect(successes).toEqual([1, 3]);
      expect(failures).toHaveLength(2);
      expect(failures[0].code).toBe("NO_DATA");
      expect(failures[1].code).toBe("INVALID_PARAMETER");
    });

    it("handles all successes", () => {
      const { successes, failures } = partitionResults([ok(1), ok(2)]);
      expect(successes).toEqual([1, 2]);
      expect(failures).toEqual([]);
    });

    it("handles all failures", () => {
      const results: Result<number>[] = [
        err(tcError("NO_DATA", "a")),
        err(tcError("NO_DATA", "b")),
      ];
      const { successes, failures } = partitionResults(results);
      expect(successes).toEqual([]);
      expect(failures).toHaveLength(2);
    });
  });

  describe("tryCatch", () => {
    it("wraps successful execution", () => {
      const result = tryCatch(
        () => JSON.parse('{"a": 1}'),
        (e) => tcError("INVALID_DATA_FORMAT", "Parse failed", {}, e as Error),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual({ a: 1 });
    });

    it("catches thrown errors", () => {
      const result = tryCatch(
        () => JSON.parse("invalid json"),
        (e) => tcError("INVALID_DATA_FORMAT", "Parse failed", {}, e as Error),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_DATA_FORMAT");
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });
  });

  describe("type discrimination", () => {
    it("narrows Ok type", () => {
      const result: Result<number> = ok(42);
      if (result.ok) {
        // TypeScript should narrow to Ok<number>
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });

    it("narrows Err type", () => {
      const result: Result<number> = err(tcError("NO_DATA", "Empty"));
      if (!result.ok) {
        // TypeScript should narrow to Err<TrendCraftError>
        const error: TrendCraftError = result.error;
        expect(error.code).toBe("NO_DATA");
      }
    });
  });
});
