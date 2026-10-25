# Security Policy

## Reporting a vulnerability

Please report security issues privately, not in a public issue or pull
request: use **[Report a vulnerability](https://github.com/sawapi/trendcraft/security/advisories/new)**
on the repository's Security tab (GitHub private vulnerability reporting).

Include what is affected (package and version), how to reproduce it, and
what an attacker could do with it. You should get a first response within
7 days. Once a fix is released, the advisory is published with credit to
the reporter, unless you ask otherwise.

## Supported versions

The three packages are versioned and released independently. While they
are at 0.x, security fixes go into the latest minor release of each; older
minors are not patched. Under 0.x a minor release may carry breaking
changes, so upgrading to the fixed release can mean adopting those too.

| Package | Supported |
|---|---|
| `trendcraft` | latest 0.x minor |
| `@trendcraft/chart` | latest 0.x minor |
| `@trendcraft/mcp` | latest 0.x minor |

## Scope

In scope: the published packages' code, and this repository's CI
workflows. Examples of what matters here:

- `@trendcraft/chart` writing caller-supplied values (labels, colours,
  formatter output) into the DOM in a way that injects markup or CSS.
- `@trendcraft/mcp` — a local MCP server driven by an LLM client — accepting
  tool input that escapes its validation, exhausts memory or CPU, or reaches
  the file system or network beyond what a tool documents.
- Input that makes an indicator or backtest hang (for example a regular
  expression or loop with super-linear cost).

A vulnerability in a dependency is in scope when the dependency range a
published package declares itself (its `package.json` `dependencies`)
allows an affected version. `trendcraft` and `@trendcraft/chart` have no
runtime dependencies; `@trendcraft/mcp` does. Advisories deeper in the
tree are handled by refreshing the lockfile and, where needed, raising a
direct dependency's floor.

Out of scope: trading losses from the library's analysis, which is not
financial advice; vulnerabilities in development-only dependencies
(Dependabot tracks those); and the example apps under `packages/*/examples/`,
which are demos and not published.
