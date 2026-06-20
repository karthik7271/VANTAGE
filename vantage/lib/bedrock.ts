import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

export interface ComparisonRow {
  channel: string;
  shapleyPct: number;
  lastTouchPct: number;
  linearPct: number;
  spendPct: number;
  delta: number;
}

export interface AttributionInsight {
  text: string;
  source: "bedrock" | "template";
}

const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-haiku-20241022-v1:0";

function isBedrockConfigured(): boolean {
  return Boolean(process.env.AWS_REGION);
}

function buildPrompt(comparison: ComparisonRow[], periodDays: number): string {
  const rows = comparison
    .map(
      (r) =>
        `- ${r.channel}: ${(r.spendPct * 100).toFixed(1)}% of spend, ${(r.shapleyPct * 100).toFixed(1)}% of Shapley-attributed revenue (last-touch ${(r.lastTouchPct * 100).toFixed(1)}%, linear ${(r.linearPct * 100).toFixed(1)}%), delta vs. budget ${(r.delta * 100).toFixed(1)} pts`,
    )
    .join("\n");

  return `You are a marketing analytics assistant for Vantage, a B2B multi-touch attribution platform. Below is a Shapley-value attribution comparison for the last ${periodDays} days, one row per ad channel.

${rows}

Write a concise executive insight (3-4 sentences, plain prose, no markdown, no bullet points) for a marketing director. Identify the channel most underfunded relative to its actual revenue contribution and the channel most overfunded, state the size of the gap in percentage points, and recommend a specific budget reallocation direction. Be direct and quantitative.`;
}

// Deterministic fallback used when AWS_REGION isn't configured, or when the
// Bedrock call fails — keeps the insight panel functional without AWS access,
// and ensures a transient AWS outage degrades gracefully instead of breaking
// the page.
function templateInsight(comparison: ComparisonRow[]): string {
  if (comparison.length === 0) {
    return "Not enough attribution data yet to generate an insight.";
  }
  const sorted = [...comparison].sort((a, b) => b.delta - a.delta);
  const under = sorted[0];
  const over = sorted[sorted.length - 1];

  return (
    `${under.channel} is the most underfunded channel: it receives ${(under.spendPct * 100).toFixed(1)}% of budget but drives ${(under.shapleyPct * 100).toFixed(1)}% of Shapley-attributed revenue, a gap of ${(under.delta * 100).toFixed(1)} points. ` +
    `${over.channel} is the most overfunded, earning ${(over.shapleyPct * 100).toFixed(1)}% of credit against ${(over.spendPct * 100).toFixed(1)}% of spend. ` +
    `Shifting budget from ${over.channel} toward ${under.channel} would better align spend with each channel's actual marginal contribution to revenue.`
  );
}

export async function generateAttributionInsight(
  comparison: ComparisonRow[],
  periodDays: number,
): Promise<AttributionInsight> {
  if (!isBedrockConfigured()) {
    return { text: templateInsight(comparison), source: "template" };
  }

  try {
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    const response = await client.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 300,
          messages: [
            { role: "user", content: buildPrompt(comparison, periodDays) },
          ],
        }),
      }),
    );

    const payload = JSON.parse(new TextDecoder().decode(response.body));
    const text: string | undefined = payload?.content?.[0]?.text;
    if (!text) throw new Error("Empty Bedrock response");

    return { text: text.trim(), source: "bedrock" };
  } catch {
    return { text: templateInsight(comparison), source: "template" };
  }
}
