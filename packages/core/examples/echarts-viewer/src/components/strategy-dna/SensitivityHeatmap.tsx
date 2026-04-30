/**
 * Sensitivity Heatmap - 1D bar chart or 2D heatmap for parameter sensitivity
 */

import { useEffect, useRef } from "react";
import type { SensitivityData } from "../../utils/strategyDna";

interface Props {
  data: SensitivityData;
  selectedParam: string | null;
  selectedParamPair: [string, string] | null;
  onSelectParam: (name: string | null) => void;
  onSelectParamPair: (pair: [string, string] | null) => void;
}

export function SensitivityHeatmap({
  data,
  selectedParam,
  selectedParamPair,
  onSelectParam,
  onSelectParamPair,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<ReturnType<typeof import("echarts")["init"]> | null>(null);

  const paramNames = data.singleParams.map((s) => s.paramName);
  const showChart = selectedParam || selectedParamPair;

  // Dispose chart when hiding
  useEffect(() => {
    if (!showChart && echartsRef.current) {
      echartsRef.current.dispose();
      echartsRef.current = null;
    }
  }, [showChart]);

  // Render chart when selection changes
  useEffect(() => {
    if (!showChart || !chartRef.current) return;

    let disposed = false;

    const loadEcharts = async () => {
      const echarts = await import("echarts");
      if (disposed) return;

      // Dispose old instance if the DOM element changed
      if (echartsRef.current) {
        echartsRef.current.dispose();
        echartsRef.current = null;
      }

      if (!chartRef.current) return;
      echartsRef.current = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
      const chart = echartsRef.current;

      if (selectedParamPair && data.pairwise.length > 0) {
        // 2D heatmap
        const pair = data.pairwise.find(
          (p) => p.paramX === selectedParamPair[0] && p.paramY === selectedParamPair[1],
        );
        if (!pair) return;

        const xLabels = pair.xValues.map(String);
        const yLabels = pair.yValues.map(String);

        const heatmapData = pair.data.map((d) => [
          pair.xValues.indexOf(d.x),
          pair.yValues.indexOf(d.y),
          Number(d.metric.toFixed(3)),
        ]);

        const metricValues = pair.data.map((d) => d.metric);

        chart.setOption({
          tooltip: {
            position: "top",
            formatter: (params: { data: number[] }) => {
              const [xi, yi, val] = params.data;
              return `${pair.paramX}=${xLabels[xi]}, ${pair.paramY}=${yLabels[yi]}<br/>Score: ${val}`;
            },
          },
          xAxis: {
            type: "category",
            data: xLabels,
            name: pair.paramX,
            nameTextStyle: { color: "#999", fontSize: 10 },
            axisLabel: { color: "#aaa", fontSize: 9 },
            splitArea: { show: true },
          },
          yAxis: {
            type: "category",
            data: yLabels,
            name: pair.paramY,
            nameTextStyle: { color: "#999", fontSize: 10 },
            axisLabel: { color: "#aaa", fontSize: 9 },
            splitArea: { show: true },
          },
          visualMap: {
            min: Math.min(...metricValues),
            max: Math.max(...metricValues),
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 0,
            inRange: {
              color: [
                "#313695",
                "#4575b4",
                "#74add1",
                "#abd9e9",
                "#fee090",
                "#fdae61",
                "#f46d43",
                "#d73027",
              ],
            },
            textStyle: { color: "#aaa", fontSize: 9 },
            itemHeight: 8,
          },
          grid: { top: 10, right: 10, bottom: 50, left: 60 },
          series: [
            {
              type: "heatmap",
              data: heatmapData,
              label: { show: false },
              emphasis: {
                itemStyle: { shadowBlur: 6, shadowColor: "rgba(0, 0, 0, 0.5)" },
              },
            },
          ],
        });
      } else if (selectedParam) {
        // 1D bar chart
        const single = data.singleParams.find((s) => s.paramName === selectedParam);
        if (!single) return;

        const safeZone = data.safeZones.find((s) => s.paramName === selectedParam);

        chart.setOption({
          tooltip: {
            trigger: "axis",
            formatter: (params: { name: string; value: number }[]) => {
              return `${selectedParam}=${params[0].name}<br/>Score: ${params[0].value.toFixed(3)}`;
            },
          },
          xAxis: {
            type: "category",
            data: single.data.map((d) => String(d.value)),
            axisLabel: { color: "#aaa", fontSize: 9, rotate: single.data.length > 10 ? 45 : 0 },
          },
          yAxis: {
            type: "value",
            axisLabel: { color: "#aaa", fontSize: 9 },
            splitLine: { lineStyle: { color: "#333" } },
          },
          grid: { top: 10, right: 10, bottom: 30, left: 45 },
          series: [
            {
              type: "bar",
              data: single.data.map((d) => ({
                value: Number(d.metric.toFixed(3)),
                itemStyle: {
                  color:
                    safeZone && d.value >= safeZone.min && d.value <= safeZone.max
                      ? "rgba(0, 255, 136, 0.6)"
                      : "rgba(233, 69, 96, 0.5)",
                },
              })),
              barMaxWidth: 20,
            },
          ],
        });
      }

      chart.resize();
    };

    loadEcharts();

    return () => {
      disposed = true;
    };
  }, [selectedParam, selectedParamPair, data, showChart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (echartsRef.current) {
        echartsRef.current.dispose();
        echartsRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Parameter selection */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {paramNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              onSelectParamPair(null);
              onSelectParam(selectedParam === name ? null : name);
            }}
            style={{
              padding: "3px 8px",
              fontSize: "var(--font-xs)",
              background: selectedParam === name ? "var(--accent-primary)" : "var(--bg-tertiary)",
              color: selectedParam === name ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Pair selection (if >= 2 params) */}
      {paramNames.length >= 2 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "var(--text-secondary)", alignSelf: "center" }}>
            2D:
          </span>
          {data.pairwise.map((pair) => {
            const key = `${pair.paramX}|${pair.paramY}`;
            const isSelected =
              selectedParamPair &&
              selectedParamPair[0] === pair.paramX &&
              selectedParamPair[1] === pair.paramY;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onSelectParam(null);
                  onSelectParamPair(isSelected ? null : [pair.paramX, pair.paramY]);
                }}
                style={{
                  padding: "2px 6px",
                  fontSize: 9,
                  background: isSelected ? "var(--accent-secondary)" : "var(--bg-tertiary)",
                  color: isSelected ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {pair.paramX} x {pair.paramY}
              </button>
            );
          })}
        </div>
      )}

      {/* Safe zone legend */}
      {selectedParam && data.safeZones.length > 0 && (
        <div
          style={{
            fontSize: 9,
            color: "var(--text-secondary)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              background: "rgba(0, 255, 136, 0.6)",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Safe Zone (top 25%)
        </div>
      )}

      {/* Chart — always rendered, hidden when not needed to preserve ref */}
      <div
        ref={chartRef}
        style={{
          width: "100%",
          height: selectedParamPair ? 200 : 150,
          background: "var(--bg-primary)",
          borderRadius: 6,
          display: showChart ? "block" : "none",
        }}
      />

      {!showChart && (
        <div
          style={{
            textAlign: "center",
            padding: 16,
            color: "var(--text-secondary)",
            fontSize: "var(--font-xs)",
          }}
        >
          Select a parameter to view sensitivity
        </div>
      )}
    </div>
  );
}
