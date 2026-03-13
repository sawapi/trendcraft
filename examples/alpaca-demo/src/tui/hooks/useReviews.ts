/**
 * useReviews — load review history from disk
 */

import { useEffect, useState } from "react";
import { loadRecentReviews, loadTodayIntraSessionReviews } from "../../review/history.js";
import type { IntraSessionReviewRecord, ReviewRecord } from "../../review/types.js";

export type ReviewsState = {
  dailyReviews: ReviewRecord[];
  intraReviews: IntraSessionReviewRecord[];
  isLoading: boolean;
};

export function useReviews(): [ReviewsState, { reload: () => void }] {
  const [state, setState] = useState<ReviewsState>({
    dailyReviews: [],
    intraReviews: [],
    isLoading: true,
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const dailyReviews = loadRecentReviews(7);
      const intraReviews = loadTodayIntraSessionReviews();
      setState({ dailyReviews, intraReviews, isLoading: false });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const reload = () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const dailyReviews = loadRecentReviews(7);
      const intraReviews = loadTodayIntraSessionReviews();
      setState({ dailyReviews, intraReviews, isLoading: false });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return [state, { reload }];
}
