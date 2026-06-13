"use client";

import { useEffect, useState } from "react";

const CHANNEL_COLORS: Record<string, string> = {
  Meta: "#818CF8",
  "Google Ads": "#34D399",
  LinkedIn: "#60A5FA",
  TikTok: "#F472B6",
  Email: "#FBBF24",
};

const COLUMNS = ["pending", "approved", "live", "rejected"] as const;
type Status = (typeof COLUMNS)[number];

const COLUMN_LABELS: Record<Status, string> = {
  pending: "Pending Review",
  approved: "Approved",
  live: "Live",
  rejected: "Rejected",
};

const COLUMN_COLORS: Record<Status, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  approved: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  live: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
};

interface Creative {
  id: number;
  name: string;
  channel: string;
  status: Status;
  submitted_at: string;
  reviewed_at: string | null;
}

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/creatives")
      .then((r) => r.json())
      .then((d) => {
        setCreatives(d.creatives ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function updateStatus(id: number, status: Status) {
    setCreatives((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c)),
    );
    await fetch("/api/creatives", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  const byStatus = (status: Status) =>
    creatives.filter((c) => c.status === status);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Creatives</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Content approval workflow
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col} className="space-y-3">
              <div className="h-6 bg-gray-800 animate-pulse rounded" />
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 bg-gray-800/60 animate-pulse rounded-xl"
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col} className="space-y-3">
              {/* Column header */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${COLUMN_COLORS[col]}`}
                >
                  {COLUMN_LABELS[col]}
                </span>
                <span className="text-xs text-gray-600">
                  {byStatus(col).length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[120px]">
                {byStatus(col).map((creative) => (
                  <div
                    key={creative.id}
                    className="bg-[#111318] border border-gray-800 rounded-xl p-4 space-y-3"
                  >
                    {/* Thumbnail placeholder */}
                    <div
                      className="w-full h-16 rounded-lg flex items-center justify-center text-xs font-medium"
                      style={{
                        background: `${CHANNEL_COLORS[creative.channel]}15`,
                        color: CHANNEL_COLORS[creative.channel],
                      }}
                    >
                      {creative.channel}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-200 leading-snug">
                        {creative.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(creative.submitted_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    {col === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(creative.id, "approved")}
                          className="flex-1 text-xs py-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(creative.id, "rejected")}
                          className="flex-1 text-xs py-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {col === "approved" && (
                      <button
                        onClick={() => updateStatus(creative.id, "live")}
                        className="w-full text-xs py-1.5 bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 rounded-lg transition-colors"
                      >
                        Push Live
                      </button>
                    )}
                    {col === "rejected" && (
                      <button
                        onClick={() => updateStatus(creative.id, "pending")}
                        className="w-full text-xs py-1.5 bg-gray-700/50 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Re-submit
                      </button>
                    )}
                  </div>
                ))}

                {byStatus(col).length === 0 && (
                  <div className="border border-dashed border-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-700">No creatives</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
