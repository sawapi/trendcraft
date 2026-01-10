import { useEffect, useRef } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { AlertType } from "../types";

const AUTO_DISMISS_MS = 5000; // 5秒で自動消去

// アラートタイプごとのスタイルとアイコンを取得
function getAlertStyle(type: AlertType): { className: string; icon: string } {
  switch (type) {
    case "STOP_LOSS_WARNING":
      return { className: "warning", icon: "⚠️" };
    case "TAKE_PROFIT_REACHED":
    case "TRAILING_STOP_HIT":
    case "ORDER_EXECUTED":
      return { className: "info", icon: "🎯" };
    case "VOLUME_SPIKE_AVERAGE":
      return { className: "volume-avg", icon: "📊" };
    case "VOLUME_SPIKE_BREAKOUT":
      return { className: "volume-breakout", icon: "🚀" };
    case "VOLUME_ACCUMULATION":
      return { className: "volume-accumulation", icon: "📈" };
    case "VOLUME_MA_CROSS":
      return { className: "volume-ma-cross", icon: "⚡" };
    default:
      return { className: "info", icon: "ℹ️" };
  }
}

export function AlertBanner() {
  const { alerts, dismissAlert } = useSimulatorStore();
  // 各アラートIDごとにタイマーを管理（既にタイマーがあるものは再設定しない）
  const timerMapRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 各アラートを5秒後に自動消去（個別管理）
  useEffect(() => {
    const timerMap = timerMapRef.current;

    // 新しいアラートにだけタイマーを設定
    alerts.forEach((alert) => {
      if (!timerMap.has(alert.id)) {
        const timer = setTimeout(() => {
          dismissAlert(alert.id);
          timerMap.delete(alert.id);
        }, AUTO_DISMISS_MS);
        timerMap.set(alert.id, timer);
      }
    });

    // 削除されたアラートのタイマーをクリア
    const currentAlertIds = new Set(alerts.map(a => a.id));
    timerMap.forEach((timer, id) => {
      if (!currentAlertIds.has(id)) {
        clearTimeout(timer);
        timerMap.delete(id);
      }
    });
  }, [alerts, dismissAlert]);

  if (alerts.length === 0) return null;

  return (
    <div className="alert-banner-container">
      {alerts.map((alert) => {
        const style = getAlertStyle(alert.type);
        return (
          <div
            key={alert.id}
            className={`alert-banner ${style.className}`}
          >
            <span className="alert-icon">{style.icon}</span>
            <span className="alert-message">{alert.message}</span>
            <button
              className="alert-dismiss"
              onClick={() => dismissAlert(alert.id)}
              title="閉じる"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
