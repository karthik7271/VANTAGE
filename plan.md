# Vantage — Hackathon Build Plan

_See every touchpoint. Own every decision._

## Hackathon Context

- **Event:** H0: Hack the Zero Stack with Vercel v0 and AWS Databases
- **Deadline:** 30 Jun 2026 @ 5:30am GMT+5:30
- **Track:** Track 2 — Monetizable B2B App
- **Prize target:** First Place B2B ($10,000) + Best Technical Implementation ($2,000) + Most Impactful ($2,000)

---

## Product Overview

**Vantage** is a unified marketing intelligence and workflow platform for B2B teams. It solves four pain points in one product loop:

> Segment your audience → Run campaigns → Monitor performance → Attribute revenue → Approve next creative → Repeat

### Core Problems Solved

1. **Ad spend attribution** — Shapley-value (data-driven) multi-touch attribution across 5 channels
2. **Campaign performance monitoring** — Unified dashboard replacing 5+ separate platform dashboards
3. **Audience segmentation** — Segment builder across channels and behaviors
4. **Content approval workflows** — Creative asset pipeline replacing email chains

### Hero Demo Story — The Attribution Detective

> "I spent $50k across 4 channels last month. Which one actually drove revenue?"
> User opens dashboard → sees anomaly alert → clicks Attribution → discovers LinkedIn drove 34% of conversions despite receiving only 18% of budget → aha moment

---

## Technical Stack

| Layer              | Technology                                  |
| ------------------ | ------------------------------------------- |
| Frontend           | Next.js (scaffolded via v0.app)             |
| Deployment         | Vercel                                      |
| Database           | Amazon Aurora PostgreSQL (AWS RDS)          |
| Auth               | NextAuth.js — single hardcoded demo account |
| Attribution engine | Python (Shapley values, pre-computed)       |
| Data               | Synthetic seed data — hybrid approach       |

### Demo Credentials

- Email: `demo@vantage.ai`
- Password: `demo1234`

---

## Attribution Model

**Shapley values (data-driven attribution)** — same model used by Google Analytics 4.

- 5 channels: Meta, Google Ads, LinkedIn, TikTok, Email
- Pre-computed and stored in `attribution_results` table
- Key demo insight: LinkedIn undervalued by spend but overvalued by Shapley
- Comparison views: Shapley vs Last-touch vs Linear (toggle)
- Date ranges: Last 30 / 60 / 90 days (all pre-seeded)

### Shapley Computation Logic

```python
# For each subset S of channels:
#   compute v(S) = conversions attributed to that subset
#   Shapley(channel i) = weighted average of marginal contributions
# Store results in attribution_results table
# ~50 lines of Python, run once, results stored in DB
```

---

## Data Strategy

**Hybrid approach:** Synthetic PostgreSQL seed data + polished "Connected Channels" UI showing green badges.

### Seed Data Specs

- 90 days of campaign data
- 5 channels: Meta, Google Ads, LinkedIn, TikTok, Email
- 12 campaigns total
- ~500 customer journeys with touchpoints
- Built-in variance so attribution math produces interesting results
- LinkedIn: undervalued by spend, overvalued by Shapley — this is the demo aha moment

---

## Database Schema

```sql
-- Core campaign data
campaigns (
  id, name, channel, start_date, end_date, budget
)

-- Daily performance metrics
daily_stats (
  campaign_id, date, impressions, clicks, spend, conversions
)

-- Customer conversion paths
customer_journeys (
  id, converted_at, revenue
)

-- Individual channel touchpoints per journey
touchpoints (
  journey_id, channel, touched_at, position
)

-- Pre-computed Shapley results
attribution_results (
  channel, shapley_value, pct_credit, period
)

-- Audience segmentation (shell)
audience_segments (
  id, name, criteria_json, estimated_size, channel
)

-- Creative approval workflow (shell)
creatives (
  id, name, channel, status, submitted_at, reviewed_at
)
```

---

## Screen Map

| Route                     | Feature                                        | Status                             |
| ------------------------- | ---------------------------------------------- | ---------------------------------- |
| `/login`                  | NextAuth login screen                          | Live                               |
| `/dashboard`              | Campaign performance overview + anomaly alerts | Live                               |
| `/attribution`            | Shapley attribution breakdown + model toggle   | Live                               |
| `/attribution/[campaign]` | Campaign drill-down view                       | Live                               |
| `/audiences`              | Audience segment builder                       | UI shell                           |
| `/creatives`              | Content approval Kanban                        | Partial live (status update works) |
| `/settings`               | Connected channels + team members              | Static                             |

---

## Anomaly Detection

One SQL query comparing last 7 days vs prior 7 days CPC per channel. If delta > 30%, surface alert banner:

> "LinkedIn CPC up 47% vs last week — $2.14 → $3.15"

Costs 20 lines of SQL, adds enormous demo impact.

---

## Architecture Diagram (for submission)

