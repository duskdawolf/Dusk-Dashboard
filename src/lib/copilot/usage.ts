export type CopilotUsageSnapshot = {
  model: string;
  inputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  webSearchCalls: number;
  estimatedCostUsd: number | null;
};

const MODEL_PRICING_USD_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.6-sol": { input: 4, output: 20 },
  "gpt-5.6": { input: 4, output: 20 },
};

function numeric(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function normalizeCopilotUsage(
  response: any,
  model: string,
  extras: { webSearchCalls?: number } = {},
): CopilotUsageSnapshot {
  const usage = response?.usage ?? {};
  const inputDetails = usage?.input_tokens_details ?? {};
  const outputDetails = usage?.output_tokens_details ?? {};

  const inputTokens = numeric(usage.input_tokens);
  const cachedTokens = numeric(inputDetails.cached_tokens);
  const cacheWriteTokens = numeric(inputDetails.cache_write_tokens);
  const outputTokens = numeric(usage.output_tokens);
  const reasoningTokens = numeric(outputDetails.reasoning_tokens);
  const webSearchCalls = numeric(extras.webSearchCalls);

  const pricing = MODEL_PRICING_USD_PER_MILLION[model];
  let estimatedCostUsd: number | null = null;

  if (pricing) {
    const ordinaryInputTokens = Math.max(
      0,
      inputTokens - cachedTokens - cacheWriteTokens,
    );

    const weightedInputTokens =
      ordinaryInputTokens +
      cachedTokens * 0.1 +
      cacheWriteTokens * 1.25;

    estimatedCostUsd =
      (weightedInputTokens * pricing.input) / 1_000_000 +
      (outputTokens * pricing.output) / 1_000_000 +
      webSearchCalls * 0.01;
  }

  return {
    model,
    inputTokens,
    cachedTokens,
    cacheWriteTokens,
    outputTokens,
    reasoningTokens,
    webSearchCalls,
    estimatedCostUsd,
  };
}

export function copilotUsageMetadata(usage: CopilotUsageSnapshot) {
  return {
    model: usage.model,
    input_tokens: usage.inputTokens,
    cached_tokens: usage.cachedTokens,
    cache_write_tokens: usage.cacheWriteTokens,
    output_tokens: usage.outputTokens,
    reasoning_tokens: usage.reasoningTokens,
    web_search_calls: usage.webSearchCalls,
    estimated_cost_usd: usage.estimatedCostUsd,
  };
}
