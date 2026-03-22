/**
 * Strategy DNA hook
 *
 * Manages state for the Strategy DNA panel: genome visualization,
 * sensitivity analysis, robustness grading, and share URL.
 */

import { useCallback, useMemo, useState } from "react";
import type { MonteCarloResult } from "trendcraft";
import { runMonteCarloSimulation } from "trendcraft";
import { useChartStore } from "../store/chartStore";
import {
  type GenomeSegment,
  type RecommendedParams,
  type RobustnessGrade,
  type SensitivityData,
  buildGenomeSegments,
  computeRecommendedParams,
  computeRobustnessGrade,
  encodeBacktestConfig,
  extractSensitivityData,
} from "../utils/strategyDna";

export type DnaTab = "genome" | "sensitivity" | "robustness" | "share";

export function useStrategyDna() {
  const [activeTab, setActiveTab] = useState<DnaTab>("genome");
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [selectedParamPair, setSelectedParamPair] = useState<[string, string] | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isComputingGrade, setIsComputingGrade] = useState(false);

  const gridSearchResult = useChartStore((s) => s.gridSearchResult);
  const walkForwardResult = useChartStore((s) => s.walkForwardResult);
  const backtestResult = useChartStore((s) => s.backtestResult);
  const backtestConfig = useChartStore((s) => s.backtestConfig);

  // Genome segments — lightweight, only uses bestParams + params from results
  const genomeSegments: GenomeSegment[] | null = useMemo(() => {
    if (!gridSearchResult || Object.keys(gridSearchResult.bestParams).length === 0) return null;
    const paramNames = Object.keys(gridSearchResult.bestParams);
    // Extract min/max per param without creating intermediate arrays
    const ranges = paramNames.map((name) => {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const r of gridSearchResult.results) {
        const v = r.params[name];
        if (v !== undefined) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      return { name, min, max };
    });
    return buildGenomeSegments(gridSearchResult.bestParams, ranges, gridSearchResult.bestScore);
  }, [gridSearchResult]);

  // Sensitivity data — only extract lightweight metric values, not full results
  const sensitivityData: SensitivityData | null = useMemo(() => {
    if (!gridSearchResult || gridSearchResult.results.length === 0) return null;
    // Cap at 2000 results to prevent memory issues
    const capped =
      gridSearchResult.results.length > 2000
        ? gridSearchResult.results.slice(0, 2000)
        : gridSearchResult.results;
    return extractSensitivityData(capped, gridSearchResult.metric);
  }, [gridSearchResult]);

  // Robustness grade
  const robustnessGrade: RobustnessGrade = useMemo(() => {
    return computeRobustnessGrade(gridSearchResult, walkForwardResult, monteCarloResult);
  }, [gridSearchResult, walkForwardResult, monteCarloResult]);

  // Recommended parameters
  const recommendedParams: RecommendedParams | null = useMemo(() => {
    if (!gridSearchResult || gridSearchResult.results.length === 0) return null;
    return computeRecommendedParams(gridSearchResult, walkForwardResult, sensitivityData);
  }, [gridSearchResult, walkForwardResult, sensitivityData]);

  // Compute grade (triggers Monte Carlo)
  const computeGrade = useCallback(() => {
    if (!backtestResult || backtestResult.trades.length < 2) return;
    setIsComputingGrade(true);

    setTimeout(() => {
      try {
        const result = runMonteCarloSimulation(backtestResult, {
          simulations: 500,
        });
        setMonteCarloResult(result);
      } catch (e) {
        console.warn("Monte Carlo failed:", e);
      } finally {
        setIsComputingGrade(false);
      }
    }, 50);
  }, [backtestResult]);

  // Share URL
  const shareUrl = useMemo(() => {
    const encoded = encodeBacktestConfig(backtestConfig);
    const base = window.location.origin + window.location.pathname;
    return `${base}?${encoded}`;
  }, [backtestConfig]);

  const [copyFeedback, setCopyFeedback] = useState(false);

  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  }, [shareUrl]);

  return {
    activeTab,
    setActiveTab,
    // Genome
    genomeSegments,
    // Sensitivity
    sensitivityData,
    selectedParam,
    setSelectedParam,
    selectedParamPair,
    setSelectedParamPair,
    // Robustness
    robustnessGrade,
    isComputingGrade,
    computeGrade,
    monteCarloResult,
    // Recommended params
    recommendedParams,
    // Share
    shareUrl,
    copyShareUrl,
    copyFeedback,
    // Prerequisites
    hasGridSearch: !!gridSearchResult,
    hasWalkForward: !!walkForwardResult,
    hasBacktest: !!backtestResult,
  };
}