```
Browser (Next.js on Vercel)
        ↓
Vercel Edge Functions (API Routes)
        ↓
Amazon Aurora PostgreSQL (AWS RDS)
        ↓
Python Shapley Engine (pre-computation script)
```

Include: AWS logo, Vercel logo, Aurora PostgreSQL logo. One clean page. Use Excalidraw or draw.io.

---

## 20-Day Build Plan

### Phase 1: Foundation (Days 1–4)

**Day 1 — Scaffold + Infrastructure**

- [ ] Create v0.app account
- [ ] Scaffold Next.js app with v0 prompt: _"B2B SaaS marketing intelligence dashboard called Vantage, dark sidebar navigation, clean professional design"_
- [ ] Deploy immediately to Vercel — capture Vercel Team ID (needed for submission)
- [ ] Provision Aurora PostgreSQL on AWS RDS
- [ ] Connect Aurora to Vercel via environment variables
- [ ] Goal: live URL exists, database connected

**Day 2 — Database Schema**

- [ ] Write and run all CREATE TABLE statements
- [ ] Verify tables exist in Aurora PostgreSQL
- [ ] Create indexes on `campaign_id`, `date`, `channel`, `journey_id`

**Day 3 — Seed Script (Python)**

- [ ] Write Python seed script generating 90 days of data
- [ ] Generate 12 campaigns across 5 channels
- [ ] Generate ~500 customer journeys with multi-channel touchpoints
- [ ] Build in LinkedIn undervaluation (18% spend, ~34% true contribution)
- [ ] Run script, verify data in DB

**Day 4 — Authentication**

- [ ] Install NextAuth.js
- [ ] Configure credentials provider with hardcoded demo account
- [ ] Build login page via v0
- [ ] Protect all routes, redirect to `/dashboard` on login

---

### Phase 2: Core Features (Days 5–10)

**Day 5 — Dashboard Screen (Live)**

- [ ] Metric cards: total spend, total conversions, avg CPC, conversion rate
- [ ] Line chart: spend over time (30-day)
- [ ] Bar chart: conversions by channel
- [ ] Anomaly alert banner (hardcoded first, then wire to query)
- [ ] Wire all cards to real PostgreSQL queries via API routes

**Day 6 — Anomaly Detection Query**

- [ ] Write SQL comparing last 7 days vs prior 7 days CPC per channel
- [ ] Surface alert banner if delta > 30%
- [ ] Format: "LinkedIn CPC up 47% vs last week — $2.14 → $3.15"

**Day 7 — Shapley Computation Engine (Python)**

- [ ] Write Shapley value computation script
- [ ] Input: `touchpoints` table
- [ ] Output: `attribution_results` table
- [ ] Pre-compute for 30 / 60 / 90 day periods
- [ ] Verify results show LinkedIn as undervalued by spend

**Day 8 — Attribution Screen (Live)**

- [ ] Horizontal bar chart: channels ranked by Shapley % credit
- [ ] Side-by-side comparison table: Shapley vs Last-touch vs Linear
- [ ] Columns: channel, spend, last-touch credit, shapley credit, delta
- [ ] Callout box: "LinkedIn receives 18% of budget but drives 34% of conversions"
- [ ] Wire to `attribution_results` table

**Day 9 — Attribution Polish**

- [ ] Date range picker (30 / 60 / 90 days)
- [ ] Tooltip explaining Shapley values for non-technical judges
- [ ] Highlight biggest undervalued channel in green
- [ ] Model toggle: switch between Shapley / Last-touch / Linear views

**Day 10 — Campaign Drill-Down**

- [ ] Click campaign on dashboard → individual channel breakdown
- [ ] Attribution filtered by `campaign_id`
- [ ] Reuses existing queries, just adds WHERE clause

---

### Phase 3: UI Shells (Days 11–14)

**Day 11 — Audience Segments Shell**

- [ ] v0 prompt: _"Audience segmentation page with table of segments showing name, size, channels, last updated. Include Create Segment button that opens modal with channel filters and behavior criteria."_
- [ ] Pull from seeded `audience_segments` table
- [ ] Create Segment modal opens but doesn't save (shell behavior)

**Day 12 — Content Approval Workflow**

- [ ] v0 prompt: _"Creative asset approval workflow with Kanban columns: Pending Review, Approved, Live, Rejected. Cards show creative name, channel, submitted date, thumbnail placeholder."_
- [ ] Pull from `creatives` table
- [ ] Approve/Reject buttons update status in DB (simple CRUD — make this actually work)

**Day 13 — Settings Screen**

- [ ] v0 prompt: _"B2B SaaS settings page with Connected Channels section showing Meta, Google Ads, LinkedIn, TikTok, Email each with green Connected badge and Last synced timestamp. Team members section with one user row."_
- [ ] Fully static — no wiring needed

**Day 14 — Global Polish Pass**

