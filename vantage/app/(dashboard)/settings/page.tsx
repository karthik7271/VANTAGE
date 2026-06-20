"use client";

import { useState } from "react";

const CHANNELS = [
  { name: "Meta", color: "#818CF8", synced: "2 hours ago", live: true },
  { name: "Google Ads", color: "#34D399", synced: "1 hour ago", live: false },
  { name: "LinkedIn", color: "#60A5FA", synced: "3 hours ago", live: false },
  { name: "TikTok", color: "#F472B6", synced: "5 hours ago", live: false },
  { name: "Email", color: "#FBBF24", synced: "30 minutes ago", live: false },
];

type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "success"; campaigns: number; dailyStats: number }
  | { status: "error"; message: string };

export default function SettingsPage() {
  const [metaSync, setMetaSync] = useState<SyncState>({ status: "idle" });

  async function syncMeta() {
    setMetaSync({ status: "syncing" });
    try {
      const res = await fetch("/api/integrations/meta/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sync failed");
      setMetaSync({
        status: "success",
        campaigns: body.campaignsSynced,
        dailyStats: body.dailyStatsSynced,
      });
    } catch (err) {
      setMetaSync({
        status: "error",
        message: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Workspace configuration</p>
      </div>

      {/* Connected Channels */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300">
            Connected Channels
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Data is synced automatically every 6 hours
          </p>
        </div>
        <div className="divide-y divide-gray-800">
          {CHANNELS.map((ch) => (
            <div
              key={ch.name}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: `${ch.color}20`, color: ch.color }}
                >
                  {ch.name[0]}
                </div>
                <div>
                  <p className="text-sm text-gray-200">{ch.name}</p>
                  <p className="text-xs text-gray-600">
                    {ch.name === "Meta" && metaSync.status === "success"
                      ? `Synced ${metaSync.campaigns} campaigns, ${metaSync.dailyStats} daily rows`
                      : ch.name === "Meta" && metaSync.status === "error"
                        ? metaSync.message
                        : `Last synced ${ch.synced}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {ch.name === "Meta" && (
                  <button
                    onClick={syncMeta}
                    disabled={metaSync.status === "syncing"}
                    className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {metaSync.status === "syncing" ? "Syncing…" : "Sync now"}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      ch.live ? "bg-emerald-500" : "bg-emerald-500/40"
                    }`}
                  />
                  <span className="text-xs text-emerald-400 font-medium">
                    Connected
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-300">Team Members</p>
            <p className="text-xs text-gray-600 mt-0.5">
              1 member on the Starter plan
            </p>
          </div>
          <button className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
            Invite
          </button>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center text-violet-400 text-sm font-medium">
              A
            </div>
            <div>
              <p className="text-sm text-gray-200">Alex Rivera</p>
              <p className="text-xs text-gray-600">demo@vantage.ai</p>
            </div>
          </div>
          <span className="text-xs bg-violet-600/20 text-violet-400 px-2.5 py-1 rounded-full font-medium">
            Owner
          </span>
        </div>
      </div>

      {/* Workspace */}
      <div className="bg-[#111318] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300">Workspace</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Workspace Name
            </label>
            <input
              defaultValue="Vantage Demo"
              className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Attribution Window
            </label>
            <select className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
              <option>30 days</option>
              <option>60 days</option>
              <option>90 days</option>
            </select>
          </div>
          <button className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
