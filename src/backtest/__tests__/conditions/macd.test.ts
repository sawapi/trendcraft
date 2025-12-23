import { describe, it, expect } from "vitest";
import { macdCrossUp, macdCrossDown } from "../../conditions";

describe("macdCrossUp()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossUp();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossUp()");
  });
});

describe("macdCrossDown()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossDown();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossDown()");
  });
});
