import type { CoachingLevel, CoachingSignal, SignalDirection } from "../engine/signalCoach";
import { useSimulatorStore } from "../store/simulatorStore";

const DIRECTION_COLORS: Record<SignalDirection, string> = {
  bullish: "var(--success)",
  bearish: "var(--danger)",
  info: "var(--info)",
};

const DIRECTION_ICONS: Record<SignalDirection, string> = {
  bullish: "\u25B2",
  bearish: "\u25BC",
  info: "\u25CF",
};

const LEVEL_LABELS: Record<CoachingLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function SignalCard({
  signal,
  level,
}: {
  signal: CoachingSignal;
  level: CoachingLevel;
}) {
  const color = DIRECTION_COLORS[signal.direction];
  const icon = DIRECTION_ICONS[signal.direction];

  return (
    <div className="coaching-signal" style={{ borderLeftColor: color }}>
      <div className="coaching-signal-header">
        <span className="coaching-signal-icon" style={{ color }}>
          {icon}
        </span>
        <span className="coaching-signal-message">
          {level === "advanced" ? signal.indicator : signal.message}
        </span>
        {signal.severity === "high" && <span className="coaching-signal-badge">!</span>}
      </div>
      {level === "beginner" && <div className="coaching-signal-detail">{signal.detail}</div>}
    </div>
  );
}

export function CoachingPanel() {
  const coachingSignals = useSimulatorStore((s) => s.coachingSignals);
  const coachingLevel = useSimulatorStore((s) => s.coachingLevel);
  const coachingEnabled = useSimulatorStore((s) => s.coachingEnabled);
  const setCoachingLevel = useSimulatorStore((s) => s.setCoachingLevel);
  const setCoachingEnabled = useSimulatorStore((s) => s.setCoachingEnabled);

  return (
    <div className="coaching-panel">
      <div className="coaching-header">
        <div className="coaching-title">
          <span>Coaching</span>
          <label className="coaching-toggle">
            <input
              type="checkbox"
              checked={coachingEnabled}
              onChange={(e) => setCoachingEnabled(e.target.checked)}
            />
            <span className="coaching-toggle-slider" />
          </label>
        </div>
        {coachingEnabled && (
          <select
            className="coaching-level-select"
            value={coachingLevel}
            onChange={(e) => setCoachingLevel(e.target.value as CoachingLevel)}
          >
            {(Object.entries(LEVEL_LABELS) as [CoachingLevel, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      {coachingEnabled && coachingSignals.length > 0 && (
        <div className="coaching-signals">
          {coachingSignals.map((signal, i) => (
            <SignalCard key={`${signal.type}-${i}`} signal={signal} level={coachingLevel} />
          ))}
        </div>
      )}
      {coachingEnabled && coachingSignals.length === 0 && (
        <div className="coaching-empty">No signals detected</div>
      )}
    </div>
  );
}
