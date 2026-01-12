import { useEffect, useRef } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { AlertType } from "../types";

const AUTO_DISMISS_MS = 5000; // 5秒で自動消去

const ALERT_STYLES: Record<AlertType, { className: string; icon: string }> = {
  STOP_LOSS_WARNING: { className: "warning", icon: "⚠️" },
  TAKE_PROFIT_REACHED: { className: "info", icon: "🎯" },
  TRAILING_STOP_HIT: { className: "info", icon: "🎯" },
  ORDER_EXECUTED: { className: "info", icon: "🎯" },
  VOLUME_SPIKE_AVERAGE: { className: "volume-avg", icon: "📊" },
  VOLUME_SPIKE_BREAKOUT: { className: "volume-breakout", icon: "🚀" },
  VOLUME_ACCUMULATION: { className: "volume-accumulation", icon: "📈" },
  VOLUME_ABOVE_AVERAGE: { className: "volume-accumulation", icon: "📈" },
  VOLUME_MA_CROSS: { className: "volume-ma-cross", icon: "⚡" },
  CMF_ACCUMULATION: { className: "info", icon: "💰" },
  CMF_DISTRIBUTION: { className: "warning", icon: "📤" },
  OBV_RISING: { className: "info", icon: "📈" },
  OBV_FALLING: { className: "warning", icon: "📉" },
};

function getAlertStyle(type: AlertType): { className: string; icon: string } {
  return ALERT_STYLES[type];
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
    const currentAlertIds = new Set(alerts.map((a) => a.id));
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
          <div key={alert.id} className={`alert-banner ${style.className}`}>
            <span className="alert-icon">{style.icon}</span>
            <span className="alert-message">{alert.message}</span>
            <button
              type="button"
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