- [ ] Consistent color scheme across all screens
- [ ] Loading skeletons on data-heavy pages
- [ ] Empty states on shell pages
- [ ] Responsive layout check
- [ ] Favicon + browser tab title "Vantage"

---

### Phase 4: Submission (Days 15–20)

**Day 15 — End-to-End Testing**

- [ ] Walk through demo flow 5 times:
  1. Login → Dashboard
  2. See anomaly alert banner
  3. Click into Attribution
  4. Point out LinkedIn undervaluation aha moment
  5. Show campaign drill-down
  6. Quick tour of Audiences + Creatives + Settings
- [ ] Fix anything that breaks or looks rough
- [ ] Focus: first 90 seconds must be flawless

**Day 16 — Architecture Diagram**

- [ ] Draw diagram in Excalidraw or draw.io
- [ ] Include: Browser → Vercel Edge Functions → Aurora PostgreSQL → Python Shapley Engine
- [ ] Use official AWS + Vercel logos
- [ ] Export as PNG for submission

**Day 17 — Demo Video Script**

```
0:00–0:20  Problem: "Marketing teams are flying blind on attribution"
0:20–0:45  Login → Dashboard → anomaly alert banner
0:45–1:45  Attribution screen: Shapley explanation → LinkedIn aha moment → model toggle
1:45–2:15  Quick tour: Audiences, Creatives, Settings
2:15–2:45  Architecture diagram → Aurora PostgreSQL callout → closing pitch
```

Total: 2:45 (leaves 15s buffer under 3-minute limit)

**Day 18 — Record Demo Video**

- [ ] Use Loom or OBS (free)
- [ ] Record 3-4 takes, pick the best
- [ ] Speak slowly — judges watch at 1x speed
- [ ] Upload to YouTube (public preferred for bonus points)

**Day 19 — Bonus Content**

- [ ] Write blog post on dev.to or Medium
- [ ] Title: _"How I built a Shapley-value attribution engine on Aurora PostgreSQL in 20 days"_
- [ ] Include `#H0Hackathon` hashtag
- [ ] Publish publicly (qualifies for bonus prize)

**Day 20 — Devpost Submission**

- [ ] Text description (which AWS database + why Aurora PostgreSQL)
- [ ] YouTube demo video link
- [ ] Vercel project URL
- [ ] Vercel Team ID
- [ ] Architecture diagram screenshot
- [ ] Vercel Storage Configuration screenshot (proves Aurora usage)
- [ ] Bonus content URL
- [ ] Submit with 24 hours to spare

---

## Why This Wins

| Prize                             | Reason                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------- |
| **Track 2 First Place**           | Clear B2B ROI story, real enterprise pain, obvious $299/seat/month monetization |
| **Best Technical Implementation** | Shapley values on Aurora PostgreSQL — most entries will be CRUD apps            |
| **Most Impactful**                | Attribution is a $5B industry problem — judges immediately think "I need this"  |
| **Most Original**                 | Game-theory attribution in a hackathon is genuinely rare                        |

---

## v0 Prompts Reference

| Screen       | v0 Prompt                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App scaffold | "B2B SaaS marketing intelligence dashboard called Vantage, dark sidebar navigation, clean professional design, Next.js"                                                                                      |
| Login        | "Clean SaaS login page for Vantage, logo centered, email/password form, dark theme"                                                                                                                          |
| Dashboard    | "Marketing analytics dashboard with metric cards, line chart for spend over time, bar chart for conversions by channel, anomaly alert banner at top"                                                         |
| Attribution  | "Marketing attribution page with horizontal bar chart of channel contributions, comparison table, callout insight box, date range picker"                                                                    |
| Audiences    | "Audience segmentation page with table of segments showing name, size, channels, last updated. Include Create Segment button that opens modal with channel filters and behavior criteria"                    |
| Creatives    | "Creative asset approval workflow with Kanban columns: Pending Review, Approved, Live, Rejected. Cards show creative name, channel, submitted date, thumbnail placeholder"                                   |
| Settings     | "B2B SaaS settings page with Connected Channels section showing Meta, Google Ads, LinkedIn, TikTok, Email each with green Connected badge and Last synced timestamp. Team members section with one user row" |

---

## Key Demo Talking Points

1. **The problem:** "Marketers spend millions across 5 platforms and can't tell which one actually drives revenue"
2. **The insight:** "Last-touch attribution gives 100% credit to Google Ads. Shapley values reveal LinkedIn drove 34% of conversions while only getting 18% of budget"
3. **The database choice:** "Aurora PostgreSQL handles complex analytical queries — windowing functions, aggregations across 90 days of event data — that power real-time attribution"
4. **The scale story:** "This architecture can handle millions of touchpoints. Aurora PostgreSQL was chosen because it's the same database foundation enterprises use in production"
5. **The monetization:** "Vantage targets mid-market B2B marketing teams at $299/seat/month — the same teams currently paying for 5 separate tools that don't talk to each other"
