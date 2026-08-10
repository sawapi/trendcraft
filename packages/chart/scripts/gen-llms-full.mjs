// Regenerates llms-full.txt from its declared sources (README, CHANGELOG,
// docs/*.md). Run after any doc change: `pnpm gen:llms` from packages/chart.
// The docs harness (llms-full-parity.test.ts) fails CI when the file drifts
// from this concatenation, so the file can never silently go stale again.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SECTIONS = [
  ["README", "README.md"],
  ["CHANGELOG", "CHANGELOG.md"],
  ["GUIDE", "docs/GUIDE.md"],
  ["API Reference", "docs/API.md"],
  ["Live Data", "docs/LIVE.md"],
  ["Plugins", "docs/PLUGINS.md"],
  ["Cookbook", "docs/COOKBOOK.md"],
];

const HEADER = `# @trendcraft/chart — Full Documentation

> Concatenated documentation for LLM ingestion. Generated from README.md, CHANGELOG.md, and docs/*.md (README, CHANGELOG, GUIDE, API, LIVE, PLUGINS, COOKBOOK).
> Canonical sources: https://github.com/sawapi/trendcraft/tree/main/packages/chart

---
`;

/** Build the llms-full.txt content from the sources under `rootDir`. */
export function buildLlmsFull(rootDir) {
  const body = SECTIONS.map(([title, file]) => {
    const content = readFileSync(join(rootDir, file), "utf8").replace(/\s+$/, "");
    return `\n# ${title}\n\n${content}\n`;
  }).join("\n---\n");
  return HEADER + body;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  writeFileSync(join(root, "llms-full.txt"), buildLlmsFull(root));
  console.log("llms-full.txt regenerated");
}
