import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchMetaCampaigns, fetchMetaInsights } from "@/lib/integrations/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json(
      {
        error:
          "Meta integration not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.",
      },
      { status: 400 },
    );
  }

  try {
    const campaigns = await fetchMetaCampaigns(accessToken, adAccountId);

    const externalToInternalId = new Map<string, number>();
    for (const c of campaigns) {
      const rows = await query<{ id: number }>(
        `
        INSERT INTO campaigns (name, channel, start_date, end_date, budget, external_id)
        VALUES ($1, 'Meta', $2, $3, $4, $5)
        ON CONFLICT (channel, external_id) WHERE external_id IS NOT NULL
        DO UPDATE SET name = EXCLUDED.name,
                      start_date = EXCLUDED.start_date,
                      end_date = EXCLUDED.end_date,
                      budget = EXCLUDED.budget
        RETURNING id
        `,
        [c.name, c.startDate, c.endDate, c.budget, c.externalId],
      );
      externalToInternalId.set(c.externalId, rows[0].id);
    }

    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const insights = await fetchMetaInsights(
      accessToken,
      adAccountId,
      isoDate(since),
      isoDate(until),
    );

    let rowsSynced = 0;
    for (const row of insights) {
      const campaignId = externalToInternalId.get(row.externalCampaignId);
      if (!campaignId) continue;
      await query(
        `
        INSERT INTO daily_stats (campaign_id, date, impressions, clicks, spend, conversions)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (campaign_id, date)
        DO UPDATE SET impressions = EXCLUDED.impressions,
                      clicks = EXCLUDED.clicks,
                      spend = EXCLUDED.spend,
                      conversions = EXCLUDED.conversions
        `,
        [campaignId, row.date, row.impressions, row.clicks, row.spend, row.conversions],
      );
      rowsSynced++;
    }

    return NextResponse.json({
      ok: true,
      campaignsSynced: campaigns.length,
      dailyStatsSynced: rowsSynced,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Meta sync failed" },
      { status: 502 },
    );
  }
}
