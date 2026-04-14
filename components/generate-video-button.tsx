"use client";

import { useState, useTransition, useEffect } from "react";
import { generateVideoAction } from "@/app/learn/sources/[id]/actions";

const FAST_COST_PER_SEC = 0.40;
const PRO_COST_PER_SEC = 0.75;

type Status = {
  id: string;
  status: string;
  progressPct: number;
  progressMessage: string | null;
  blobUrl: string;
  usdCost: number;
  elapsedSec: number;
  error: string | null;
};

export default function GenerateVideoButton({ sourceId }: { sourceId: string }) {
  const [open, setOpen] = useState(false);
  const [fast, setFast] = useState(true);
  const [duration, setDuration] = useState(8);
  const [aspect, setAspect] = useState<"16:9" | "9:16">("16:9");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  const perSec = fast ? FAST_COST_PER_SEC : PRO_COST_PER_SEC;
  const estimate = perSec * duration;

  useEffect(() => {
    if (!videoId) return;
    const isDone = status?.status === "complete" || status?.status === "failed";
    if (isDone) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/learn/videos/${videoId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const s = (await res.json()) as Status;
        setStatus(s);
        if (s.status === "complete") setTimeout(() => window.location.reload(), 1800);
      } catch {}
    }, 2500);
    return () => clearTimeout(timer);
  }, [videoId, status]);

  function run() {
    if (!confirm(`יצירת וידאו VEO 3 תעלה כ-$${estimate.toFixed(2)}. להמשיך?`)) return;
    setErr(""); setStatus(null); setOpen(false);
    startTransition(async () => {
      const r = await generateVideoAction(sourceId, { fast, durationSec: duration, aspectRatio: aspect });
      if (!r.ok) setErr(r.error);
      else {
        setVideoId(r.videoId);
        setStatus({ id: r.videoId, status: "submitting", progressPct: 2, progressMessage: "שולח בקשה…", blobUrl: "", usdCost: 0, elapsedSec: 0, error: null });
      }
    });
  }

  const isRunning = videoId && status && status.status !== "complete" && status.status !== "failed";

  return (
    <div className="relative">
      {!videoId && !pending && (
        <button
          onClick={() => setOpen(!open)}
          className="bg-gradient-to-l from-red-500 to-pink-500 hover:opacity-90 text-white font-bold px-4 py-2 rounded-lg text-sm whitespace-nowrap"
        >
          🎬 צור וידאו (VEO 3)
        </button>
      )}

      {pending && !videoId && (
        <button disabled className="bg-gradient-to-l from-red-500 to-pink-500 text-white font-bold px-4 py-2 rounded-lg text-sm opacity-70">
          🎬 מאתחל…
        </button>
      )}

      {open && !pending && !videoId && (
        <div className="absolute top-full mt-2 left-0 bg-slate-900 border border-slate-700 rounded-xl p-4 w-80 shadow-2xl z-20">
          <h3 className="text-sm font-bold text-white mb-3">הגדרות VEO 3</h3>
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-1">מודל</div>
            <div className="flex gap-1 bg-slate-950 rounded-lg p-1">
              <button onClick={() => setFast(true)} className={`flex-1 text-xs py-1.5 rounded transition ${fast ? "bg-pink-500 text-white" : "text-slate-400"}`}>
                ⚡ Fast (${FAST_COST_PER_SEC}/sec)
              </button>
              <button onClick={() => setFast(false)} className={`flex-1 text-xs py-1.5 rounded transition ${!fast ? "bg-red-500 text-white" : "text-slate-400"}`}>
                💎 Pro (${PRO_COST_PER_SEC}/sec)
              </button>
            </div>
          </div>
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-1">משך (שניות): {duration}</div>
            <input type="range" min={4} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-pink-500" />
          </div>
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-1">יחס</div>
            <div className="flex gap-1 bg-slate-950 rounded-lg p-1">
              <button onClick={() => setAspect("16:9")} className={`flex-1 text-xs py-1.5 rounded ${aspect === "16:9" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>🖥 16:9</button>
              <button onClick={() => setAspect("9:16")} className={`flex-1 text-xs py-1.5 rounded ${aspect === "9:16" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>📱 9:16</button>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 mb-3 text-center">
            <div className="text-[10px] text-amber-400 uppercase">עלות משוערת</div>
            <div className="text-2xl font-bold text-amber-300">${estimate.toFixed(2)}</div>
          </div>
          <button onClick={run} className="w-full bg-gradient-to-l from-red-500 to-pink-500 hover:opacity-90 text-white font-bold py-2 rounded-lg text-sm">
            🎬 הפעל VEO 3
          </button>
          <button onClick={() => setOpen(false)} className="w-full mt-2 text-slate-400 hover:text-slate-200 text-xs">ביטול</button>
        </div>
      )}

      {isRunning && status && <ProgressPanel status={status} />}

      {status?.status === "complete" && (
        <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs">
          <div className="text-emerald-300 font-semibold">✓ הוידאו הושלם ({status.elapsedSec}s)</div>
          <div className="text-slate-400 mt-1">עלות: ${status.usdCost.toFixed(2)} · טוען מחדש...</div>
        </div>
      )}

      {status?.status === "failed" && (
        <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs max-w-md">
          <div className="text-red-300 font-semibold mb-1">⚠ נכשל</div>
          <div className="text-slate-400">{status.error}</div>
        </div>
      )}

      {err && <div className="text-[11px] text-red-400 mt-2 max-w-md">⚠ {err}</div>}
    </div>
  );
}

function ProgressPanel({ status }: { status: Status }) {
  const steps: Array<{ key: string; label: string }> = [
    { key: "submitting", label: "שולח ל-VEO 3" },
    { key: "rendering", label: "מרנדר (1-3 דקות)" },
    { key: "downloading", label: "מוריד מ-VEO" },
    { key: "uploading", label: "שומר ל-Blob" },
    { key: "complete", label: "הושלם" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === status.status);

  return (
    <div className="mt-2 bg-slate-900 border border-pink-500/40 rounded-xl p-4 w-80 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-white">🎬 יוצר וידאו…</div>
        <div className="text-[10px] font-mono text-slate-500">{status.elapsedSec}s</div>
      </div>

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-l from-pink-500 to-red-500 transition-all duration-500"
          style={{ width: `${status.progressPct}%` }}
        />
      </div>
      <div className="text-xs text-slate-400 mb-4 text-center">{status.progressPct}% · {status.progressMessage}</div>

      <ol className="space-y-2">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={s.key} className="flex items-center gap-3 text-xs">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                done ? "bg-emerald-500 text-slate-950" :
                active ? "bg-pink-500 text-white animate-pulse" :
                "bg-slate-800 text-slate-500"
              }`}>
                {done ? "✓" : active ? "●" : i + 1}
              </div>
              <span className={done ? "text-emerald-300" : active ? "text-white font-medium" : "text-slate-500"}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="text-[10px] text-slate-500 mt-3 text-center italic">
        הדף לא נסגר — הפעולה רצה ב-Vercel ברקע
      </div>
    </div>
  );
}
