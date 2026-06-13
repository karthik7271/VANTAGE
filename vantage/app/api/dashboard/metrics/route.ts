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

    // Anomaly detection: channels where CPC rose >30% vs prior week
    query<{
      channel: string;
      current_cpc: string;
      prior_cpc: string;
      pct_change: string;
    }>(`
      WITH current_week AS (
        SELECT c.channel,
               SUM(ds.spend) AS spend,
               SUM(ds.clicks) AS clicks
        FROM daily_stats ds
        JOIN campaigns c ON c.id = ds.campaign_id
        WHERE ds.date >= CURRENT_DATE - INTERVAL '7 days'
          AND ds.clicks > 0
        GROUP BY c.channel
      ),
      prior_week AS (
        SELECT c.channel,
               SUM(ds.spend) AS spend,
               SUM(ds.clicks) AS clicks
        FROM daily_stats ds
        JOIN campaigns c ON c.id = ds.campaign_id
        WHERE ds.date >= CURRENT_DATE - INTERVAL '14 days'
          AND ds.date < CURRENT_DATE - INTERVAL '7 days'
          AND ds.clicks > 0
        GROUP BY c.channel
      )
      SELECT
        cw.channel,
        (cw.spend / NULLIF(cw.clicks, 0))::numeric(6,2) AS current_cpc,
        (pw.spend / NULLIF(pw.clicks, 0))::numeric(6,2) AS prior_cpc,
        ROUND(
          ((cw.spend / NULLIF(cw.clicks, 0)) - (pw.spend / NULLIF(pw.clicks, 0)))
          / NULLIF((pw.spend / NULLIF(pw.clicks, 0)), 0) * 100, 1
        ) AS pct_change
      FROM current_week cw
      JOIN prior_week pw ON pw.channel = cw.channel
      WHERE ((cw.spend / NULLIF(cw.clicks, 0)) - (pw.spend / NULLIF(pw.clicks, 0)))
            / NULLIF((pw.spend / NULLIF(pw.clicks, 0)), 0) > 0.30
      ORDER BY pct_change DESC
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
      currentCPC: parseFloat(r.current_cpc),
      priorCPC: parseFloat(r.prior_cpc),
      pctChange: parseFloat(r.pct_change),
    })),
  });
}
