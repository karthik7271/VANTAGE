import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  computeShapley,
  lastTouchAttribution,
  linearAttribution,
  type Journey,
} from "@/lib/attribution/shapley";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERIODS = [30, 60, 90] as const;

async function fetchChannels(): Promise<string[]> {
  const rows = await query<{ channel: string }>(
    `SELECT DISTINCT channel FROM touchpoints ORDER BY channel`,
  );
  return rows.map((r) => r.channel);
}

async function fetchJourneys(periodDays: number): Promise<Journey[]> {
  const rows = await query<{
    revenue: string;
    channels: string[];
  }>(
    `
    SELECT cj.revenue, array_agg(t.channel ORDER BY t.position) AS channels
    FROM customer_journeys cj
    JOIN touchpoints t ON t.journey_id = cj.id
    WHERE cj.converted_at >= NOW() - ($1 || ' days')::interval
    GROUP BY cj.id, cj.revenue
    `,
    [periodDays],
  );
  return rows.map((r) => ({ revenue: parseFloat(r.revenue), channels: r.channels }));
}

async function upsertResults(
  model: "shapley" | "last_touch" | "linear",
  values: Record<string, number>,
  totalRevenue: number,
  periodDays: number,
) {
  for (const [channel, value] of Object.entries(values)) {
    const pct = totalRevenue > 0 ? value / totalRevenue : 0;
    await query(
      `
      INSERT INTO attribution_results (channel, model, pct_credit, total_revenue, period_days, computed_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (channel, model, period_days)
      DO UPDATE SET pct_credit = EXCLUDED.pct_credit,
                    total_revenue = EXCLUDED.total_revenue,
                    computed_at = EXCLUDED.computed_at
      `,
      [channel, model, Number(pct.toFixed(6)), Number(totalRevenue.toFixed(2)), periodDays],
    );
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const channels = await fetchChannels();
  const periodResults: Record<number, { journeys: number; method: string }> = {};

  for (const periodDays of PERIODS) {
    const journeys = await fetchJourneys(periodDays);
    if (journeys.length === 0 || channels.length === 0) {
      periodResults[periodDays] = { journeys: journeys.length, method: "skipped" };
      continue;
    }

    const totalRevenue = journeys.reduce((sum, j) => sum + j.revenue, 0);

    const { values: shapleyValues, method } = computeShapley(channels, journeys);
    await upsertResults("shapley", shapleyValues, totalRevenue, periodDays);
    await upsertResults("last_touch", lastTouchAttribution(journeys), totalRevenue, periodDays);
    await upsertResults("linear", linearAttribution(journeys), totalRevenue, periodDays);

    periodResults[periodDays] = { journeys: journeys.length, method };
  }

  // Non-blocking refresh of the dashboard rollup — CONCURRENTLY requires the
  // unique index defined alongside the view in schema.sql.
  try {
    await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY channel_daily_rollup`);
  } catch {
    await query(`REFRESH MATERIALIZED VIEW channel_daily_rollup`);
  }

  return NextResponse.json({
    ok: true,
    channels: channels.length,
    periods: periodResults,
    durationMs: Date.now() - startedAt,
  });
}
