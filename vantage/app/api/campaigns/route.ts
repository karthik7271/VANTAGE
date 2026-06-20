import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const campaigns = await query<{
    id: number;
    name: string;
    channel: string;
    budget: string;
    spend: string;
    clicks: string;
    conversions: string;
  }>(`
    SELECT c.id, c.name, c.channel, c.budget,
           COALESCE(SUM(ds.spend), 0)::numeric(12,2) AS spend,
           COALESCE(SUM(ds.clicks), 0) AS clicks,
           COALESCE(SUM(ds.conversions), 0) AS conversions
    FROM campaigns c
    LEFT JOIN daily_stats ds ON ds.campaign_id = c.id
    GROUP BY c.id, c.name, c.channel, c.budget
    ORDER BY spend DESC
  `);

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      budget: parseFloat(c.budget),
      spend: parseFloat(c.spend),
      clicks: parseInt(c.clicks),
      conversions: parseInt(c.conversions),
    })),
  });
}
