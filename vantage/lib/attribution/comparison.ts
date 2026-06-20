import { query } from "@/lib/db";

export interface ComparisonRow {
  channel: string;
  shapleyPct: number;
  lastTouchPct: number;
  linearPct: number;
  spendPct: number;
  spend: number;
  revenue: number;
  delta: number;
}

export async function getAttributionComparison(
  periodDays: number,
): Promise<ComparisonRow[]> {
  const [shapley, lastTouch, linear, spendByChannel] = await Promise.all([
    query<{ channel: string; pct_credit: string; total_revenue: string }>(
      `
      SELECT channel, pct_credit, total_revenue
      FROM attribution_results
      WHERE model = 'shapley' AND period_days = $1
      ORDER BY pct_credit DESC
    `,
      [periodDays],
    ),

    query<{ channel: string; pct_credit: string }>(
      `
      SELECT channel, pct_credit
      FROM attribution_results
      WHERE model = 'last_touch' AND period_days = $1
      ORDER BY pct_credit DESC
    `,
      [periodDays],
    ),

    query<{ channel: string; pct_credit: string }>(
      `
      SELECT channel, pct_credit
      FROM attribution_results
      WHERE model = 'linear' AND period_days = $1
      ORDER BY pct_credit DESC
    `,
      [periodDays],
    ),

    query<{ channel: string; total_spend: string }>(
      `
      SELECT c.channel, SUM(ds.spend)::numeric(12,2) AS total_spend
      FROM daily_stats ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ds.date >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY c.channel
    `,
      [periodDays],
    ),
  ]);

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

  return shapley.map((r) => {
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
}
