import { useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";

interface VolumeSpikeSettingsProps {
  isInDialog?: boolean;
}

export function VolumeSpikeSettings({ isInDialog = false }: VolumeSpikeSettingsProps) {
  const { volumeSpikeSettings, setVolumeSpikeSettings, phase } = useSimulatorStore();
  const [isExpanded, setIsExpanded] = useState(isInDialog);

  // ダイアログ内でない場合は、setup以外のフェーズでのみ表示
  if (!isInDialog && phase === "setup") return null;

  // 有効な検知機能の数を計算
  const enabledCount = [
    volumeSpikeSettings.averageVolumeEnabled,
    volumeSpikeSettings.breakoutVolumeEnabled,
    volumeSpikeSettings.accumulationEnabled,
    volumeSpikeSettings.aboveAverageEnabled,
    volumeSpikeSettings.maCrossEnabled,
    volumeSpikeSettings.cmfEnabled,
    volumeSpikeSettings.obvEnabled,
  ].filter(Boolean).length;

  const content = (
    <div className="settings-content">
      {/* 平均出来高スパイク */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.averageVolumeEnabled}
            onChange={(e) => setVolumeSpikeSettings({ averageVolumeEnabled: e.target.checked })}
          />
          <span>平均出来高突破検知</span>
        </label>

        {volumeSpikeSettings.averageVolumeEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>計算期間</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={volumeSpikeSettings.averageVolumePeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      averageVolumePeriod: Math.max(5, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
            <div className="setting-input">
              <label>検知倍率</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={1.1}
                  max={10}
                  step={0.1}
                  value={volumeSpikeSettings.averageVolumeMultiplier}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      averageVolumeMultiplier: Math.max(1.1, Math.min(10, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">倍</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ブレイクアウト検知 */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.breakoutVolumeEnabled}
            onChange={(e) => setVolumeSpikeSettings({ breakoutVolumeEnabled: e.target.checked })}
          />
          <span>N日最高出来高突破検知</span>
        </label>

        {volumeSpikeSettings.breakoutVolumeEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>比較期間</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={volumeSpikeSettings.breakoutVolumePeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      breakoutVolumePeriod: Math.max(5, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 蓄積フェーズ検知（回帰ベース） */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.accumulationEnabled}
            onChange={(e) => setVolumeSpikeSettings({ accumulationEnabled: e.target.checked })}
          />
          <span>増加傾向検知（回帰）</span>
        </label>

        {volumeSpikeSettings.accumulationEnabled && (
          <div className="setting-inputs">
            <div className="setting-hint">線形回帰で出来高の増加傾向を検知</div>
            <div className="setting-input">
              <label>計算期間</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={volumeSpikeSettings.accumulationPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      accumulationPeriod: Math.max(3, Math.min(30, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
            <div className="setting-input">
              <label>最小傾き</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  value={volumeSpikeSettings.accumulationMinSlope}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      accumulationMinSlope: Math.max(0.01, Math.min(0.5, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">/日</span>
              </div>
            </div>
            <div className="setting-input">
              <label>最小連続日数</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={volumeSpikeSettings.accumulationMinDays}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      accumulationMinDays: Math.max(1, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 高水準継続検知（平均比較ベース） */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.aboveAverageEnabled}
            onChange={(e) => setVolumeSpikeSettings({ aboveAverageEnabled: e.target.checked })}
          />
          <span>高水準継続検知（平均比較）</span>
        </label>

        {volumeSpikeSettings.aboveAverageEnabled && (
          <div className="setting-inputs">
            <div className="setting-hint">N日平均を超える出来高が連続</div>
            <div className="setting-input">
              <label>平均計算期間</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={volumeSpikeSettings.aboveAveragePeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      aboveAveragePeriod: Math.max(5, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
            <div className="setting-input">
              <label>最小比率</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={volumeSpikeSettings.aboveAverageMinRatio}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      aboveAverageMinRatio: Math.max(0.5, Math.min(3.0, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">倍</span>
              </div>
            </div>
            <div className="setting-input">
              <label>最小連続日数</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={volumeSpikeSettings.aboveAverageMinDays}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      aboveAverageMinDays: Math.max(1, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAクロス検知 */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.maCrossEnabled}
            onChange={(e) => setVolumeSpikeSettings({ maCrossEnabled: e.target.checked })}
          />
          <span>出来高MAクロス検知</span>
        </label>

        {volumeSpikeSettings.maCrossEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>短期MA</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={volumeSpikeSettings.maCrossShortPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      maCrossShortPeriod: Math.max(2, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
            <div className="setting-input">
              <label>長期MA</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={volumeSpikeSettings.maCrossLongPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      maCrossLongPeriod: Math.max(10, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CMF蓄積/分配検知 */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.cmfEnabled}
            onChange={(e) => setVolumeSpikeSettings({ cmfEnabled: e.target.checked })}
          />
          <span>CMF蓄積/分配検知</span>
        </label>

        {volumeSpikeSettings.cmfEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>計算期間</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={volumeSpikeSettings.cmfPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      cmfPeriod: Math.max(5, Math.min(50, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
            <div className="setting-input">
              <label>閾値</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={-0.5}
                  max={0.5}
                  step={0.05}
                  value={volumeSpikeSettings.cmfThreshold}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      cmfThreshold: Math.max(-0.5, Math.min(0.5, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit" />
              </div>
            </div>
            <div className="setting-hint">CMF &gt; 閾値: 蓄積 / CMF &lt; -閾値: 分配</div>
          </div>
        )}
      </div>

      {/* OBVトレンド検知 */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.obvEnabled}
            onChange={(e) => setVolumeSpikeSettings({ obvEnabled: e.target.checked })}
          />
          <span>OBVトレンド検知</span>
        </label>

        {volumeSpikeSettings.obvEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>比較期間</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={volumeSpikeSettings.obvPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      obvPeriod: Math.max(3, Math.min(30, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">日</span>
              </div>
            </div>
            <div className="setting-hint">OBV上昇傾向: 買い優勢 / OBV下降傾向: 売り優勢</div>
          </div>
        )}
      </div>

      {/* 表示オプション */}
      <div className="setting-group display-options">
        <div className="group-title">表示設定</div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.showRealtimeAlerts}
            onChange={(e) => setVolumeSpikeSettings({ showRealtimeAlerts: e.target.checked })}
          />
          <span>リアルタイムアラート</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.showChartMarkers}
            onChange={(e) => setVolumeSpikeSettings({ showChartMarkers: e.target.checked })}
          />
          <span>チャートマーカー</span>
        </label>
      </div>
    </div>
  );

  // ダイアログ内ではアコーディオンなしで直接表示
  if (isInDialog) {
    return <div className="volume-spike-settings in-dialog">{content}</div>;
  }

  return (
    <div className="volume-spike-settings panel">
      <button className="settings-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="toggle-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="toggle-label">出来高スパイク検知</span>
        <span className="toggle-status">{enabledCount > 0 ? `${enabledCount}件ON` : "OFF"}</span>
      </button>

      {isExpanded && content}
    </div>
  );
}
