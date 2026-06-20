import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const [totals, spendByDay, convByChannel, anomalies] = await Promise.all([
    // Summary metrics — last 30 days
    query<{
      total_spend: string;
      total_conversions: string;
      total_clicks: string;
    }>(`
      SELECT
        SUM(spend)::numeric(12,2) AS total_spend,
        SUM(conversions) AS total_conversions,
        SUM(clicks) AS total_clicks
      FROM daily_stats
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `),

    // Spend per day — last 30 days
    query<{ date: string; spend: string }>(`
      SELECT date::text, SUM(spend)::numeric(10,2) AS spend
      FROM daily_stats
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date
    `),

    // Conversions by channel — last 30 days
    query<{ channel: string; conversions: string }>(`
      SELECT c.channel, SUM(ds.conversions) AS conversions
      FROM daily_stats ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ds.date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.channel
      ORDER BY conversions DESC
    `),

    // Anomaly detection: CPC spikes, spend swings, and conversion-rate drops vs prior week
    query<{
      channel: string;
      type: "cpc" | "spend" | "conversion_rate";
      current_value: string;
      prior_value: string;
      pct_change: string;
    }>(`
      WITH weekly AS (
        SELECT
          c.channel,
          CASE
            WHEN ds.date >= CURRENT_DATE - INTERVAL '7 days' THEN 'current'
            ELSE 'prior'
          END AS period,
          SUM(ds.spend) AS spend,
          SUM(ds.clicks) AS clicks,
          SUM(ds.conversions) AS conversions
        FROM daily_stats ds
        JOIN campaigns c ON c.id = ds.campaign_id
        WHERE ds.date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY c.channel, period
      ),
      pivoted AS (
        SELECT
          channel,
          MAX(spend) FILTER (WHERE period = 'current') AS cur_spend,
          MAX(spend) FILTER (WHERE period = 'prior') AS pri_spend,
          MAX(clicks) FILTER (WHERE period = 'current') AS cur_clicks,
          MAX(clicks) FILTER (WHERE period = 'prior') AS pri_clicks,
          MAX(conversions) FILTER (WHERE period = 'current') AS cur_conv,
          MAX(conversions) FILTER (WHERE period = 'prior') AS pri_conv
        FROM weekly
        GROUP BY channel
      )
      SELECT channel, 'cpc' AS type,
        (cur_spend / NULLIF(cur_clicks, 0))::numeric(6,2) AS current_value,
        (pri_spend / NULLIF(pri_clicks, 0))::numeric(6,2) AS prior_value,
        ROUND(
          ((cur_spend / NULLIF(cur_clicks, 0)) - (pri_spend / NULLIF(pri_clicks, 0)))
          / NULLIF((pri_spend / NULLIF(pri_clicks, 0)), 0) * 100, 1
        ) AS pct_change
      FROM pivoted
      WHERE pri_clicks > 0 AND cur_clicks > 0
        AND ((cur_spend / NULLIF(cur_clicks, 0)) - (pri_spend / NULLIF(pri_clicks, 0)))
            / NULLIF((pri_spend / NULLIF(pri_clicks, 0)), 0) > 0.30

      UNION ALL

      SELECT channel, 'spend' AS type,
        cur_spend::numeric(10,2) AS current_value,
        pri_spend::numeric(10,2) AS prior_value,
        ROUND((cur_spend - pri_spend) / NULLIF(pri_spend, 0) * 100, 1) AS pct_change
      FROM pivoted
      WHERE pri_spend > 0
        AND ABS(cur_spend - pri_spend) / NULLIF(pri_spend, 0) > 0.40

      UNION ALL

      SELECT channel, 'conversion_rate' AS type,
        ROUND((cur_conv::numeric / NULLIF(cur_clicks, 0)) * 100, 2) AS current_value,
        ROUND((pri_conv::numeric / NULLIF(pri_clicks, 0)) * 100, 2) AS prior_value,
        ROUND(
          ((cur_conv::numeric / NULLIF(cur_clicks, 0)) - (pri_conv::numeric / NULLIF(pri_clicks, 0)))
          / NULLIF((pri_conv::numeric / NULLIF(pri_clicks, 0)), 0) * 100, 1
        ) AS pct_change
      FROM pivoted
      WHERE pri_clicks > 0 AND cur_clicks > 0 AND pri_conv > 0
        AND ((cur_conv::numeric / NULLIF(cur_clicks, 0)) - (pri_conv::numeric / NULLIF(pri_clicks, 0)))
            / NULLIF((pri_conv::numeric / NULLIF(pri_clicks, 0)), 0) < -0.30

      ORDER BY type, pct_change DESC
    `),
  ]);

  const t = totals[0] ?? {};
  const totalSpend = parseFloat(t.total_spend ?? "0");
  const totalClicks = parseInt(t.total_clicks ?? "0");
  const totalConversions = parseInt(t.total_conversions ?? "0");
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  return NextResponse.json({
    metrics: {
      totalSpend,
      totalConversions,
      avgCPC: parseFloat(avgCPC.toFixed(2)),
      convRate: parseFloat(convRate.toFixed(2)),
    },
    spendByDay: spendByDay.map((r) => ({
      date: r.date,
      spend: parseFloat(r.spend),
    })),
    convByChannel: convByChannel.map((r) => ({
      channel: r.channel,
      conversions: parseInt(r.conversions),
    })),
    anomalies: anomalies.map((r) => ({
      channel: r.channel,
      type: r.type,
      currentValue: parseFloat(r.current_value),
      priorValue: parseFloat(r.prior_value),
      pctChange: parseFloat(r.pct_change),
    })),
  });
}
