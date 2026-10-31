#!/usr/bin/env node
/**
 * Check the links between the repository's Markdown files.
 *
 *   node scripts/check-doc-links.mjs
 *
 * For every tracked .md file, each relative link must name a file or
 * directory that exists, and each `#anchor` on a Markdown target (or on the
 * same file) must name a heading there. Anchors follow GitHub's rules
 * through github-slugger, the library GitHub's own Markdown pipeline is
 * modelled on, so a heading that gains a parenthetical or an argument list
 * fails here instead of silently stranding the links to it.
 *
 * Links in raw HTML (`<a href>`, `<img src>`) are checked the same way.
 * External links (http:, https:, mailto:) are not fetched. Code blocks and
 * inline code are skipped, since links there are examples.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const files = execFileSync("git", ["ls-files", "-z", "*.md"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

/**
 * A fenced code block. The closing fence has no info string, so a "```ts"
 * line inside a ``` block does not end it.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*$/gm;

/** Text with fenced code blocks and inline code spans blanked out. */
function stripCode(markdown) {
  return markdown
    .replace(FENCE, "")
    .replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, (span) => (span.includes("\n\n") ? span : ""));
}

/** Heading text as GitHub renders it: inline Markdown and HTML removed. */
function headingText(raw) {
  // Code spans are literal: `<TrendChart @click>` keeps its text.
  return raw
    .replace(/\s+#+\s*$/, "")
    .split(/(`+[^`]*`+)/)
    .map((part, i) =>
      i % 2 === 1
        ? part.replace(/`/g, "")
        : part
            .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            .split(/<\/?[a-z][^<>]*>/i)
            .join("")
            .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e) => decodeEntity(e))
            .replace(/(\*\*|__)(.+?)\1/g, "$2")
            .replace(/(^|\W)[*_](.+?)[*_](?=\W|$)/g, "$1$2"),
    )
    .join("");
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

function decodeEntity(e) {
  if (e[0] !== "#") return ENTITIES[e.toLowerCase()];
  return String.fromCodePoint(
    e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)),
  );
}

const anchorCache = new Map();

/** Anchors a Markdown file defines: headings, plus HTML id / name attributes. */
function anchorsOf(file) {
  let anchors = anchorCache.get(file);
  if (anchors) return anchors;
  const markdown = readFileSync(path.join(root, file), "utf8");
  // Headings are read with code spans kept (`## \`sma\`` is a heading).
  const noFences = markdown.replace(FENCE, "");
  const slugger = new GithubSlugger();
  anchors = new Set();
  // ATX headings (`## Title`) and setext headings (a line over `===` or
  // `---`), in document order so repeated slugs get the right suffix.
  const headings = [
    ...noFences.matchAll(/^ {0,3}#{1,6}[ \t]+(.+)$/gm),
    ...noFences.matchAll(/^(?! {0,3}(?:[-*+>#|]|\d+[.)]))[ \t]*(\S.*)\n {0,3}(?:=+|-+)[ \t]*$/gm),
  ].sort((a, b) => a.index - b.index);
  for (const m of headings) anchors.add(slugger.slug(headingText(m[1])));
  for (const m of noFences.matchAll(/<a\s[^>]*\b(?:id|name)=["']([^"']+)["']/gi)) anchors.add(m[1]);
  anchorCache.set(file, anchors);
  return anchors;
}

/** Link targets: inline `](target)` and reference definitions `[x]: target`. */
function linksOf(markdown) {
  const text = stripCode(markdown);
  const targets = [];
  for (const m of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g)) targets.push(m[1]);
  for (const m of text.matchAll(/^ {0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm)) targets.push(m[1]);
  // Raw HTML: <a href>, <img src>, <source src>.
  for (const m of text.matchAll(/<[a-z]+\s[^>]*\b(?:href|src)=["']([^"']+)["']/gi))
    targets.push(m[1]);
  return targets;
}

const problems = [];
let checked = 0;
for (const file of files) {
  for (const target of linksOf(readFileSync(path.join(root, file), "utf8"))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    checked++;
    const hash = target.indexOf("#");
    const linkPath = decodeURI(hash === -1 ? target : target.slice(0, hash));
    const anchor = hash === -1 ? "" : decodeURIComponent(target.slice(hash + 1));
    const resolved = linkPath
      ? path.relative(
          root,
          linkPath.startsWith("/")
            ? path.join(root, linkPath)
            : path.resolve(path.dirname(path.join(root, file)), linkPath),
        )
      : file;
    if (!existsSync(path.join(root, resolved))) {
      problems.push(`${file}: ${target} — no such file`);
      continue;
    }
    if (!anchor || !resolved.endsWith(".md") || statSync(path.join(root, resolved)).isDirectory())
      continue;
    if (!anchorsOf(resolved).has(anchor))
      problems.push(`${file}: ${target} — no heading for #${anchor}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} broken link(s) in ${files.length} Markdown files.`);
  process.exit(1);
}
console.log(`Checked ${checked} relative links in ${files.length} Markdown files: none broken.`);
