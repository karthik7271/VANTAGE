<div align="center">

# Vantage

**A B2B marketing attribution platform — H0: Hack the Zero Stack submission**

[![Live Demo](https://img.shields.io/badge/demo-vantage--six--roan.vercel.app-7C3AED?style=for-the-badge)](https://vantage-six-roan.vercel.app)

</div>

This repository has two parts:

| Path | What it is |
|---|---|
| [`vantage/`](vantage/) | The Next.js application — dashboard, attribution, audiences, creatives, settings. **Start here:** [`vantage/README.md`](vantage/README.md) for screenshots, architecture, schema, and setup. |
| repo root (`schema.sql`, `seed.py`, `shapley.py`) | The Aurora PostgreSQL data pipeline — DDL, synthetic seed generator, and the Shapley-value attribution engine that powers the app. |

## Quick links

- **Live app:** [vantage-six-roan.vercel.app](https://vantage-six-roan.vercel.app) — `demo@vantage.ai` / `demo1234`
- **Full product docs:** [`vantage/README.md`](vantage/README.md)
- **Build plan:** [`plan.md`](plan.md)

## The data pipeline

```bash
pip install -r requirements.txt

# 1. Create the schema on Aurora
psql "$DATABASE_URL" -f schema.sql

# 2. Generate synthetic campaign/journey/touchpoint data
python3 seed.py

# 3. Pre-compute Shapley / last-touch / linear attribution
python3 shapley.py
```

`seed.py` and `shapley.py` both read `DATABASE_URL` from the environment. Both are idempotent enough to re-run safely — `shapley.py` upserts on `(channel, model, period_days)`.

## One-line pitch

Marketing teams run five ad platforms and none of their dashboards agree on which one actually drove revenue. Vantage computes exact Shapley values — the same game-theoretic credit-assignment model behind Google Analytics 4 — directly against Amazon Aurora PostgreSQL, and surfaces the channel your spend allocation is most wrong about.

See [`vantage/README.md`](vantage/README.md) for the full architecture, schema diagram, API reference, and screenshots.
