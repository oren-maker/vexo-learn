"use client";

import { useState, useTransition } from "react";
import { generateVideoAction } from "@/app/learn/sources/[id]/actions";

const FAST_COST_PER_SEC = 0.40;
const PRO_COST_PER_SEC = 0.75;

export default function GenerateVideoButton({ sourceId }: { sourceId: string }) {
  const [open, setOpen] = useState(false);
  const [fast, setFast] = useState(true);
  const [duration, setDuration] = useState(8);
  const [aspect, setAspect] = useState<"16:9" | "9:16">("16:9");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ blobUrl: string; cost: number } | null>(null);

  const perSec = fast ? FAST_COST_PER_SEC : PRO_COST_PER_SEC;
  const estimate = perSec * duration;

  function run() {
    if (!confirm(`יצירת וידאו VEO 3 תעלה כ-$${estimate.toFixed(2)}. להמשיך?`)) return;
    setErr(""); setDone(null); setOpen(false);
    startTransition(async () => {
      const r = await generateVideoAction(sourceId, { fast, durationSec: duration, aspectRatio: aspect });
      if (!r.ok) setErr(r.error);
      else {
        setDone({ blobUrl: r.blobUrl, cost: r.cost });
        setTimeout(() => window.location.reload(), 1500);
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={pending}
        className="bg-gradient-to-l from-red-500 to-pink-500 hover:opacity-90 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 whitespace-nowrap"
      >
        {pending ? "🎬 יוצר וידאו... (1-3 דק)" : "🎬 צור וידאו (VEO 3)"}
      </button>

      {open && !pending && (
        <div className="absolute top-full mt-2 left-0 bg-slate-900 border border-slate-700 rounded-xl p-4 w-80 shadow-2xl z-10">
          <h3 className="text-sm font-bold text-white mb-3">הגדרות VEO 3</h3>

          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-1">מודל</div>
            <div className="flex gap-1 bg-slate-950 rounded-lg p-1">
              <button
                onClick={() => setFast(true)}
                className={`flex-1 text-xs py-1.5 rounded transition ${fast ? "bg-pink-500 text-white" : "text-slate-400"}`}
              >
                ⚡ Fast (${FAST_COST_PER_SEC}/sec)
              </button>
              <button
                onClick={() => setFast(false)}
                className={`flex-1 text-xs py-1.5 rounded transition ${!fast ? "bg-red-500 text-white" : "text-slate-400"}`}
              >
                💎 Pro (${PRO_COST_PER_SEC}/sec)
              </button>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-1">משך (שניות): {duration}</div>
            <input
              type="range" min={4} max={15} value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
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

          <button
            onClick={run}
            className="w-full bg-gradient-to-l from-red-500 to-pink-500 hover:opacity-90 text-white font-bold py-2 rounded-lg text-sm"
          >
            🎬 הפעל VEO 3
          </button>
          <button onClick={() => setOpen(false)} className="w-full mt-2 text-slate-400 hover:text-slate-200 text-xs">ביטול</button>
        </div>
      )}

      {done && (
        <div className="text-[11px] text-emerald-400 mt-2">✓ נוצר · עלות: ${done.cost.toFixed(2)}</div>
      )}
      {err && <div className="text-[11px] text-red-400 mt-2 max-w-md">⚠ {err}</div>}
    </div>
  );
}
