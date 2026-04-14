"use client";

import { useState, useEffect } from "react";
import SyncProgress from "./sync-progress";

export default function InsightsFreshness({ lastTakenAt }: { lastTakenAt: string | null }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState<number>(() => Date.now());
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(iv);
  }, []);

  const lastMs = lastTakenAt ? new Date(lastTakenAt).getTime() : null;
  const ageMin = lastMs ? Math.floor((now - lastMs) / 60000) : null;
  // Hourly cron runs at :00 of each hour
  const nextRunMin = (() => {
    const d = new Date(now);
    const minsLeft = 60 - d.getMinutes();
    return minsLeft === 60 ? 0 : minsLeft;
  })();

  async function refresh() {
    if (!confirm("ליצור snapshot חדש עכשיו + להריץ Auto-Improve על 3 פרומפטים?")) return;
    setErr(""); setStarting(true);
    try {
      const res = await fetch("/api/learn/snapshot-now", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.error || `HTTP ${res.status}`); return; }
      setJobId(j.jobId);
    } catch (e: any) {
      setErr(e.message || "שגיאה");
    } finally {
      setStarting(false);
    }
  }

  const freshnessColor =
    ageMin === null ? "text-slate-500" :
    ageMin < 60 ? "text-emerald-400" :
    ageMin < 120 ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="text-[11px] uppercase text-slate-500 mb-1">רענון אוטומטי</div>
        <div className="text-sm text-slate-200">
          {ageMin === null ? (
            "אין עדיין snapshot"
          ) : (
            <>
              עודכן לפני <span className={`font-bold ${freshnessColor}`}>{ageMin < 1 ? "פחות מדקה" : `${ageMin} דקות`}</span>
              <span className="text-slate-500 mx-2">·</span>
              Snapshot הבא בעוד <span className="text-cyan-300 font-mono">{nextRunMin}m</span>
            </>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Cron שעתי · כל snapshot שומר data+delta+summary ומריץ Auto-Improve על 3 פרומפטים
        </div>
      </div>
      <button
        onClick={refresh}
        disabled={starting || !!jobId}
        className="bg-gradient-to-l from-cyan-500 to-purple-500 hover:opacity-90 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50 whitespace-nowrap"
      >
        {starting || jobId ? "🔄 רץ…" : "🔄 רענן עכשיו"}
      </button>

      {jobId && (
        <div className="w-full">
          <SyncProgress
            jobId={jobId}
            steps={["מחשב CorpusInsights", "מריץ Auto-Improve", "הושלם"]}
            onComplete={() => { setTimeout(() => window.location.reload(), 1500); }}
            onFailed={(e) => { setJobId(null); setErr(e); }}
          />
        </div>
      )}
      {err && <div className="text-xs text-red-400 w-full">⚠ {err}</div>}
    </div>
  );
}
