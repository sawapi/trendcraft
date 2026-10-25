// Regenerates llms-full.txt from its declared sources (README, CHANGELOG,
// docs/*.md). Run after any doc change: `pnpm gen:llms` from packages/chart.
// The docs harness (llms-full-parity.test.ts) fails CI when the file drifts
// from this concatenation, so the file can never silently go stale again.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export const SECTIONS = [
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

const BLOB = "https://github.com/sawapi/trendcraft/blob/main/packages/chart/";
const RAW = "https://raw.githubusercontent.com/sawapi/trendcraft/main/packages/chart/";

/** Whether npm ships `path` (package-relative), by package.json `files`. */
export function isShipped(rootDir, path) {
  const { files } = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  // npm always ships the README.
  return path === "README.md" || files.some((e) => path === e || path.startsWith(`${e}/`));
}

/**
 * Re-point the relative links of `file` from the concatenated llms-full.txt,
 * which sits at the package root. A target npm does not ship (docs/ is not in
 * the tarball) becomes a GitHub URL, and an image a raw one (ops #127).
 */
function rebaseLinks(rootDir, file, markdown) {
  return markdown.replace(/(!?)(\[[^\]]*\])\(([^)\s]+)\)/g, (match, bang, text, target) => {
    if (/^([a-z][a-z0-9+.-]*:|#)/i.test(target)) return match;
    const [path, hash = ""] = target.split(/(?=#)/);
    const resolved = posix.normalize(posix.join(posix.dirname(file), path));
    const href = isShipped(rootDir, resolved) ? `./${resolved}` : `${bang ? RAW : BLOB}${resolved}`;
    return `${bang}${text}(${href}${hash})`;
  });
}

/** Build the llms-full.txt content from the sources under `rootDir`. */
export function buildLlmsFull(rootDir) {
  const body = SECTIONS.map(([title, file]) => {
    const source = readFileSync(join(rootDir, file), "utf8").replace(/\s+$/, "");
    const content = rebaseLinks(rootDir, file, source);
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
