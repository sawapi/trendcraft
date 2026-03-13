/**
 * ReviewView — display review history and trigger manual reviews
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import { KeyHint } from "../components/KeyHint.js";
import type { ReviewsState } from "../hooks/useReviews.js";

type ReviewViewProps = {
  reviews: ReviewsState;
  onReload: () => void;
  onRunReview: (opts: { apply: boolean }) => Promise<void>;
};

export function ReviewView({
  reviews,
  onReload,
  onRunReview,
}: ReviewViewProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (reviews.isReviewing) return; // Disable navigation during review

    if (input === "r") {
      onReload();
    }
    if (input === "e") {
      onRunReview({ apply: false });
    }
    if (input === "E") {
      onRunReview({ apply: true });
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(reviews.dailyReviews.length - 1, prev + 1));
    }
  });

  const selected = reviews.dailyReviews[selectedIndex];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Review History{" "}
        </Text>
      </Box>

      {reviews.isReviewing && (
        <Box marginBottom={1}>
          <Text color="yellow" bold>
            Running LLM review...
          </Text>
        </Box>
      )}

      {reviews.isLoading && <Text color="yellow">Loading reviews...</Text>}

      {!reviews.isLoading && reviews.dailyReviews.length === 0 && !reviews.isReviewing && (
        <Text color="gray">No review records found.</Text>
      )}

      {/* Daily review list */}
      {reviews.dailyReviews.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {reviews.dailyReviews.map((review, i) => {
            const appliedCount = review.appliedActions?.length ?? 0;
            const rejectedCount = review.rejectedActions?.length ?? 0;
            const isSelected = i === selectedIndex;

            return (
              <Box key={review.date}>
                <Text color={isSelected ? "cyan" : "white"}>
                  {isSelected ? "> " : "  "}
                  {review.date} — Applied: {appliedCount}, Rejected: {rejectedCount}
                  {review.llmResponse?.summary
                    ? ` — ${review.llmResponse.summary.slice(0, 60)}...`
                    : ""}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Selected review detail */}
      {selected && (
        <Box
          flexDirection="column"
          marginBottom={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>Review: {selected.date}</Text>
          {selected.llmResponse && (
            <>
              <Text color="green">Summary: {selected.llmResponse.summary}</Text>
              {selected.llmResponse.marketAnalysis && (
                <Text color="gray">Market: {selected.llmResponse.marketAnalysis}</Text>
              )}
              <Text>Actions proposed: {selected.llmResponse.actions.length}</Text>
              {selected.llmResponse.actions.map((action, i) => (
                <Text key={i} color="yellow">
                  {"  "}[{action.action}] {action.reasoning}
                </Text>
              ))}
            </>
          )}
        </Box>
      )}

      {/* Intra-session reviews */}
      {reviews.intraReviews.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            {" "}
            Today's Intra-Session Reviews{" "}
          </Text>
          {reviews.intraReviews.map((review) => (
            <Box key={review.reviewNumber}>
              <Text>
                {"  "}#{review.reviewNumber} — {new Date(review.timestamp).toLocaleTimeString()}{" "}
                Applied: {review.appliedActions.length}, Rejected: {review.rejectedActions.length}
                {review.llmResponse?.summary ? ` — ${review.llmResponse.summary.slice(0, 50)}` : ""}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <KeyHint
          hints={
            reviews.isReviewing
              ? [{ key: "...", action: "Review in progress" }]
              : [
                  { key: "e", action: "Run review (preview)" },
                  { key: "E", action: "Run review + apply" },
                  { key: "r", action: "Reload" },
                  { key: "Up/Down", action: "Navigate" },
                ]
          }
        />
      </Box>
    </Box>
  );
}
