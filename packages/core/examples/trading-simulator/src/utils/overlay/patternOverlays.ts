import type { NormalizedCandle } from "trendcraft";
import { COLORS, type SeriesItem } from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build pattern overlay series (Double Top/Bottom, H&S, Cup, Fractals, Zigzag)
 */
export function buildPatternOverlays(
  series: SeriesItem[],
  indicators: IndicatorData,
  enabledIndicators: string[],
  candles: NormalizedCandle[],
): void {
  // Pattern Recognition (existing: Double Top/Bottom, H&S, Cup with Handle)
  if (indicators.detectedPatterns && indicators.detectedPatterns.length > 0) {
    const patternsToRender = indicators.detectedPatterns.filter((p) => p.confirmed);

    for (const pattern of patternsToRender) {
      const { keyPoints, neckline, target } = pattern.pattern;
      const isDoubleBottom = pattern.type === "double_bottom";
      const isDoubleTop = pattern.type === "double_top";

      const pointsWithIndex: { idx: number; price: number; label: string }[] = [];

      for (const kp of keyPoints) {
        if (typeof kp.index === "number" && kp.index >= 0) {
          pointsWithIndex.push({ idx: kp.index, price: kp.price, label: kp.label });
        } else {
          const idx = candles.findIndex((c) => c.time === kp.time);
          if (idx >= 0) {
            pointsWithIndex.push({ idx, price: kp.price, label: kp.label });
          }
        }
      }

      if (pointsWithIndex.length >= 3) {
        const capturedPoints = JSON.parse(JSON.stringify(pointsWithIndex));
        const patternFillColor = isDoubleTop ? COLORS.patternBearishFill : COLORS.patternFill;
        const patternLineColor = isDoubleTop ? COLORS.patternBearishLine : COLORS.patternLine;
        const patternNecklineColor = isDoubleTop
          ? COLORS.patternBearishNeckline
          : COLORS.patternNeckline;
        const patternTargetColor = isDoubleTop ? COLORS.patternBearishTarget : COLORS.patternTarget;
        const patternLabelColor = isDoubleTop ? COLORS.patternBearishLabel : COLORS.patternLabel;

        const isStrictMode = capturedPoints.length === 7;
        const polygonPointsData = isStrictMode ? capturedPoints.slice(1, 6) : capturedPoints;

        // Polygon fill
        series.push({
          name: `Pattern Fill: ${pattern.type}`,
          type: "custom",
          coordinateSystem: "cartesian2d",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: [{}],
          encode: { x: -1, y: -1 },
          renderItem: ((
            points: typeof polygonPointsData,
            fillColor: string,
            strokeColor: string,
          ) => {
            return (params: SeriesItem, api: SeriesItem) => {
              if (params.dataIndex !== 0) {
                return { type: "group", children: [] };
              }
              const polygonPoints: number[][] = [];
              for (const p of points) {
                const point = api.coord([p.idx, p.price]);
                if (point) polygonPoints.push(point);
              }
              if (polygonPoints.length < 3) {
                return { type: "group", children: [] };
              }
              return {
                type: "group",
                children: [
                  {
                    type: "polygon",
                    shape: { points: polygonPoints },
                    style: { fill: fillColor, stroke: strokeColor, lineWidth: 2 },
                    silent: true,
                  },
                ],
              };
            };
          })(polygonPointsData, patternFillColor, patternLineColor),
          z: 10,
          silent: true,
        });

        // Lines connecting key points
        const lineMarkData = [];
        if (isStrictMode) {
          lineMarkData.push([
            { coord: [capturedPoints[0].idx, capturedPoints[0].price] },
            { coord: [capturedPoints[1].idx, capturedPoints[1].price] },
          ]);
          for (let i = 1; i < capturedPoints.length - 2; i++) {
            lineMarkData.push([
              { coord: [capturedPoints[i].idx, capturedPoints[i].price] },
              { coord: [capturedPoints[i + 1].idx, capturedPoints[i + 1].price] },
            ]);
          }
          lineMarkData.push([
            { coord: [capturedPoints[5].idx, capturedPoints[5].price] },
            { coord: [capturedPoints[6].idx, capturedPoints[6].price] },
          ]);
        } else {
          for (let i = 0; i < capturedPoints.length - 1; i++) {
            lineMarkData.push([
              { coord: [capturedPoints[i].idx, capturedPoints[i].price] },
              { coord: [capturedPoints[i + 1].idx, capturedPoints[i + 1].price] },
            ]);
          }
        }

        series.push({
          name: `Pattern Lines: ${pattern.type}`,
          type: "line",
          data: [],
          markLine: {
            silent: true,
            symbol: ["circle", "circle"],
            symbolSize: 6,
            data: lineMarkData,
            lineStyle: { color: patternLineColor, width: 2, type: "solid" },
            label: { show: false },
          },
          z: 2,
        });

        // Neckline
        if (neckline) {
          const firstPoint = capturedPoints[0];
          const lastPoint = capturedPoints[capturedPoints.length - 1];
          const necklineEndIdx = Math.min(lastPoint.idx + 30, candles.length - 1);

          series.push({
            name: "Neckline",
            type: "line",
            data: [],
            markLine: {
              silent: true,
              symbol: "none",
              data: [
                [
                  { coord: [firstPoint.idx, neckline.currentPrice] },
                  { coord: [necklineEndIdx, neckline.currentPrice] },
                ],
              ],
              lineStyle: { color: patternNecklineColor, width: 1.5, type: "dotted" },
              label: { show: false },
            },
            z: 3,
          });
        }

        // Target price
        if (target && neckline) {
          const lastPoint = capturedPoints[capturedPoints.length - 1];
          const targetXIdx = Math.min(lastPoint.idx + 20, candles.length - 1);

          series.push({
            name: "Target",
            type: "line",
            data: [],
            markLine: {
              silent: true,
              symbol: ["none", "arrow"],
              symbolSize: 8,
              data: [
                [{ coord: [targetXIdx, neckline.currentPrice] }, { coord: [targetXIdx, target] }],
              ],
              lineStyle: { color: patternTargetColor, width: 1.5, type: "dashed" },
              label: {
                show: true,
                formatter: "Target",
                position: "end",
                color: "#fff",
                backgroundColor: patternTargetColor,
                padding: [4, 8],
                borderRadius: 4,
              },
            },
            z: 4,
          });
        }

        // Key point labels
        let labelsToShow: string[] = [];
        if (isDoubleBottom) labelsToShow = ["First Trough", "Second Trough"];
        else if (isDoubleTop) labelsToShow = ["First Peak", "Second Peak"];

        const labelNames: Record<string, string> = {
          "First Trough": "Bottom 1",
          "Second Trough": "Bottom 2",
          "First Peak": "Top 1",
          "Second Peak": "Top 2",
        };

        const labelMarkPoints = labelsToShow
          .map((labelKey) => {
            const point = capturedPoints.find((p: { label: string }) => p.label === labelKey);
            if (!point) return null;
            return {
              coord: [point.idx, point.price],
              symbol: "roundRect",
              symbolSize: [70, 22],
              symbolOffset: [0, isDoubleBottom ? 25 : -25],
              itemStyle: { color: patternLabelColor },
              label: {
                show: true,
                formatter: labelNames[labelKey] || labelKey,
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
              },
            };
          })
          .filter(Boolean);

        if (labelMarkPoints.length > 0) {
          series.push({
            name: "Pattern Labels",
            type: "line",
            data: [],
            markPoint: { data: labelMarkPoints },
            z: 5,
          });
        }
      }
    }
  }

  // Fractals
  if (enabledIndicators.includes("fractals") && indicators.fractalData) {
    const fractalMarkers: SeriesItem[] = [];

    indicators.fractalData.forEach((f, idx) => {
      if (f?.upFractal && f.upPrice != null) {
        fractalMarkers.push({
          coord: [idx, f.upPrice],
          symbol: "triangle",
          symbolSize: 6,
          symbolRotate: 180,
          itemStyle: { color: COLORS.fractalUp },
        });
      }
      if (f?.downFractal && f.downPrice != null) {
        fractalMarkers.push({
          coord: [idx, f.downPrice],
          symbol: "triangle",
          symbolSize: 6,
          itemStyle: { color: COLORS.fractalDown },
        });
      }
    });

    if (fractalMarkers.length > 0) {
      series.push({
        name: "Fractals",
        type: "scatter",
        data: [],
        markPoint: { data: fractalMarkers },
      });
    }
  }

  // Zigzag
  if (enabledIndicators.includes("zigzag") && indicators.zigzagData) {
    // Build line segments from zigzag points
    const zigzagPoints: { idx: number; price: number }[] = [];
    indicators.zigzagData.forEach((z, idx) => {
      if (z?.point && z.price != null) {
        zigzagPoints.push({ idx, price: z.price });
      }
    });

    if (zigzagPoints.length >= 2) {
      const lineMarkData = [];
      for (let i = 0; i < zigzagPoints.length - 1; i++) {
        lineMarkData.push([
          { coord: [zigzagPoints[i].idx, zigzagPoints[i].price] },
          { coord: [zigzagPoints[i + 1].idx, zigzagPoints[i + 1].price] },
        ]);
      }

      series.push({
        name: "Zigzag",
        type: "line",
        data: [],
        markLine: {
          silent: true,
          symbol: ["circle", "circle"],
          symbolSize: 4,
          data: lineMarkData,
          lineStyle: { color: COLORS.zigzagLine, width: 1.5, type: "solid" },
          label: { show: false },
        },
        z: 1,
      });
    }
  }
}
