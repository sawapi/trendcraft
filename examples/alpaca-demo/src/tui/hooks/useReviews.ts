/**
 * useReviews — load review history from disk, trigger manual reviews
 */

import { useCallback, useEffect, useState } from "react";
import { executeReviewCycle } from "../../commands/review.js";
import { loadRecentReviews, loadTodayIntraSessionReviews } from "../../review/history.js";
import type { IntraSessionReviewRecord, ReviewRecord } from "../../review/types.js";

export type ReviewsState = {
  dailyReviews: ReviewRecord[];
  intraReviews: IntraSessionReviewRecord[];
  isLoading: boolean;
  isReviewing: boolean;
};

export function useReviews(): [
  ReviewsState,
  { reload: () => void; runReview: (opts: { apply: boolean }) => Promise<void> },
] {
  const [state, setState] = useState<ReviewsState>({
    dailyReviews: [],
    intraReviews: [],
    isLoading: true,
    isReviewing: false,
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const dailyReviews = loadRecentReviews(7);
      const intraReviews = loadTodayIntraSessionReviews();
      setState({ dailyReviews, intraReviews, isLoading: false, isReviewing: false });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const reload = () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const dailyReviews = loadRecentReviews(7);
      const intraReviews = loadTodayIntraSessionReviews();
      setState((prev) => ({ ...prev, dailyReviews, intraReviews, isLoading: false }));
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const runReview = useCallback(async (opts: { apply: boolean }) => {
    setState((prev) => ({ ...prev, isReviewing: true }));
    try {
      await executeReviewCycle({ apply: opts.apply });
    } catch (err) {
      // Review errors are logged by executeReviewCycle itself
    } finally {
      // Reload after review completes
      try {
        const dailyReviews = loadRecentReviews(7);
        const intraReviews = loadTodayIntraSessionReviews();
        setState((prev) => ({ ...prev, dailyReviews, intraReviews, isReviewing: false }));
      } catch {
        setState((prev) => ({ ...prev, isReviewing: false }));
      }
    }
  }, []);

  return [state, { reload, runReview }];
}
