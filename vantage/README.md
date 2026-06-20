<div align="center">

# Vantage

**See every touchpoint. Own every decision.**

A B2B marketing intelligence platform that tells you which channel *actually* drives revenue — using Shapley-value attribution, the same game-theoretic model behind Google Analytics 4.

[![Live Demo](https://img.shields.io/badge/demo-vantage--six--roan.vercel.app-7C3AED?style=for-the-badge)](https://vantage-six-roan.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Aurora PostgreSQL](https://img.shields.io/badge/Aurora-PostgreSQL-527FFF?style=flat-square&logo=amazonaws&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=flat-square&logo=vercel)
![NextAuth](https://img.shields.io/badge/Auth-NextAuth.js-7C3AED?style=flat-square)

Built for **H0: Hack the Zero Stack with Vercel v0 and AWS Databases**

</div>

---

## The problem

A B2B marketing team runs Meta, Google Ads, LinkedIn, TikTok, and Email campaigns in parallel. Every platform's dashboard claims its own campaigns drove the conversion — last-touch attribution gives nearly all the credit to whichever channel closed the deal, even if four other channels did the work to get the buyer there. Teams routinely overfund the channel that closes and defund the channels that actually build the pipeline.

## The insight

Vantage replaces last-touch guessing with **Shapley values** — it treats each customer journey as a coalition game, computes every channel's marginal contribution across every possible ordering of touchpoints, and credits revenue accordingly.

On the live seed data, this surfaces a concrete, demo-ready "aha":

> **LinkedIn receives 19.2% of total ad spend but earns 32.5% of Shapley-attributed revenue** — a +13.3 point gap that last-touch and linear models both miss.

| Channel | Spend share | Last-touch credit | Linear credit | **Shapley credit** | vs. budget |
|---|---|---|---|---|---|
| LinkedIn | 19.2% | 35.9% | 35.2% | **32.5%** | 🟢 +13.3% |
| Google Ads | 34.9% | 19.7% | 21.6% | **21.5%** | 🔴 −13.4% |
| Meta | 27.5% | 21.6% | 19.7% | **20.8%** | 🔴 −6.7% |
| Email | 18.4% | 13.0% | 11.0% | **11.9%** | 🔴 −6.5% |
| TikTok | 0% | 9.9% | 12.5% | **13.3%** | 🟢 +13.3% |

*(Live numbers from `/api/attribution?days=30` against the seeded Aurora dataset — re-run `shapley.py` and these will change.)*

---

## Screenshots

<table>
<tr>
<td width="50%">

**Dashboard** — spend, conversions, CPC, conversion rate, and a real-time anomaly banner (CPC spikes, spend swings, conversion-rate drops vs. the prior week)

<img src="docs/screenshots/dashboard.png" width="100%">

</td>
<td width="50%">

**Attribution** — Shapley vs. last-touch vs. linear, with the undervalued-channel callout

<img src="docs/screenshots/attribution.png" width="100%">

</td>
</tr>
<tr>
<td width="50%">

**Audiences** — full CRUD segment builder backed by Aurora

<img src="docs/screenshots/audiences.png" width="100%">

</td>
<td width="50%">

**Creatives** — Kanban-style creative approval workflow

<img src="docs/screenshots/creatives.png" width="100%">

</td>
</tr>
<tr>
<td width="50%">

**Login** — NextAuth credentials provider, single demo account

<img src="docs/screenshots/login.png" width="100%">

</td>
<td width="50%">

**Settings** — connected-channel status and team

<img src="docs/screenshots/settings.png" width="100%">

</td>
</tr>
</table>

---

## Try it live

**[vantage-six-roan.vercel.app](https://vantage-six-roan.vercel.app)**

```
Email:    demo@vantage.ai
Password: demo1234
```

---

## Architecture

```mermaid
flowchart LR
    User["Browser"] -->|HTTPS| Vercel["Vercel Edge<br/>Next.js App Router"]
    Vercel -->|NextAuth.js credentials| Auth["Session cookie<br/>JWT"]
    Vercel -->|"pg (node-postgres)<br/>TLS via aws-ssl-profiles"| Aurora[("Amazon Aurora<br/>PostgreSQL Serverless v2")]
    Shapley["Python<br/>shapley.py"] -->|"writes once,<br/>pre-computed"| Aurora
    Seed["Python<br/>seed.py"] -->|"synthetic seed data"| Aurora
    Aurora -->|"campaigns, daily_stats,<br/>touchpoints, journeys"| Vercel

    style Aurora fill:#527FFF,color:#fff
    style Vercel fill:#000,color:#fff
    style Shapley fill:#3776AB,color:#fff
    style Seed fill:#3776AB,color:#fff
```

Every page is server-rendered or API-backed by direct SQL against Aurora — there is no caching layer and no mock data path in production. The Shapley computation is the one piece deliberately run out-of-band: it's `O(2^n)` per channel (trivial at n=5 channels) but there's no reason to recompute it on every page load, so `shapley.py` runs once per seed/update cycle and writes results into `attribution_results`, which the app just reads.

### Why Aurora PostgreSQL

The anomaly-detection and attribution queries lean on window functions, `FILTER`, and multi-CTE aggregation over tens of thousands of touchpoint rows — exactly the analytical workload Aurora PostgreSQL is built for, and the same engine class enterprises run this kind of pipeline on in production. Serverless v2 also means the demo database scales to zero between hackathon judging sessions instead of idling at full cost.

---

## Database schema

```mermaid
erDiagram
    campaigns ||--o{ daily_stats : "has"
    customer_journeys ||--o{ touchpoints : "has"

    campaigns {
        serial id
        text name
        text channel
        date start_date
        date end_date
        numeric budget
    }
    daily_stats {
        serial id
        int campaign_id FK
        date date
        int impressions
        int clicks
        numeric spend
        int conversions
    }
    customer_journeys {
        serial id
        timestamptz converted_at
        numeric revenue
    }
    touchpoints {
        serial id
        int journey_id FK
        text channel
        timestamptz touched_at
        int position
    }
    attribution_results {
        serial id
        text channel
        text model
        numeric pct_credit
        numeric total_revenue
        int period_days
        timestamptz computed_at
    }
    audience_segments {
        serial id
        text name
        jsonb criteria_json
        int estimated_size
        text channel
    }
    creatives {
        serial id
        text name
        text channel
        text status
        timestamptz submitted_at
        timestamptz reviewed_at
    }
```

`touchpoints` and `customer_journeys` are the only tables `shapley.py` reads from; everything it produces lands in `attribution_results`, keyed uniquely on `(channel, model, period_days)` so re-runs upsert cleanly. Full DDL: [`../schema.sql`](../schema.sql).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript | Route groups (`(dashboard)`) keep the authenticated shell separate from `/login` |
| Styling | Tailwind CSS v4 | Dark, data-dense SaaS aesthetic with minimal custom CSS |
| Charts | Recharts | Daily spend line, channel conversion bars, Shapley comparison bars |
| Auth | NextAuth.js v5 (Credentials provider) | Single demo account; `authorized` callback gates every route except `/login` |
| Database | Amazon Aurora PostgreSQL (Serverless v2) | Analytical SQL (CTEs, `FILTER`, windowing) at production scale |
| DB driver | `pg` (node-postgres) + `aws-ssl-profiles` | Real AWS RDS CA bundle for full TLS chain validation — no `rejectUnauthorized: false` anywhere |
| Attribution engine | Python (`shapley.py`) | Exact Shapley values via subset enumeration (2⁵ subsets/channel — trivial at this scale) |
| Seed data | Python (`seed.py`) | 12 campaigns, 5 channels, ~500 customer journeys, ~1,800 touchpoints, 90 days of daily stats |
| Deployment | Vercel | Edge-deployed Next.js, env-var-scoped secrets, instant rollback |

---

## API reference

All routes are gated by the NextAuth `authorized` callback — unauthenticated requests get redirected to `/login` (or `401`-equivalent via the proxy) before reaching a handler.

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | `GET`, `POST` | NextAuth.js credentials sign-in / sign-out / session / CSRF |
| `/api/dashboard/metrics` | `GET` | 30-day totals, daily spend series, conversions by channel, anomaly detection (CPC spikes, spend swings, conversion-rate drops, week-over-week) |
| `/api/attribution?days=30\|60\|90` | `GET` | Shapley vs. last-touch vs. linear comparison, spend share, revenue, delta-vs-budget per channel |
| `/api/campaigns` | `GET` | All campaigns with aggregated spend/clicks/conversions |
| `/api/campaigns/[id]` | `GET` | Single campaign drill-down |
| `/api/audiences` | `GET`, `POST`, `PATCH`, `DELETE` | Full CRUD on audience segments — the one shell page wired to real persistence |
| `/api/creatives` | `GET`, `PATCH` | Creative list + Kanban status transitions (`pending → approved/rejected → live`) |

---

## Running locally

```bash
git clone <this-repo>
cd vantage
npm install

cp .env.example .env.local
# fill in DATABASE_URL (Aurora connection string), NEXTAUTH_SECRET (openssl rand -base64 33)

npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login) and sign in with the demo credentials above.

> **Note on TLS:** `lib/db.ts` passes Aurora's real CA bundle (via the [`aws-ssl-profiles`](https://www.npmjs.com/package/aws-ssl-profiles) package) as the `ssl` option to `pg.Pool`, rather than disabling certificate verification. Aurora rejects unencrypted connections outright, and Node's default trust store doesn't include AWS's RDS root CAs — this is the correct fix for both problems at once.

### Seeding the database

From the repo root (one level up from `vantage/`):

```bash
pip install -r requirements.txt
python3 schema.sql   # or: psql "$DATABASE_URL" -f schema.sql
python3 seed.py       # generates campaigns, daily_stats, journeys, touchpoints, segments, creatives
python3 shapley.py    # computes Shapley / last-touch / linear attribution into attribution_results
```

`seed.py` and `shapley.py` both read `DATABASE_URL` from the environment — either export it or `source` the `.env.local` file before running them.

---

## Deploying

```bash
vercel link
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production   # your production URL, e.g. https://your-app.vercel.app
vercel deploy --prod
```

NextAuth v5 auto-trusts the host header on Vercel, so `NEXTAUTH_URL` isn't strictly load-bearing — but setting it explicitly avoids any ambiguity in redirect URLs.

---

## Project structure

```
vantage/
├── app/
│   ├── (dashboard)/            # authenticated route group
│   │   ├── dashboard/          # metrics + anomaly banner
│   │   ├── attribution/        # Shapley comparison + campaign drill-down
│   │   ├── audiences/          # segment CRUD
│   │   ├── creatives/          # Kanban approval workflow
│   │   ├── settings/           # connected channels (static)
│   │   └── layout.tsx          # sidebar + auth gate shell
│   ├── api/                    # route handlers (see API reference above)
│   └── login/                  # public sign-in page
├── components/                 # shared UI (Sidebar, etc.)
├── lib/
│   ├── auth.ts                 # NextAuth config
│   └── db.ts                   # pg Pool + Aurora TLS config
├── docs/screenshots/            # README screenshots
└── ...
```

```
AWS/                             # repo root — data pipeline
├── plan.md                      # full hackathon build plan
├── schema.sql                   # Aurora DDL
├── seed.py                      # synthetic data generator
├── shapley.py                   # attribution engine
├── requirements.txt
└── vantage/                     # this app
```

---

## Attribution model, in brief

For each channel *i*, the Shapley value is the average marginal contribution of *i* across every possible subset of the other channels:

```
φ(i) = Σ_{S ⊆ N\{i}}  [ |S|! (n-|S|-1)! / n! ] × [ v(S ∪ {i}) − v(S) ]
```

where `v(S)` is the total conversions/revenue attributed to journeys touched only by the channel subset `S`. With 5 channels this is `2⁵ = 32` subsets per channel — exact enumeration, no Monte Carlo approximation needed. `shapley.py` computes this directly from the `touchpoints` table for the 30/60/90-day windows and upserts into `attribution_results`, alongside last-touch (100% credit to the final touchpoint) and linear (equal credit across all touchpoints) baselines for comparison.

---

<div align="center">

Built for **H0: Hack the Zero Stack** — Track 2 (Monetizable B2B App)

</div>
