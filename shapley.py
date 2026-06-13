"""
Vantage — Shapley value attribution engine
Computes data-driven multi-touch attribution using cooperative game theory.
Pre-computes results for 30/60/90 day periods and stores in attribution_results table.
"""

import os
import itertools
import psycopg2
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
CHANNELS = ["Meta", "Google Ads", "LinkedIn", "TikTok", "Email"]


def characteristic_function(journeys: list[dict], coalition: frozenset) -> float:
    """
    v(S) = total revenue from journeys where at least one touchpoint is in S.
    This approximates the marginal value a coalition of channels brings.
    """
    total = 0.0
    for journey in journeys:
        journey_channels = set(journey["channels"])
        if journey_channels & coalition:
            total += journey["revenue"]
    return total


def compute_shapley(journeys: list[dict]) -> dict[str, float]:
    """
    Shapley(i) = average marginal contribution of channel i across all orderings.
    Equivalent formulation using subsets:
      φ(i) = Σ_{S ⊆ N\{i}} [|S|!(|N|-|S|-1)!/|N|!] * [v(S∪{i}) - v(S)]
    """
    n = len(CHANNELS)
    shapley = {ch: 0.0 for ch in CHANNELS}
    factorial = [1] * (n + 1)
    for i in range(1, n + 1):
        factorial[i] = factorial[i - 1] * i

    for ch in CHANNELS:
        others = [c for c in CHANNELS if c != ch]
        phi = 0.0
        for size in range(len(others) + 1):
            for subset in itertools.combinations(others, size):
                s = frozenset(subset)
                s_with_i = s | {ch}
                weight = factorial[len(s)] * factorial[n - len(s) - 1] / factorial[n]
                marginal = characteristic_function(journeys, s_with_i) - characteristic_function(journeys, s)
                phi += weight * marginal
        shapley[ch] = phi

    return shapley


def last_touch_attribution(journeys: list[dict]) -> dict[str, float]:
    result = defaultdict(float)
    for journey in journeys:
        if journey["channels"]:
            last_ch = journey["channels"][-1]
            result[last_ch] += journey["revenue"]
    return dict(result)


def linear_attribution(journeys: list[dict]) -> dict[str, float]:
    result = defaultdict(float)
    for journey in journeys:
        channels = journey["channels"]
        if channels:
            share = journey["revenue"] / len(channels)
            for ch in channels:
                result[ch] += share
    return dict(result)


def fetch_journeys(cur, period_days: int) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
    cur.execute(
        """
        SELECT cj.id, cj.revenue,
               array_agg(t.channel ORDER BY t.position) AS channels
        FROM customer_journeys cj
        JOIN touchpoints t ON t.journey_id = cj.id
        WHERE cj.converted_at >= %s
        GROUP BY cj.id, cj.revenue
        """,
        (cutoff,),
    )
    rows = cur.fetchall()
    return [{"id": r[0], "revenue": float(r[1]), "channels": list(r[2])} for r in rows]


def upsert_results(cur, model: str, results: dict[str, float], total_revenue: float, period_days: int):
    for channel, value in results.items():
        pct = value / total_revenue if total_revenue > 0 else 0
        cur.execute(
            """
            INSERT INTO attribution_results (channel, model, pct_credit, total_revenue, period_days, computed_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (channel, model, period_days)
            DO UPDATE SET pct_credit = EXCLUDED.pct_credit,
                          total_revenue = EXCLUDED.total_revenue,
                          computed_at = EXCLUDED.computed_at
            """,
            (channel, model, round(pct, 6), round(total_revenue, 2), period_days),
        )


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    for period_days in [30, 60, 90]:
        print(f"\nComputing attribution for last {period_days} days...")
        journeys = fetch_journeys(cur, period_days)
        print(f"  Found {len(journeys)} journeys")

        if not journeys:
            print("  No data — skipping.")
            continue

        total_revenue = sum(j["revenue"] for j in journeys)
        print(f"  Total revenue: ${total_revenue:,.2f}")

        # Shapley
        print("  Computing Shapley values...")
        shapley = compute_shapley(journeys)
        upsert_results(cur, "shapley", shapley, total_revenue, period_days)
        print("  Shapley:")
        for ch, val in sorted(shapley.items(), key=lambda x: -x[1]):
            print(f"    {ch}: ${val:,.0f} ({val/total_revenue*100:.1f}%)")

        # Last-touch
        last = last_touch_attribution(journeys)
        upsert_results(cur, "last_touch", last, total_revenue, period_days)

        # Linear
        linear = linear_attribution(journeys)
        upsert_results(cur, "linear", linear, total_revenue, period_days)

    conn.commit()
    cur.close()
    conn.close()
    print("\nAttribution computation complete.")


if __name__ == "__main__":
    main()
