"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CHANNEL_COLORS: Record<string, string> = {
  Meta: "#818CF8",
  "Google Ads": "#34D399",
  LinkedIn: "#60A5FA",
  TikTok: "#F472B6",
  Email: "#FBBF24",
};

type Model = "shapleyPct" | "lastTouchPct" | "linearPct";

interface ChannelRow {
  channel: string;
  shapleyPct: number;
  lastTouchPct: number;
  linearPct: number;
  spendPct: number;
  spend: number;
  revenue: number;
  delta: number;
}

interface CampaignRow {
  id: number;
  name: string;
  channel: string;
  budget: number;
  spend: number;
  clicks: number;
  conversions: number;
}

const MODEL_LABELS: Record<Model, string> = {
  shapleyPct: "Shapley (Data-driven)",
  lastTouchPct: "Last Touch",
  linearPct: "Linear",
};

const MODEL_COLOR: Record<Model, string> = {
  shapleyPct: "#8B5CF6",
  lastTouchPct: "#F59E0B",
  linearPct: "#10B981",
};

interface Insight {
  text: string;
  source: "bedrock" | "template";
}

export default function AttributionPage() {
  const [period, setPeriod] = useState(30);
  const [model, setModel] = useState<Model>("shapleyPct");
  const [data, setData] = useState<ChannelRow[]>([]);
  const [loadedPeriod, setLoadedPeriod] = useState<number | null>(null);
  const loading = loadedPeriod !== period;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/attribution?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.comparison ?? []);
        setLoadedPeriod(period);
      })
      .catch(() => setLoadedPeriod(period));
  }, [period]);

  useEffect(() => {
    setInsightLoading(true);
    fetch(`/api/attribution/insight?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setInsight({ text: d.text, source: d.source });
        setInsightLoading(false);
      })
      .catch(() => setInsightLoading(false));
  }, [period]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns ?? []);
        setCampaignsLoading(false);
      })
      .catch(() => setCampaignsLoading(false));
  }, []);

  const sorted = [...data].sort((a, b) => b[model] - a[model]);

  // Find the most undervalued channel (highest positive delta between shapley and spend)
  const undervalued = [...data].sort((a, b) => b.delta - a.delta)[0];

  const chartData = sorted.map((r) => ({
    channel: r.channel,
    credit: parseFloat((r[model] * 100).toFixed(1)),
    spend: parseFloat((r.spendPct * 100).toFixed(1)),
  }));

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Attribution</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Which channels actually drive revenue?
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Period picker */}
          <div className="flex bg-[#111318] border border-gray-800 rounded-lg p-0.5">
            {[30, 60, 90].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  period === p
                    ? "bg-violet-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>

          {/* Model picker */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as Model)}
            className="bg-[#111318] border border-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            {(Object.keys(MODEL_LABELS) as Model[]).map((m) => (
              <option key={m} value={m}>
                {MODEL_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI insight */}
      <div className="bg-gradient-to-br from-violet-600/10 to-blue-600/10 border border-violet-500/25 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-3.5 h-3.5 text-violet-400"
          >
            <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.5-6.5-2.1 2.1M8.6 15.4l-2.1 2.1m12-2.1-2.1-2.1M8.6 8.6 6.5 6.5" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <p className="text-xs font-medium text-violet-300">AI Insight</p>
          {!insightLoading && insight && (
            <span className="text-[10px] text-gray-500 ml-auto">
              {insight.source === "bedrock"
                ? "Generated by Amazon Bedrock"
                : "Vantage Insights"}
            </span>
          )}
        </div>
        {insightLoading ? (
          <div className="space-y-1.5">
            <div className="h-3 bg-gray-800/60 animate-pulse rounded w-full" />
            <div className="h-3 bg-gray-800/60 animate-pulse rounded w-3/4" />
          </div>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed">
            {insight?.text}
          </p>
        )}
      </div>

      {/* Insight callout */}
      {undervalued && undervalued.delta > 0.03 && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-5 py-4 flex items-start gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <div>
            <p className="text-emerald-300 text-sm font-medium">
              {undervalued.channel} is your most undervalued channel
            </p>
            <p className="text-emerald-400/60 text-xs mt-0.5">
              Receives{" "}
              <span className="text-emerald-300 font-medium">
                {(undervalued.spendPct * 100).toFixed(0)}%
              </span>{" "}
              of budget but drives{" "}
              <span className="text-emerald-300 font-medium">
                {(undervalued.shapleyPct * 100).toFixed(0)}%
              </span>{" "}
              of attributed revenue according to Shapley values.
            </p>
          </div>
        </div>
      )}

      {/* Bar chart: credit vs spend */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-300">
            {MODEL_LABELS[model]} vs Budget Share
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{ background: MODEL_COLOR[model] }}
              />
              Attribution credit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-600 inline-block" />
              Budget share
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-56 bg-gray-800/40 animate-pulse rounded-lg mt-3" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" barGap={4}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1F2937"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 45]}
                tick={{ fill: "#6B7280", fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="channel"
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                width={88}
              />
              <Tooltip
                contentStyle={{
                  background: "#1F2937",
                  border: "none",
                  borderRadius: 8,
                }}
                itemStyle={{ fontSize: 11 }}
                formatter={(v, name) => [
                  v != null ? `${Number(v).toFixed(1)}%` : "-",
                  name === "credit" ? MODEL_LABELS[model] : "Budget share",
                ]}
              />
              <Bar dataKey="credit" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.channel}
                    fill={CHANNEL_COLORS[entry.channel] ?? MODEL_COLOR[model]}
                  />
                ))}
              </Bar>
              <Bar dataKey="spend" fill="#374151" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Comparison table */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300">Model Comparison</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Shapley values distribute credit fairly based on each channel&apos;s
            marginal contribution across all possible ordering combinations.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left px-5 py-3">Channel</th>
              <th className="text-right px-5 py-3">Spend</th>
              <th className="text-right px-5 py-3">Budget %</th>
              <th className="text-right px-5 py-3">Last Touch</th>
              <th className="text-right px-5 py-3">Linear</th>
              <th className="text-right px-5 py-3 font-semibold text-violet-400">
                Shapley
              </th>
              <th className="text-right px-5 py-3">vs Budget</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={7} className="px-5 py-3">
                      <div className="h-4 bg-gray-800 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : sorted.map((row) => {
                  const isUndervalued = row.delta > 0.03;
                  const isOvervalued = row.delta < -0.03;
                  return (
                    <tr
                      key={row.channel}
                      className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              background:
                                CHANNEL_COLORS[row.channel] ?? "#8B5CF6",
                            }}
                          />
                          <span className="text-gray-200">{row.channel}</span>
                        </div>
                      </td>
                      <td className="text-right px-5 py-3 text-gray-400">
                        ${(row.spend / 1000).toFixed(1)}k
                      </td>
                      <td className="text-right px-5 py-3 text-gray-400">
                        {(row.spendPct * 100).toFixed(1)}%
                      </td>
                      <td className="text-right px-5 py-3 text-gray-400">
                        {(row.lastTouchPct * 100).toFixed(1)}%
                      </td>
                      <td className="text-right px-5 py-3 text-gray-400">
                        {(row.linearPct * 100).toFixed(1)}%
                      </td>
                      <td className="text-right px-5 py-3 font-medium text-violet-300">
                        {(row.shapleyPct * 100).toFixed(1)}%
                      </td>
                      <td className="text-right px-5 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isUndervalued
                              ? "bg-emerald-500/15 text-emerald-400"
                              : isOvervalued
                                ? "bg-red-500/15 text-red-400"
                                : "bg-gray-700/50 text-gray-500"
                          }`}
                        >
                          {row.delta > 0 ? "+" : ""}
                          {(row.delta * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Campaign drill-down */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300">Campaigns</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Click a campaign for its individual performance breakdown.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left px-5 py-3">Campaign</th>
              <th className="text-left px-5 py-3">Channel</th>
              <th className="text-right px-5 py-3">Spend</th>
              <th className="text-right px-5 py-3">Conversions</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {campaignsLoading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={5} className="px-5 py-3">
                      <div className="h-4 bg-gray-800 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-200">{c.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: `${CHANNEL_COLORS[c.channel]}20`,
                          color: CHANNEL_COLORS[c.channel],
                        }}
                      >
                        {c.channel}
                      </span>
                    </td>
                    <td className="text-right px-5 py-3 text-gray-400">
                      ${(c.spend / 1000).toFixed(1)}k
                    </td>
                    <td className="text-right px-5 py-3 text-gray-400">
                      {c.conversions.toLocaleString()}
                    </td>
                    <td className="text-right px-5 py-3">
                      <Link
                        href={`/attribution/${c.id}`}
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Shapley explainer */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl px-5 py-4">
        <p className="text-xs font-medium text-gray-400 mb-1">
          What are Shapley values?
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          Shapley values come from cooperative game theory. For each channel,
          Vantage evaluates every possible ordering of touchpoints and
          calculates the average marginal contribution that channel adds across
          all orderings. This is the same methodology used by Google Analytics
          4&apos;s data-driven attribution model — it fairly distributes credit
          based on actual influence, not just position in the funnel.
        </p>
      </div>
    </div>
  );
}
