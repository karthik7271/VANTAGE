"use client";

import { useEffect, useState } from "react";

const CHANNEL_COLORS: Record<string, string> = {
  Meta: "#818CF8",
  "Google Ads": "#34D399",
  LinkedIn: "#60A5FA",
  TikTok: "#F472B6",
  Email: "#FBBF24",
};

const CHANNELS = ["Meta", "Google Ads", "LinkedIn", "TikTok", "Email"];
const BEHAVIOR_FILTERS = [
  "Visited pricing page",
  "Started trial",
  "Viewed 3+ pages",
  "Opened email in last 30 days",
  "Churned in last 90 days",
];
const COMPANY_SIZES = ["Any", "1–50", "50–200", "200–1000", "1000+"];

interface Segment {
  id: number;
  name: string;
  channel: string;
  estimated_size: number;
  updated_at: string;
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function AudiencesPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [behaviorFilter, setBehaviorFilter] = useState(BEHAVIOR_FILTERS[0]);
  const [companySize, setCompanySize] = useState(COMPANY_SIZES[0]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/audiences")
      .then((r) => r.json())
      .then((d) => {
        setSegments(d.segments ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function openCreateModal() {
    setName("");
    setChannel(CHANNELS[0]);
    setBehaviorFilter(BEHAVIOR_FILTERS[0]);
    setCompanySize(COMPANY_SIZES[0]);
    setEditingId(null);
    setModalMode("create");
  }

  function openEditModal(seg: Segment) {
    setName(seg.name);
    setChannel(seg.channel);
    setEditingId(seg.id);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/audiences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, channel, behaviorFilter, companySize }),
        });
        const d = await res.json();
        if (res.ok) {
          setSegments((prev) => [d.segment, ...prev]);
          closeModal();
        }
      } else if (modalMode === "edit" && editingId != null) {
        const res = await fetch("/api/audiences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, name, channel }),
        });
        const d = await res.json();
        if (res.ok) {
          setSegments((prev) =>
            prev.map((s) => (s.id === editingId ? d.segment : s)),
          );
          closeModal();
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/audiences", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSegments((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Audiences</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage segments across all channels
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Segment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Total Segments</p>
          <p className="text-2xl font-semibold text-white">{segments.length}</p>
        </div>
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Total Addressable</p>
          <p className="text-2xl font-semibold text-white">
            {fmt(segments.reduce((a, s) => a + s.estimated_size, 0))}
          </p>
        </div>
        <div className="bg-[#111318] border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Active Channels</p>
          <p className="text-2xl font-semibold text-white">
            {new Set(segments.map((s) => s.channel)).size}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300">All Segments</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left px-5 py-3">Segment Name</th>
              <th className="text-left px-5 py-3">Channel</th>
              <th className="text-right px-5 py-3">Est. Size</th>
              <th className="text-right px-5 py-3">Last Updated</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={5} className="px-5 py-3">
                      <div className="h-4 bg-gray-800 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : segments.map((seg) => (
                  <tr
                    key={seg.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-200">{seg.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: `${CHANNEL_COLORS[seg.channel]}20`,
                          color: CHANNEL_COLORS[seg.channel],
                        }}
                      >
                        {seg.channel}
                      </span>
                    </td>
                    <td className="text-right px-5 py-3 text-gray-400">
                      {fmt(seg.estimated_size)}
                    </td>
                    <td className="text-right px-5 py-3 text-gray-500 text-xs">
                      {new Date(seg.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="text-right px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditModal(seg)}
                          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(seg.id)}
                          disabled={deletingId === seg.id}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          {deletingId === seg.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Segment Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111318] border border-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-medium">
                {modalMode === "create" ? "Create Segment" : "Edit Segment"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-300"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Segment Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  placeholder="e.g. Enterprise Decision Makers"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  {CHANNELS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              {modalMode === "create" && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Behavior Filter
                    </label>
                    <select
                      value={behaviorFilter}
                      onChange={(e) => setBehaviorFilter(e.target.value)}
                      className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    >
                      {BEHAVIOR_FILTERS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Company Size
                    </label>
                    <select
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    >
                      {COMPANY_SIZES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !name.trim()}
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : modalMode === "create"
                    ? "Create Segment"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
