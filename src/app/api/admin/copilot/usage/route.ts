import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function emptySummary() {
  return {
    requests: 0,
    inputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    webSearchCalls: 0,
    estimatedCostUsd: 0,
    pricedRequests: 0,
    models: {} as Record<string, number>,
  };
}

function summarize(rows: any[]) {
  const summary = emptySummary();

  for (const row of rows) {
    const usage = row?.metadata?.usage;
    if (!usage || typeof usage !== "object") continue;

    summary.requests += 1;
    summary.inputTokens += Number(usage.input_tokens ?? 0) || 0;
    summary.cachedTokens += Number(usage.cached_tokens ?? 0) || 0;
    summary.cacheWriteTokens += Number(usage.cache_write_tokens ?? 0) || 0;
    summary.outputTokens += Number(usage.output_tokens ?? 0) || 0;
    summary.reasoningTokens += Number(usage.reasoning_tokens ?? 0) || 0;
    summary.webSearchCalls += Number(usage.web_search_calls ?? 0) || 0;

    if (usage.estimated_cost_usd != null) {
      summary.estimatedCostUsd +=
        Number(usage.estimated_cost_usd ?? 0) || 0;
      summary.pricedRequests += 1;
    }

    const model = String(usage.model || "unknown");
    summary.models[model] = (summary.models[model] ?? 0) + 1;
  }

  return summary;
}

export async function GET() {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { data, error } = await supabase
    .from("copilot_messages")
    .select("created_at,metadata,copilot_threads!inner(user_id)")
    .eq("role", "assistant")
    .eq("copilot_threads.user_id", user.id)
    .gte("created_at", since7d)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load Chaos Copilot usage.", detail: error.message },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const last24h = rows.filter(
    (row: any) => new Date(row.created_at).getTime() >= new Date(since24h).getTime(),
  );

  return NextResponse.json({
    last24h: summarize(last24h),
    last7d: summarize(rows),
    note:
      "Estimated cost uses the model pricing embedded in this Dusk build, actual token/cache usage returned by OpenAI, and $0.01 per recorded web-search call. Search-content token billing may still cause small differences from the invoice.",
  });
}
