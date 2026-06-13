"""
Vantage — Seed script for Aurora PostgreSQL
Generates 90 days of synthetic marketing data.
LinkedIn is intentionally undervalued by spend (~18%) but high-contribution by Shapley (~34%).
"""

import os
import random
import psycopg2
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

CHANNELS = ["Meta", "Google Ads", "LinkedIn", "TikTok", "Email"]

# Budget distribution: LinkedIn gets less spend but drives more conversions
CHANNEL_BUDGET_SHARE = {
    "Meta": 0.30,
    "Google Ads": 0.28,
    "LinkedIn": 0.18,
    "TikTok": 0.14,
    "Email": 0.10,
}

# True conversion influence (used to bias touchpoint generation)
CHANNEL_INFLUENCE = {
    "Meta": 0.22,
    "Google Ads": 0.20,
    "LinkedIn": 0.34,
    "TikTok": 0.12,
    "Email": 0.12,
}

CAMPAIGNS = [
    ("Q2 Brand Awareness", "Meta", 90),
    ("Performance Max Spring", "Google Ads", 90),
    ("Enterprise Outreach", "LinkedIn", 90),
    ("Creator Campaign", "TikTok", 60),
    ("Newsletter Re-engage", "Email", 90),
    ("Retargeting Blitz", "Meta", 45),
    ("Branded Search", "Google Ads", 90),
    ("Decision Maker Push", "LinkedIn", 60),
    ("Viral Short-form", "TikTok", 30),
    ("Onboarding Drip", "Email", 90),
    ("Lookalike Expansion", "Meta", 75),
    ("Competitor Keywords", "Google Ads", 60),
]

TOTAL_MONTHLY_BUDGET = 55000


