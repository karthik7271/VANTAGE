"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
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

interface Metrics {
  totalSpend: number;
  totalConversions: number;
  avgCPC: number;
  convRate: number;
}

interface Anomaly {
  channel: string;
  currentCPC: number;
  priorCPC: number;
  pctChange: number;
}

interface DashboardData {
  metrics: Metrics;
  spendByDay: { date: string; spend: number }[];
  convByChannel: { channel: string; conversions: number }[];
  anomalies: Anomaly[];
}

function fmt(n: number, prefix = "") {
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}k`;
  return `${prefix}${n.toLocaleString()}`;
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/metrics")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Last 30 days across all channels
        </p>
      </div>

      {/* Anomaly alert */}
      {data?.anomalies && data.anomalies.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 flex items-start gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-amber-400 text-sm font-medium">
              Spend anomaly detected
            </p>
            <div className="mt-1 space-y-0.5">
              {data.anomalies.map((a) => (
                <p key={a.channel} className="text-xs text-amber-300/70">
                  {a.channel} CPC up {a.pctChange}% vs last week — $
                  {a.priorCPC.toFixed(2)} → ${a.currentCPC.toFixed(2)}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Spend"
          value={`$${fmt(m?.totalSpend ?? 0)}`}
          sub="Last 30 days"
        />
        <MetricCard
          label="Conversions"
          value={fmt(m?.totalConversions ?? 0)}
          sub="Last 30 days"
        />
        <MetricCard
          label="Avg. CPC"
          value={`$${(m?.avgCPC ?? 0).toFixed(2)}`}
          sub="All channels"
        />
        <MetricCard
          label="Conv. Rate"
          value={`${(m?.convRate ?? 0).toFixed(1)}%`}
          sub="Clicks → Conversions"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend over time */}
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">Daily Spend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data?.spendByDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6B7280", fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
                interval={6}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 10 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  background: "#1F2937",
                  border: "none",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                itemStyle={{ color: "#A78BFA" }}
                formatter={(v) => [
                  v != null ? `$${Number(v).toLocaleString()}` : "-",
                  "Spend",
                ]}
              />
              <Line
                type="monotone"
                dataKey="spend"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversions by channel */}
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">
            Conversions by Channel
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.convByChannel ?? []} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1F2937"
                horizontal={false}
              />
              <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="channel"
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  background: "#1F2937",
                  border: "none",
                  borderRadius: 8,
                }}
                itemStyle={{ color: "#9CA3AF" }}
              />
              <Bar dataKey="conversions" radius={[0, 4, 4, 0]}>
                {(data?.convByChannel ?? []).map((entry) => (
                  <Cell
                    key={entry.channel}
                    fill={CHANNEL_COLORS[entry.channel] ?? "#8B5CF6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hint to attribution */}
      <div className="bg-violet-600/10 border border-violet-600/20 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-violet-300">
            Ready to see which channel actually drives revenue?
          </p>
          <p className="text-xs text-violet-400/60 mt-0.5">
            Vantage uses Shapley values — the same model as Google Analytics 4 —
            to give each channel its true credit.
          </p>
        </div>
        <a
          href="/attribution"
          className="shrink-0 ml-4 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          View Attribution →
        </a>
      </div>
    </div>
  );
}
