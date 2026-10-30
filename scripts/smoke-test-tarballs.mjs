#!/usr/bin/env node
/**
 * Install packed tarballs into a throwaway project, the way a user installs
 * them from npm, and check that each package works from there.
 *
 *   node scripts/smoke-test-tarballs.mjs <tarball> [<tarball> ...]
 *
 * Pass every tarball a package needs from this repo (chart and mcp need the
 * trendcraft tarball too), so the check does not depend on what is already
 * on npm. Other dependencies come from the registry.
 *
 * `verify:publish` checks the build output in the package directory. This
 * checks the packed result: the `files` list, the `exports` map resolved by
 * package name, and the `bin` entries.
 *
 * For each package it checks that:
 *  - every `exports` subpath imports as ESM and, if it has a `require`
 *    condition, loads as CJS with the same export names;
 *  - every `types` file in the `exports` map is in the tarball;
 *  - every `bin` runs: `--help` for the CLIs, and the MCP handshake
 *    (initialize, then tools/list) for the MCP server.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tarballs = process.argv.slice(2).map((p) => resolve(p));
if (tarballs.length === 0) {
  console.error("usage: node scripts/smoke-test-tarballs.mjs <tarball> [<tarball> ...]");
  process.exit(2);
}
for (const t of tarballs) {
  if (!existsSync(t)) {
    console.error(`no such tarball: ${t}`);
    process.exit(2);
  }
}

const names = tarballs.map(
  (t) =>
    JSON.parse(execFileSync("tar", ["-xzOf", t, "package/package.json"], { encoding: "utf8" }))
      .name,
);

const dir = mkdtempSync(join(tmpdir(), "smoke-"));
writeFileSync(
  join(dir, "package.json"),
  JSON.stringify({ name: "smoke", private: true, version: "0.0.0" }),
);

// The React and Vue entry points import their peer dependencies. Packages
// from the registry obey the same three-day minimum release age as local
// installs (pnpm-workspace.yaml); the tarballs are local files.
const extras = names.includes("@trendcraft/chart") ? ["react", "react-dom", "vue"] : [];
console.log(
  `Installing ${names.join(", ")}${extras.length ? ` with ${extras.join(", ")}` : ""} into ${dir}`,
);
execFileSync(
  "npm",
  [
    "install",
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--min-release-age=3",
    ...tarballs,
    ...extras,
  ],
  {
    cwd: dir,
    stdio: "inherit",
  },
);

const failures = [];
const fail = (msg) => {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
};

// Imports run in a child process whose working directory is the throwaway
// project, so bare specifiers resolve through its node_modules.
const checker = `
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const specs = JSON.parse(process.argv[2]);
const out = {};
for (const { spec, cjs } of specs) {
  const r = {};
  try {
    const mod = await import(spec);
    r.esm = Object.keys(mod).filter((k) => k !== "default").sort();
    r.hasDefault = "default" in mod;
  } catch (e) {
    r.esmError = String(e.message).split("\\n")[0];
  }
  if (cjs) {
    try {
      r.cjs = Object.keys(require(spec)).filter((k) => k !== "default" && k !== "__esModule").sort();
    } catch (e) {
      r.cjsError = String(e.message).split("\\n")[0];
    }
  }
  out[spec] = r;
}
console.log(JSON.stringify(out));
`;
writeFileSync(join(dir, "check.mjs"), checker);

for (const name of names) {
  const pkgDir = join(dir, "node_modules", name);
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  console.log(`\n${name}@${pkg.version}`);

  const specs = [];
  for (const [subpath, entry] of Object.entries(pkg.exports ?? {})) {
    if (subpath === "./package.json") continue;
    if (subpath.includes("*")) {
      fail(
        `${name}: exports pattern ${subpath} is not checked; list its entries or extend this script`,
      );
      continue;
    }
    const spec = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
    const cjs = typeof entry === "object" && entry !== null && "require" in entry;
    specs.push({ spec, cjs });
    const types = typeof entry === "object" && entry !== null ? entry.types : undefined;
    if (types && !existsSync(join(pkgDir, types)))
      fail(`${spec}: types file ${types} is not in the tarball`);
  }

  const run = spawnSync(process.execPath, ["check.mjs", JSON.stringify(specs)], {
    cwd: dir,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    fail(`${name}: import check crashed: ${run.stderr.trim().split("\n")[0]}`);
    continue;
  }
  const results = JSON.parse(run.stdout.trim().split("\n").at(-1));
  for (const { spec, cjs } of specs) {
    const r = results[spec];
    if (r.esmError) fail(`${spec}: ESM import threw: ${r.esmError}`);
    if (r.cjsError) fail(`${spec}: CJS require threw: ${r.cjsError}`);
    if (r.esm && r.esm.length === 0 && !r.hasDefault) fail(`${spec}: exports nothing`);
    if (r.esm && r.cjs && r.esm.join() !== r.cjs.join()) {
      const onlyEsm = r.esm.filter((k) => !r.cjs.includes(k));
      const onlyCjs = r.cjs.filter((k) => !r.esm.includes(k));
      fail(
        `${spec}: ESM and CJS exports differ (ESM only: ${onlyEsm.join(", ") || "-"}; CJS only: ${onlyCjs.join(", ") || "-"})`,
      );
    }
    if (r.esm)
      console.log(
        `  ${r.esmError || r.cjsError ? "✗" : "✓"} ${spec} (${r.esm.length} exports${cjs ? ", ESM and CJS" : ", ESM"})`,
      );
  }

  const bins = typeof pkg.bin === "string" ? { [name]: pkg.bin } : (pkg.bin ?? {});
  for (const bin of Object.keys(bins)) {
    const binPath = join(dir, "node_modules", ".bin", bin);
    if (bin === "trendcraft-mcp") {
      checkMcp(binPath, pkg.version);
      continue;
    }
    const r = spawnSync(binPath, ["--help"], { cwd: dir, encoding: "utf8", timeout: 30_000 });
    if (r.status === 0) console.log(`  ✓ ${bin} --help`);
    else
      fail(
        `${bin} --help exited ${r.status ?? r.signal}: ${(r.stderr || r.stdout).trim().split("\n")[0]}`,
      );
  }
}

function checkMcp(binPath, version) {
  const messages = [
    {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke", version: "0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
  ];
  const r = spawnSync(binPath, [], {
    cwd: dir,
    input: `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`,
    encoding: "utf8",
    timeout: 30_000,
  });
  const replies = r.stdout
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l));
  const init = replies.find((m) => m.id === 0)?.result;
  const tools = replies.find((m) => m.id === 1)?.result?.tools ?? [];
  if (init?.serverInfo?.version !== version) {
    fail(
      `trendcraft-mcp: initialize reported ${JSON.stringify(init?.serverInfo)}, expected version ${version}`,
    );
  } else if (tools.length === 0) {
    fail("trendcraft-mcp: tools/list returned no tools");
  } else {
    console.log(
      `  ✓ trendcraft-mcp handshake (${init.serverInfo.name} ${init.serverInfo.version}, ${tools.length} tools)`,
    );
  }
}

console.log();
if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} problem(s) in the packed tarballs.`);
  process.exit(1);
}
console.log(`OK: ${names.join(", ")} install and load from their tarballs.`);
