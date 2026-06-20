/**
 * Meta Marketing API connector.
 *
 * Reads live campaign + insights data from an advertiser's own ad account
 * using a long-lived System User access token (Business Manager -> System
 * Users -> generate token with ads_read). Reading your own ad account's
 * data this way does not require Meta App Review — that's only needed for
 * apps acting on behalf of *other* businesses.
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaCampaign {
  externalId: string;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
}

export interface MetaDailyInsight {
  externalCampaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

class MetaApiError extends Error {}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw new MetaApiError(
      body?.error?.message ?? `Meta Graph API error (${res.status})`,
    );
  }
  return body as T;
}

export async function fetchMetaCampaigns(
  accessToken: string,
  adAccountId: string,
): Promise<MetaCampaign[]> {
  const data = await graphGet<{
    data: Array<{
      id: string;
      name: string;
      start_time?: string;
      stop_time?: string;
      daily_budget?: string;
      lifetime_budget?: string;
    }>;
  }>(`act_${adAccountId}/campaigns`, {
    fields: "id,name,start_time,stop_time,daily_budget,lifetime_budget",
    access_token: accessToken,
    limit: "200",
  });

  return data.data.map((c) => {
    const budgetCents = c.lifetime_budget ?? c.daily_budget;
    return {
      externalId: c.id,
      name: c.name,
      startDate: (c.start_time ?? new Date().toISOString()).slice(0, 10),
      endDate: (c.stop_time ?? "2099-12-31T00:00:00Z").slice(0, 10),
      budget: budgetCents ? Number(budgetCents) / 100 : 0,
    };
  });
}

export async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  sinceDate: string,
  untilDate: string,
): Promise<MetaDailyInsight[]> {
  const data = await graphGet<{
    data: Array<{
      campaign_id: string;
      date_start: string;
      impressions: string;
      clicks: string;
      spend: string;
      actions?: Array<{ action_type: string; value: string }>;
    }>;
  }>(`act_${adAccountId}/insights`, {
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
    fields: "campaign_id,date_start,impressions,clicks,spend,actions",
    access_token: accessToken,
    limit: "500",
  });

  return data.data.map((row) => ({
    externalCampaignId: row.campaign_id,
    date: row.date_start,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    spend: Number(row.spend ?? 0),
    conversions: (row.actions ?? []).reduce(
      (sum, a) => sum + Number(a.value ?? 0),
      0,
    ),
  }));
}
