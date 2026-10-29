import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_VERSION } from "../server";

describe("SERVER_VERSION", () => {
  it("is the package version, so clients see the release they run", () => {
    // It was a hand-written "0.2.0" that the 0.3.0 release still reported.
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8")) as {
      version: string;
    };
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
