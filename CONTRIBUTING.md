# Contributing to TrendCraft

## Getting Started

```bash
git clone https://github.com/sawapi/trendcraft.git
cd trendcraft
pnpm install
pnpm test
```

## Development Workflow

1. Create a branch from `main`.
2. Make your changes.
3. Run checks before pushing:
   ```bash
   pnpm lint
   pnpm build
   pnpm test
   ```
4. Open a pull request.

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix issues
pnpm format        # Format code
```

## Testing

Tests are written with [Vitest](https://vitest.dev/).

```bash
pnpm test          # Run all tests
pnpm test:watch    # Run in watch mode
```

Add tests for every new feature or bug fix. Place test files in `__tests__/` directories next to the source code they cover.

## Pull Request Guidelines

- Use a descriptive title that summarizes the change.
- Link related issues (e.g., `Fixes #42`).
- Ensure CI passes (lint, build, test).
- Keep PRs focused -- prefer small, single-purpose changes.

## Indicator Guidelines

All indicators must follow these conventions:

- Return the `Series<T>` type (`{ time: number; value: T }[]`).
- Normalize input with `isNormalized()` / `normalizeCandles()`.
- Add JSDoc comments with an `@example` block.
- Add tests covering typical usage and edge cases.
- If a file exceeds 500 lines, split it into focused modules.
