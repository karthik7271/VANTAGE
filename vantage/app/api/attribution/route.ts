import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") ?? "30");
  const validPeriod = [30, 60, 90].includes(period) ? period : 30;

  const [shapley, lastTouch, linear, spendByChannel] = await Promise.all([
    query<{ channel: string; pct_credit: string; total_revenue: string }>(
      `
      SELECT channel, pct_credit, total_revenue
      FROM attribution_results
      WHERE model = 'shapley' AND period_days = $1
      ORDER BY pct_credit DESC
    `,
      [validPeriod],
    ),

    query<{ channel: string; pct_credit: string }>(
      `
      SELECT channel, pct_credit
      FROM attribution_results
      WHERE model = 'last_touch' AND period_days = $1
      ORDER BY pct_credit DESC
    `,
      [validPeriod],
    ),

    query<{ channel: string; pct_credit: string }>(
      `
      SELECT channel, pct_credit
      FROM attribution_results
      WHERE model = 'linear' AND period_days = $1
      ORDER BY pct_credit DESC
    `,
      [validPeriod],
    ),

    query<{ channel: string; total_spend: string }>(
      `
      SELECT c.channel, SUM(ds.spend)::numeric(12,2) AS total_spend
      FROM daily_stats ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ds.date >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY c.channel
    `,
      [validPeriod],
    ),
  ]);

  // Build combined comparison table keyed by channel
  const spendMap = Object.fromEntries(
    spendByChannel.map((r) => [r.channel, parseFloat(r.total_spend)]),
  );
  const lastTouchMap = Object.fromEntries(
    lastTouch.map((r) => [r.channel, parseFloat(r.pct_credit)]),
  );
  const linearMap = Object.fromEntries(
    linear.map((r) => [r.channel, parseFloat(r.pct_credit)]),
  );

  const totalSpend = Object.values(spendMap).reduce((a, b) => a + b, 0);

  const comparison = shapley.map((r) => {
    const ch = r.channel;
    const shapleyPct = parseFloat(r.pct_credit);
    const spendPct = totalSpend > 0 ? (spendMap[ch] ?? 0) / totalSpend : 0;
    return {
      channel: ch,
      shapleyPct,
      lastTouchPct: lastTouchMap[ch] ?? 0,
      linearPct: linearMap[ch] ?? 0,
      spendPct,
      spend: spendMap[ch] ?? 0,
      revenue: parseFloat(r.total_revenue) * shapleyPct,
      delta: shapleyPct - spendPct,
    };
  });

  return NextResponse.json({ comparison, period: validPeriod });
}
