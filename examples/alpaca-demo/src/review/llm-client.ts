/**
 * LLM Client — Claude API wrapper for daily reviews
 *
 * Uses @anthropic-ai/sdk to call Claude for strategy recommendations.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  buildIntraSessionSystemPrompt,
  buildIntraSessionUserMessage,
} from "./intra-session-prompt.js";
import {
  type UserMessageOptions,
  buildSystemPrompt,
  buildUserMessage,
  parseLLMResponse,
} from "./llm-prompt.js";
import type { DailyReport, IntraSessionReport, LLMRecommendation, ReviewRecord } from "./types.js";

const MODEL = "claude-sonnet-4-20250514";
const INTRA_SESSION_MODEL = process.env.INTRA_SESSION_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;
const INTRA_SESSION_MAX_TOKENS = 2048;

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

/**
 * Call Claude API for intra-session tactical review (uses Haiku for speed/cost)
 */
export async function reviewIntraSession(
  report: IntraSessionReport,
  opts?: LLMClientOptions,
): Promise<LLMRecommendation> {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Set it in .env or pass via --api-key.");
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildIntraSessionSystemPrompt();
  const userMessage = buildIntraSessionUserMessage(report);
  const maxRetries = opts?.maxRetries ?? 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: INTRA_SESSION_MODEL,
        max_tokens: INTRA_SESSION_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseLLMResponse(text);
      if (!parsed) {
        lastError = new Error(
          `Failed to parse intra-session LLM response (attempt ${attempt + 1})`,
        );
        continue;
      }

      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Intra-session LLM review failed");
}
