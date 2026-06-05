import type { ConditionSpec, StrategyJSON } from "trendcraft";

/**
 * One row in the entry/exit list. Stored locally in the builder; serialised
 * into a `ConditionSpec` when the user runs the backtest.
 */
export type ConditionRow = {
  /** Stable id within the builder (so React keys are stable). */
  id: string;
  /** Registered condition name, e.g. "goldenCross". */
  name: string;
  /** User-overridden parameter values; merged with the registry's defaults at hydrate time. */
  params: Record<string, unknown>;
};

export type BuilderState = {
  /** Strategy id (used as the JSON `id` field). */
  id: string;
  /** Display name. */
  name: string;
  /** Entry rows joined with AND. */
  entry: ConditionRow[];
  /** Exit rows joined with AND. */
  exit: ConditionRow[];
  /** Backtest options exposed to the user. */
  capital: number;
  stopLoss?: number;
  takeProfit?: number;
};

export type BuilderAction =
  | { type: "set-name"; value: string }
  | { type: "set-id"; value: string }
  | { type: "set-capital"; value: number }
  | { type: "set-stop-loss"; value: number | undefined }
  | { type: "set-take-profit"; value: number | undefined }
  | { type: "add-row"; bucket: "entry" | "exit"; conditionName: string }
  | { type: "remove-row"; bucket: "entry" | "exit"; id: string }
  | { type: "set-row-name"; bucket: "entry" | "exit"; id: string; conditionName: string }
  | {
      type: "set-row-param";
      bucket: "entry" | "exit";
      id: string;
      key: string;
      value: unknown;
    }
  | { type: "replace"; state: BuilderState };

let nextId = 1;
const newRowId = (): string => `row-${nextId++}`;

export function initialBuilderState(): BuilderState {
  return {
    id: "studio-strategy",
    name: "Studio Strategy",
    entry: [{ id: newRowId(), name: "goldenCross", params: {} }],
    exit: [{ id: newRowId(), name: "deadCross", params: {} }],
    capital: 100_000,
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "set-name":
      return { ...state, name: action.value };
    case "set-id":
      return { ...state, id: action.value };
    case "set-capital":
      return { ...state, capital: action.value };
    case "set-stop-loss":
      return { ...state, stopLoss: action.value };
    case "set-take-profit":
      return { ...state, takeProfit: action.value };
    case "add-row":
      return {
        ...state,
        [action.bucket]: [
          ...state[action.bucket],
          { id: newRowId(), name: action.conditionName, params: {} },
        ],
      };
    case "remove-row":
      return {
        ...state,
        [action.bucket]: state[action.bucket].filter((r) => r.id !== action.id),
      };
    case "set-row-name":
      return {
        ...state,
        [action.bucket]: state[action.bucket].map((r) =>
          r.id === action.id ? { ...r, name: action.conditionName, params: {} } : r,
        ),
      };
    case "set-row-param":
      return {
        ...state,
        [action.bucket]: state[action.bucket].map((r) =>
          r.id === action.id ? { ...r, params: { ...r.params, [action.key]: action.value } } : r,
        ),
      };
    case "replace":
      return action.state;
  }
}

/**
 * Convert a list of rows into a `ConditionSpec`. Single rows are emitted as
 * leaves; multiple rows are wrapped in an `and` combinator. Empty input throws
 * because the backtest engine requires both entry and exit conditions.
 */
function rowsToSpec(rows: ConditionRow[], bucket: "entry" | "exit"): ConditionSpec {
  if (rows.length === 0) {
    throw new Error(`No ${bucket} conditions specified`);
  }
  const specs = rows.map((r): ConditionSpec => ({ name: r.name, params: { ...r.params } }));
  if (specs.length === 1) return specs[0];
  return { op: "and", conditions: specs };
}

export function buildStrategyJSON(state: BuilderState): StrategyJSON {
  const json: StrategyJSON = {
    $schema: "trendcraft/strategy",
    version: 1,
    id: state.id,
    name: state.name,
    entry: rowsToSpec(state.entry, "entry"),
    exit: rowsToSpec(state.exit, "exit"),
    backtest: {
      capital: state.capital,
    },
  };
  if (state.stopLoss !== undefined && json.backtest) json.backtest.stopLoss = state.stopLoss;
  if (state.takeProfit !== undefined && json.backtest) json.backtest.takeProfit = state.takeProfit;
  return json;
}

export class UnsupportedSpecError extends Error {
  constructor(op: "or" | "not") {
    super(
      `Strategy uses '${op}' combinator, which Studio's PR3 builder UI doesn't yet expose. Run the JSON directly without importing into the builder, or rewrite using only AND.`,
    );
    this.name = "UnsupportedSpecError";
  }
}

/**
 * Convert a parsed `StrategyJSON` back into builder state. The PR3 builder UI
 * only models AND-of-leaves, so importing a strategy that uses OR / NOT
 * combinators throws `UnsupportedSpecError` rather than silently breaking the
 * round-trip. The caller surfaces the error in the import banner.
 */
export function strategyJSONToState(json: StrategyJSON): BuilderState {
  return {
    id: json.id,
    name: json.name,
    entry: specToRows(json.entry),
    exit: specToRows(json.exit),
    capital: json.backtest?.capital ?? 100_000,
    stopLoss: json.backtest?.stopLoss,
    takeProfit: json.backtest?.takeProfit,
  };
}

function specToRows(spec: ConditionSpec): ConditionRow[] {
  if ("op" in spec) {
    if (spec.op === "and") return spec.conditions.flatMap(specToRows);
    throw new UnsupportedSpecError(spec.op);
  }
  return [{ id: newRowId(), name: spec.name, params: { ...(spec.params ?? {}) } }];
}
