import { useState } from "react";
import { useSimulatorStore } from "../../store/simulatorStore";
import type { TradeJournalEntry } from "../../types";

interface JournalEntryProps {
  onSubmit: (journal: TradeJournalEntry) => void;
}

const CONFIDENCE_LABELS = ["", "Very Low", "Low", "Medium", "High", "Very High"];

export function JournalEntry({ onSubmit }: JournalEntryProps) {
  const coachingSignals = useSimulatorStore((s) => s.coachingSignals);
  const [thesis, setThesis] = useState("");
  const [setup, setSetup] = useState("");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);

  const handleSubmit = () => {
    onSubmit({
      thesis,
      setup,
      confidence,
      coachingSignalsAtTime: coachingSignals.map((s) => s.type),
    });
    setThesis("");
    setSetup("");
    setConfidence(3);
  };

  return (
    <div className="journal-entry">
      <div className="journal-field">
        <label>Thesis (why this trade?)</label>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="e.g., RSI oversold with support at MA75, expecting mean reversion"
          rows={2}
        />
      </div>
      <div className="journal-field">
        <label>Setup (what pattern/signal?)</label>
        <input
          type="text"
          value={setup}
          onChange={(e) => setSetup(e.target.value)}
          placeholder="e.g., Bullish engulfing at BB lower band"
        />
      </div>
      <div className="journal-field">
        <label>Confidence: {CONFIDENCE_LABELS[confidence]}</label>
        <div className="confidence-selector">
          {([1, 2, 3, 4, 5] as const).map((level) => (
            <button
              key={level}
              className={`confidence-btn ${confidence === level ? "active" : ""}`}
              onClick={() => setConfidence(level)}
              title={CONFIDENCE_LABELS[level]}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      {coachingSignals.length > 0 && (
        <div className="journal-coaching-snapshot">
          <span className="snapshot-label">Active signals:</span>
          {coachingSignals.map((s, i) => (
            <span key={`${s.type}-${i}`} className={`snapshot-tag ${s.direction}`}>
              {s.message}
            </span>
          ))}
        </div>
      )}
      <button className="journal-save-btn" onClick={handleSubmit} disabled={!thesis.trim()}>
        Save Journal
      </button>
    </div>
  );
}
