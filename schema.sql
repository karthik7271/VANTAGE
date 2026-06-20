-- Vantage — Aurora PostgreSQL Schema

CREATE TABLE IF NOT EXISTS campaigns (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('Meta', 'Google Ads', 'LinkedIn', 'TikTok', 'Email')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  budget       NUMERIC(12, 2) NOT NULL
);

-- Platform-native campaign ID (e.g. Meta's campaign_id), set by real ad
-- platform sync jobs so re-syncing upserts instead of duplicating. NULL for
-- synthetic/seeded campaigns. ADD COLUMN IF NOT EXISTS (rather than inlining
-- it above) so re-running this file against an already-deployed database
-- upgrades it instead of being skipped by CREATE TABLE IF NOT EXISTS.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_channel_external_id
  ON campaigns(channel, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS daily_stats (
  id           SERIAL PRIMARY KEY,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  impressions  INTEGER NOT NULL DEFAULT 0,
  clicks       INTEGER NOT NULL DEFAULT 0,
  spend        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  conversions  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (campaign_id, date)
);

CREATE TABLE IF NOT EXISTS customer_journeys (
  id            SERIAL PRIMARY KEY,
  converted_at  TIMESTAMPTZ NOT NULL,
  revenue       NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS touchpoints (
  id          SERIAL PRIMARY KEY,
  journey_id  INTEGER NOT NULL REFERENCES customer_journeys(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('Meta', 'Google Ads', 'LinkedIn', 'TikTok', 'Email')),
  touched_at  TIMESTAMPTZ NOT NULL,
  position    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attribution_results (
  id             SERIAL PRIMARY KEY,
  channel        TEXT NOT NULL,
  model          TEXT NOT NULL CHECK (model IN ('shapley', 'last_touch', 'linear')),
  pct_credit     NUMERIC(6, 4) NOT NULL,
  total_revenue  NUMERIC(12, 2) NOT NULL,
  period_days    INTEGER NOT NULL CHECK (period_days IN (30, 60, 90)),
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, model, period_days)
);

CREATE TABLE IF NOT EXISTS audience_segments (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  criteria_json   JSONB NOT NULL DEFAULT '{}',
  estimated_size  INTEGER NOT NULL DEFAULT 0,
  channel         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creatives (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('Meta', 'Google Ads', 'LinkedIn', 'TikTok', 'Email')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'live', 'rejected')),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_stats_campaign_id ON daily_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_touchpoints_journey_id ON touchpoints(journey_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_channel ON touchpoints(channel);
CREATE INDEX IF NOT EXISTS idx_touchpoints_touched_at ON touchpoints(touched_at);
CREATE INDEX IF NOT EXISTS idx_customer_journeys_converted_at ON customer_journeys(converted_at);
CREATE INDEX IF NOT EXISTS idx_attribution_results_period ON attribution_results(period_days, model);

-- Pre-aggregated channel x day rollup. daily_stats joined to campaigns is the
-- hottest query on the dashboard (run on every page load); at low-thousands of
-- rows the live JOIN+GROUP BY is fine, but it degrades linearly with
-- touchpoint/campaign volume. This view lets that query become a flat scan
-- instead, and is refreshed out-of-band by the attribution cron job rather
-- than recomputed per request.
CREATE MATERIALIZED VIEW IF NOT EXISTS channel_daily_rollup AS
SELECT
  c.channel,
  ds.date,
  SUM(ds.impressions) AS impressions,
  SUM(ds.clicks)       AS clicks,
  SUM(ds.spend)        AS spend,
  SUM(ds.conversions)  AS conversions
FROM daily_stats ds
JOIN campaigns c ON c.id = ds.campaign_id
GROUP BY c.channel, ds.date;

-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index on the view
-- so refreshes don't block concurrent dashboard reads.
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_daily_rollup_channel_date
  ON channel_daily_rollup(channel, date);