def weighted_choice(choices: dict) -> str:
    total = sum(choices.values())
    r = random.random() * total
    cumulative = 0
    for key, weight in choices.items():
        cumulative += weight
        if r <= cumulative:
            return key
    return list(choices.keys())[-1]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=90)

    print("Inserting campaigns...")
    campaign_ids = {}
    for name, channel, duration_days in CAMPAIGNS:
        camp_start = start_date + timedelta(days=random.randint(0, 5))
        camp_end = camp_start + timedelta(days=duration_days)
        budget = TOTAL_MONTHLY_BUDGET * 3 * CHANNEL_BUDGET_SHARE[channel] / len(
            [c for c in CAMPAIGNS if c[1] == channel]
        )
        cur.execute(
            """
            INSERT INTO campaigns (name, channel, start_date, end_date, budget)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
            """,
            (name, channel, camp_start, min(camp_end, today), round(budget, 2)),
        )
        campaign_ids[name] = cur.fetchone()[0]

    conn.commit()

    print("Inserting daily stats...")
    for name, channel, _ in CAMPAIGNS:
        cid = campaign_ids[name]
        cur.execute("SELECT start_date, end_date, budget FROM campaigns WHERE id = %s", (cid,))
        row = cur.fetchone()
        camp_start_date, camp_end_date, budget = row

        num_days = (camp_end_date - camp_start_date).days + 1
        daily_budget = float(budget) / max(num_days, 1)

        cpc_base = {"Meta": 1.80, "Google Ads": 2.50, "LinkedIn": 5.20, "TikTok": 1.20, "Email": 0.15}[channel]
        ctr_base = {"Meta": 0.025, "Google Ads": 0.035, "LinkedIn": 0.018, "TikTok": 0.040, "Email": 0.085}[channel]
        cvr_base = {"Meta": 0.025, "Google Ads": 0.030, "LinkedIn": 0.055, "TikTok": 0.015, "Email": 0.070}[channel]

        d = camp_start_date
        while d <= camp_end_date:
            # Add weekly seasonality + some noise
            weekday_factor = 1.2 if d.weekday() < 5 else 0.6
            noise = random.uniform(0.75, 1.35)
            spend = daily_budget * weekday_factor * noise
            cpc = cpc_base * random.uniform(0.85, 1.25)
            clicks = int(spend / cpc)
            impressions = int(clicks / (ctr_base * random.uniform(0.8, 1.2)))
            conversions = int(clicks * cvr_base * random.uniform(0.7, 1.4))

            cur.execute(
                """
                INSERT INTO daily_stats (campaign_id, date, impressions, clicks, spend, conversions)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (campaign_id, date) DO NOTHING
                """,
                (cid, d, max(impressions, 0), max(clicks, 0), round(spend, 2), max(conversions, 0)),
            )
            d += timedelta(days=1)

    conn.commit()

    print("Inserting customer journeys and touchpoints...")
    num_journeys = 520
    for _ in range(num_journeys):
        converted_at = datetime.now(timezone.utc) - timedelta(
            days=random.uniform(0, 90), hours=random.uniform(0, 24)
        )
        revenue = round(random.uniform(200, 4500), 2)

        cur.execute(
            "INSERT INTO customer_journeys (converted_at, revenue) VALUES (%s, %s) RETURNING id",
            (converted_at, revenue),
        )
        journey_id = cur.fetchone()[0]

        # 2-5 touchpoints per journey, biased by influence weights
        num_touches = random.randint(2, 5)
        chosen_channels = []
        for _ in range(num_touches):
            chosen_channels.append(weighted_choice(CHANNEL_INFLUENCE))

        for pos, ch in enumerate(chosen_channels):
            touched_at = converted_at - timedelta(days=random.uniform(0, 21))
            cur.execute(
                """
                INSERT INTO touchpoints (journey_id, channel, touched_at, position)
                VALUES (%s, %s, %s, %s)
                """,
                (journey_id, ch, touched_at, pos + 1),
            )

    conn.commit()

    print("Inserting audience segments...")
    segments = [
        ("Enterprise Decision Makers", '{"industry": "technology", "seniority": ["VP", "C-Suite"], "company_size": "500+"}', 12400, "LinkedIn"),
        ("Mid-Market Finance", '{"industry": "finance", "seniority": ["Director", "Manager"], "company_size": "100-500"}', 34200, "Google Ads"),
        ("SMB Retargeting Pool", '{"behavior": "visited_pricing", "days_since_visit": 7}', 8900, "Meta"),
        ("Email Engaged 90d", '{"email_opens_gte": 3, "last_open_days": 90}', 22100, "Email"),
        ("TikTok Brand Awareness", '{"age_range": "25-44", "interest": "marketing_software"}', 189000, "TikTok"),
    ]
    for name, criteria, size, channel in segments:
        cur.execute(
            """
            INSERT INTO audience_segments (name, criteria_json, estimated_size, channel)
            VALUES (%s, %s::jsonb, %s, %s)
            """,
            (name, criteria, size, channel),
        )

    conn.commit()

    print("Inserting creatives...")
    creatives = [
        ("Q3 Hero Banner — Enterprise", "LinkedIn", "pending"),
        ("Summer Sale Carousel", "Meta", "approved"),
        ("Branded Search Ad Copy v3", "Google Ads", "live"),
        ("15s Product Demo Clip", "TikTok", "pending"),
        ("Re-engagement Email — Lapsed Users", "Email", "live"),
        ("Competitor Comparison Ad", "Google Ads", "rejected"),
        ("Thought Leadership Sponsored Post", "LinkedIn", "approved"),
        ("UGC Testimonial Reel", "TikTok", "pending"),
        ("Welcome Series Email 1", "Email", "live"),
        ("Retargeting Dynamic Creative", "Meta", "live"),
    ]
    for name, channel, status in creatives:
        submitted_at = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 20))
        reviewed_at = submitted_at + timedelta(days=random.randint(1, 5)) if status != "pending" else None
        cur.execute(
            """
            INSERT INTO creatives (name, channel, status, submitted_at, reviewed_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (name, channel, status, submitted_at, reviewed_at),
        )

    conn.commit()
    cur.close()
    conn.close()
    print("Seed complete. 520 journeys, 12 campaigns, 5 channels inserted.")


if __name__ == "__main__":
    main()
