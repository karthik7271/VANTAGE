"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "recharts";

const CHANNEL_COLORS: Record<string, string> = {
  Meta: "#818CF8",
  "Google Ads": "#34D399",
  LinkedIn: "#60A5FA",
  TikTok: "#F472B6",
  Email: "#FBBF24",
};

interface CampaignDetail {
  campaign: {
    id: number;
    name: string;
    channel: string;
    startDate: string;
    endDate: string;
    budget: number;
  };
  totals: {
    spend: number;
    clicks: number;
    conversions: number;
    avgCPC: number;
  };
  daily: { date: string; spend: number; conversions: number }[];
  channelShapleyPct: number | null;
}

export default function CampaignDrillDownPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-64" />
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || !data.campaign) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Campaign not found.</p>
        <Link href="/attribution" className="text-violet-400 text-sm">
          ← Back to Attribution
        </Link>
      </div>
    );
  }

  const { campaign, totals, daily, channelShapleyPct } = data;
  const color = CHANNEL_COLORS[campaign.channel] ?? "#8B5CF6";

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link
          href="/attribution"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back to Attribution
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: color }}
          />
          <h1 className="text-xl font-semibold text-white">{campaign.name}</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {campaign.channel} · {campaign.startDate} to {campaign.endDate}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Spend</p>
          <p className="text-2xl font-semibold text-white">
            ${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            of ${campaign.budget.toLocaleString(undefined, { maximumFractionDigits: 0 })} budget
          </p>
        </div>
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Conversions</p>
          <p className="text-2xl font-semibold text-white">{totals.conversions.toLocaleString()}</p>
        </div>
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Avg. CPC</p>
          <p className="text-2xl font-semibold text-white">${totals.avgCPC.toFixed(2)}</p>
        </div>
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">{campaign.channel} Shapley Credit</p>
          <p className="text-2xl font-semibold text-white">
            {channelShapleyPct != null ? `${(channelShapleyPct * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-gray-600 mt-1">90-day, channel-level</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">Daily Spend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6B7280", fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
                interval={6}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 10 }}
                tickFormatter={(v) => `$${v}`}
                width={42}
              />
              <Tooltip
                contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "Spend"]}
              />
              <Line type="monotone" dataKey="spend" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">Daily Conversions</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6B7280", fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
                interval={6}
              />
              <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} width={28} />
              <Tooltip
                contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
              />
              <Bar dataKey="conversions" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
