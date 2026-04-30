import { useMemo } from "react";
import {
  type Condition,
  type ConditionCategory,
  type ConditionRegistryEntry,
  type StrategyJSON,
  serializeStrategy,
} from "trendcraft";
import {
  type BuilderAction,
  type BuilderState,
  type ConditionRow,
  buildStrategyJSON,
} from "../lib/strategy-state";
import { localStudioAPI } from "../lib/studio-api";

const CATEGORY_ORDER: ConditionCategory[] = [
  "trend",
  "momentum",
  "volatility",
  "volume",
  "pattern",
  "smc",
  "range",
  "fundamental",
];

type Props = {
  state: BuilderState;
  dispatch: (action: BuilderAction) => void;
  onRun: (json: StrategyJSON) => void;
  onImport: (text: string) => void;
  jsonText: string;
  onJsonTextChange: (text: string) => void;
  importError: string | null;
  runError: string | null;
};

export function StrategyBuilder({
  state,
  dispatch,
  onRun,
  onImport,
  jsonText,
  onJsonTextChange,
  importError,
  runError,
}: Props) {
  const { conditionsByCategory, conditionMap } = useMemo(() => {
    const byCategory = new Map<string, ConditionRegistryEntry<Condition>[]>();
    const map = new Map<string, ConditionRegistryEntry<Condition>>();
    for (const entry of localStudioAPI.listConditions()) {
      map.set(entry.name, entry);
      const cat = entry.category ?? "uncategorized";
      const list = byCategory.get(cat) ?? [];
      list.push(entry);
      byCategory.set(cat, list);
    }
    return { conditionsByCategory: byCategory, conditionMap: map };
  }, []);

  const canRun = state.entry.length > 0 && state.exit.length > 0;

  function handleRun() {
    if (!canRun) return;
    const json = buildStrategyJSON(state);
    onJsonTextChange(serializeStrategy(json));
    onRun(json);
  }

  return (
    <>
      <div className="pane-header">Strategy Builder</div>

      <div className="builder-meta">
        <label className="builder-field">
          <span>Name</span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => dispatch({ type: "set-name", value: e.target.value })}
          />
        </label>
        <label className="builder-field">
          <span>Capital</span>
          <input
            type="number"
            value={state.capital}
            onChange={(e) => dispatch({ type: "set-capital", value: Number(e.target.value) || 0 })}
          />
        </label>
        <div className="builder-field-pair">
          <label className="builder-field">
            <span>Stop %</span>
            <input
              type="number"
              value={state.stopLoss ?? ""}
              placeholder="—"
              onChange={(e) =>
                dispatch({
                  type: "set-stop-loss",
                  value: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="builder-field">
            <span>TP %</span>
            <input
              type="number"
              value={state.takeProfit ?? ""}
              placeholder="—"
              onChange={(e) =>
                dispatch({
                  type: "set-take-profit",
                  value: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </div>

      <BucketEditor
        bucket="entry"
        rows={state.entry}
        dispatch={dispatch}
        conditionsByCategory={conditionsByCategory}
        conditionMap={conditionMap}
      />
      <BucketEditor
        bucket="exit"
        rows={state.exit}
        dispatch={dispatch}
        conditionsByCategory={conditionsByCategory}
        conditionMap={conditionMap}
      />

      <div className="builder-actions">
        <button type="button" className="primary" onClick={handleRun} disabled={!canRun}>
          Run backtest
        </button>
      </div>
      {runError && <div className="error-banner">Backtest error: {runError}</div>}

      <details className="json-io">
        <summary>Strategy JSON</summary>
        <textarea
          value={jsonText}
          onChange={(e) => onJsonTextChange(e.target.value)}
          rows={8}
          spellCheck={false}
        />
        <div className="builder-actions">
          <button
            type="button"
            disabled={!canRun}
            onClick={() => onJsonTextChange(serializeStrategy(buildStrategyJSON(state)))}
          >
            Export current
          </button>
          <button type="button" onClick={() => onImport(jsonText)}>
            Import to builder
          </button>
        </div>
        {importError && <div className="error-banner">Import error: {importError}</div>}
      </details>
    </>
  );
}

type BucketProps = {
  bucket: "entry" | "exit";
  rows: ConditionRow[];
  dispatch: (action: BuilderAction) => void;
  conditionsByCategory: Map<string, ConditionRegistryEntry<Condition>[]>;
  conditionMap: Map<string, ConditionRegistryEntry<Condition>>;
};

function BucketEditor({ bucket, rows, dispatch, conditionsByCategory, conditionMap }: BucketProps) {
  return (
    <div className="bucket">
      <div className="bucket-header">
        <span>{bucket === "entry" ? "Entry conditions" : "Exit conditions"}</span>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            dispatch({
              type: "add-row",
              bucket,
              conditionName: bucket === "entry" ? "goldenCross" : "deadCross",
            })
          }
        >
          + add
        </button>
      </div>
      {rows.length === 0 && <div className="empty">No conditions — backtest disabled.</div>}
      {rows.map((row) => {
        const entry = conditionMap.get(row.name);
        return (
          <div key={row.id} className="row">
            <select
              value={row.name}
              onChange={(e) =>
                dispatch({
                  type: "set-row-name",
                  bucket,
                  id: row.id,
                  conditionName: e.target.value,
                })
              }
            >
              {CATEGORY_ORDER.map((cat) => {
                const items = conditionsByCategory.get(cat);
                if (!items?.length) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {items.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.displayName}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <button
              type="button"
              className="ghost danger"
              onClick={() => dispatch({ type: "remove-row", bucket, id: row.id })}
              aria-label="Remove condition"
            >
              ×
            </button>
            {entry && (
              <ParamInputs
                bucket={bucket}
                rowId={row.id}
                row={row}
                entry={entry}
                dispatch={dispatch}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

type ParamInputsProps = {
  bucket: "entry" | "exit";
  rowId: string;
  row: ConditionRow;
  entry: ConditionRegistryEntry<Condition>;
  dispatch: (action: BuilderAction) => void;
};

function ParamInputs({ bucket, rowId, row, entry, dispatch }: ParamInputsProps) {
  const keys = Object.keys(entry.params);
  if (keys.length === 0) return null;
  return (
    <div className="param-grid">
      {keys.map((key) => {
        const def = entry.params[key];
        const current = row.params[key] ?? def.default;
        return (
          <label key={key} className="param-field" title={def.description ?? key}>
            <span>{key}</span>
            <input
              type={def.type === "number" ? "number" : "text"}
              value={current === undefined ? "" : String(current)}
              min={def.min}
              max={def.max}
              onChange={(e) => {
                const raw = e.target.value;
                const value = def.type === "number" ? (raw === "" ? undefined : Number(raw)) : raw;
                dispatch({ type: "set-row-param", bucket, id: rowId, key, value });
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
