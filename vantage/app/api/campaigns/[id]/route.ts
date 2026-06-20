import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (Number.isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const [campaign, daily, attribution] = await Promise.all([
    query<{
      id: number;
      name: string;
      channel: string;
      start_date: string;
      end_date: string;
      budget: string;
    }>(
      `SELECT id, name, channel, start_date::text, end_date::text, budget
       FROM campaigns WHERE id = $1`,
      [campaignId],
    ),
    query<{
      date: string;
      impressions: string;
      clicks: string;
      spend: string;
      conversions: string;
    }>(
      `SELECT date::text, impressions, clicks, spend, conversions
       FROM daily_stats WHERE campaign_id = $1 ORDER BY date`,
      [campaignId],
    ),
    query<{ pct_credit: string }>(
      `SELECT pct_credit FROM attribution_results
       WHERE model = 'shapley' AND period_days = 90
         AND channel = (SELECT channel FROM campaigns WHERE id = $1)`,
      [campaignId],
    ),
  ]);

  if (campaign.length === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const c = campaign[0];
  const totalSpend = daily.reduce((a, d) => a + parseFloat(d.spend), 0);
  const totalClicks = daily.reduce((a, d) => a + parseInt(d.clicks), 0);
  const totalConversions = daily.reduce((a, d) => a + parseInt(d.conversions), 0);

  return NextResponse.json({
    campaign: {
      id: c.id,
      name: c.name,
      channel: c.channel,
      startDate: c.start_date,
      endDate: c.end_date,
      budget: parseFloat(c.budget),
    },
    totals: {
      spend: totalSpend,
      clicks: totalClicks,
      conversions: totalConversions,
      avgCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
    },
    daily: daily.map((d) => ({
      date: d.date,
      impressions: parseInt(d.impressions),
      clicks: parseInt(d.clicks),
      spend: parseFloat(d.spend),
      conversions: parseInt(d.conversions),
    })),
    channelShapleyPct: attribution[0] ? parseFloat(attribution[0].pct_credit) : null,
  });
}
