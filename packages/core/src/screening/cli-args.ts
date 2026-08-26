/**
 * Argument parsing for the `trendcraft-screen` CLI.
 *
 * Kept out of the bin entry so it can be tested without invoking `main()`,
 * and written to RETURN an error rather than exiting — the bin decides what
 * a bad argument does to the process.
 */

import type { OutputFormat } from "./types";

/** Everything the screen CLI accepts, after parsing. */
export type ScreenArgs = {
  dataPath?: string;
  entry: string[];
  exit: string[];
  output: OutputFormat;
  minAtr?: number;
  minData: number;
  showAll: boolean;
  verbose: boolean;
  help: boolean;
  list: boolean;
};

/** Parse outcome: either the arguments, or the message to print before exiting. */
export type ScreenArgsResult = { ok: true; args: ScreenArgs } | { ok: false; error: string };

const OUTPUT_FORMATS: OutputFormat[] = ["json", "table", "csv"];

/** Entry conditions used when the caller names none. */
export const DEFAULT_ENTRY_CONDITIONS = ["goldenCross", "volumeAnomaly"];

/**
 * Parse `trendcraft-screen` arguments.
 *
 * Unknown options and unusable values are errors, not silent no-ops: a
 * dropped `--entry` used to fall back to {@link DEFAULT_ENTRY_CONDITIONS} and
 * report a successful screen for criteria nobody asked for, and a `--min-atr`
 * that parsed to `NaN` disabled the volatility filter while the summary still
 * claimed one was applied.
 *
 * @param args - Arguments after the executable and script (i.e. `process.argv.slice(2)`)
 * @returns The parsed arguments, or the message explaining why they were rejected
 *
 * @example
 * ```ts
 * const parsed = parseScreenArgs(["./data", "--entry=rsiAbove70", "--min-atr", "2.5"]);
 * if (!parsed.ok) {
 *   console.error(parsed.error);
 * } else {
 *   console.log(parsed.args.entry); // ["rsiAbove70"]
 * }
 * ```
 */
export function parseScreenArgs(args: string[]): ScreenArgsResult {
  const parsed: ScreenArgs = {
    dataPath: undefined,
    entry: [],
    exit: [],
    output: "table",
    minAtr: undefined,
    minData: 100,
    showAll: false,
    verbose: false,
    help: false,
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    const raw = args[i];

    // Split `--opt=value` at the option itself rather than over the whole
    // argv: a pre-pass cannot tell an option from an option's VALUE, so a
    // value that happened to look like `--x=y` would be torn in half and its
    // tail would leak out as a positional argument.
    let arg = raw;
    let inlineValue: string | undefined;
    if (raw.startsWith("--")) {
      const eq = raw.indexOf("=");
      if (eq > 2) {
        arg = raw.slice(0, eq);
        inlineValue = raw.slice(eq + 1);
      }
    }

    /**
     * The value for the current option, or `undefined` if none was supplied.
     * An empty string counts as none: `--entry ""` used to fall through to
     * the default screen, and accepting it here would instead produce an
     * empty condition name that only fails later, inside criteria lookup.
     */
    const takeValue = (): string | undefined => {
      if (inlineValue !== undefined) return inlineValue === "" ? undefined : inlineValue;
      i++;
      const next = args[i];
      return next === undefined || next === "" ? undefined : next;
    };

    /** Flags that carry no value must reject `--flag=something`. */
    const inlineOnValuelessFlag = (): string | undefined =>
      inlineValue === undefined ? undefined : `${arg} does not take a value`;

    if (arg === "--help" || arg === "-h") {
      const rejected = inlineOnValuelessFlag();
      if (rejected !== undefined) return { ok: false, error: rejected };
      parsed.help = true;
    } else if (arg === "--list" || arg === "-l") {
      const rejected = inlineOnValuelessFlag();
      if (rejected !== undefined) return { ok: false, error: rejected };
      parsed.list = true;
    } else if (arg === "--entry" || arg === "-e") {
      const value = takeValue();
      if (value === undefined) return { ok: false, error: `Missing value for ${arg}` };
      parsed.entry = value.split(",").map((s) => s.trim());
      if (parsed.entry.some((name) => name === "")) {
        return { ok: false, error: `Invalid value for ${arg}: ${value} (empty condition name)` };
      }
    } else if (arg === "--exit" || arg === "-x") {
      const value = takeValue();
      if (value === undefined) return { ok: false, error: `Missing value for ${arg}` };
      parsed.exit = value.split(",").map((s) => s.trim());
      if (parsed.exit.some((name) => name === "")) {
        return { ok: false, error: `Invalid value for ${arg}: ${value} (empty condition name)` };
      }
    } else if (arg === "--output" || arg === "-o") {
      const value = takeValue();
      if (value === undefined) return { ok: false, error: `Missing value for ${arg}` };
      if (!OUTPUT_FORMATS.includes(value as OutputFormat)) {
        return {
          ok: false,
          error: `Invalid value for ${arg}: ${value} (expected ${OUTPUT_FORMATS.join(", ")})`,
        };
      }
      parsed.output = value as OutputFormat;
    } else if (arg === "--min-atr") {
      const value = takeValue();
      if (value === undefined) return { ok: false, error: `Missing value for ${arg}` };
      // `Number(value)` rather than `parseFloat`, which accepts a numeric
      // PREFIX: `--min-atr 2.5abc` would have quietly become 2.5.
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return { ok: false, error: `Invalid value for ${arg}: ${value} (expected a number)` };
      }
      // A negative minimum passes every finite ATR%, which disables the
      // filter as silently as dropping the flag used to.
      if (num < 0) {
        return { ok: false, error: `Invalid value for ${arg}: ${value} (must not be negative)` };
      }
      parsed.minAtr = num;
    } else if (arg === "--min-data") {
      const value = takeValue();
      if (value === undefined) return { ok: false, error: `Missing value for ${arg}` };
      const num = Number(value);
      // The message promises an integer, so `2.9` must not silently become 2.
      if (!Number.isInteger(num)) {
        return { ok: false, error: `Invalid value for ${arg}: ${value} (expected an integer)` };
      }
      // 0 is a meaningful "no minimum"; a negative one is not, and turns the
      // data-sufficiency check off without saying so.
      if (num < 0) {
        return { ok: false, error: `Invalid value for ${arg}: ${value} (must not be negative)` };
      }
      parsed.minData = num;
    } else if (arg === "--all" || arg === "-a") {
      const rejected = inlineOnValuelessFlag();
      if (rejected !== undefined) return { ok: false, error: rejected };
      parsed.showAll = true;
    } else if (arg === "--verbose" || arg === "-v") {
      const rejected = inlineOnValuelessFlag();
      if (rejected !== undefined) return { ok: false, error: rejected };
      parsed.verbose = true;
    } else if (!arg.startsWith("-")) {
      // A second positional silently replaced the first, so a stray token
      // scanned somewhere the caller never named.
      if (parsed.dataPath !== undefined) {
        return {
          ok: false,
          error: `Unexpected argument: ${arg} (data path already set to ${parsed.dataPath})`,
        };
      }
      parsed.dataPath = arg;
    } else {
      return { ok: false, error: `Unknown option: ${arg}` };
    }
  }

  if (parsed.entry.length === 0) {
    parsed.entry = [...DEFAULT_ENTRY_CONDITIONS];
  }

  return { ok: true, args: parsed };
}
