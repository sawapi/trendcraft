import { useSimulatorStore } from "../store/simulatorStore";

export function AlertBanner() {
  const { alerts, dismissAlert } = useSimulatorStore();

  if (alerts.length === 0) return null;

  return (
    <div className="alert-banner-container">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`alert-banner ${alert.type === "STOP_LOSS_WARNING" ? "warning" : "info"}`}
        >
          <span className="alert-icon">
            {alert.type === "STOP_LOSS_WARNING" ? "⚠️" : "🎯"}
          </span>
          <span className="alert-message">{alert.message}</span>
          <button
            className="alert-dismiss"
            onClick={() => dismissAlert(alert.id)}
            title="閉じる"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
