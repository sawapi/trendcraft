/**
 * LLM Client — Claude API wrapper for daily reviews
 *
 * Uses @anthropic-ai/sdk to call Claude for strategy recommendations.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  type UserMessageOptions,
  buildSystemPrompt,
  buildUserMessage,
  parseLLMResponse,
} from "./llm-prompt.js";
import type { DailyReport, LLMRecommendation, ReviewRecord } from "./types.js";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

export type LLMClientOptions = {
  apiKey?: string;
  maxRetries?: number;
  userMessageOptions?: UserMessageOptions;
};

/**
 * Call Claude API to review daily performance and get recommendations
 */
export async function reviewWithLLM(
  report: DailyReport,
  history: ReviewRecord[],
  opts?: LLMClientOptions,
): Promise<LLMRecommendation> {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Set it in .env or pass via --api-key.");
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(report, history, opts?.userMessageOptions);
  const maxRetries = opts?.maxRetries ?? 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseLLMResponse(text);
      if (!parsed) {
        lastError = new Error(`Failed to parse LLM response (attempt ${attempt + 1})`);
        continue;
      }

      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("LLM review failed");
}
