import { useEffect } from "react";
import { useSimulatorStore } from "../store/simulatorStore";

const AUTO_DISMISS_MS = 5000; // 5秒で自動消去

export function AlertBanner() {
  const { alerts, dismissAlert } = useSimulatorStore();

  // 各アラートを5秒後に自動消去
  useEffect(() => {
    if (alerts.length === 0) return;

    const timers = alerts.map((alert) => {
      return setTimeout(() => {
        dismissAlert(alert.id);
      }, AUTO_DISMISS_MS);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [alerts, dismissAlert]);

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
