"use client";

import { useState, useTransition } from "react";

export default function TriggerImprovementButton({ snapshotId }: { snapshotId: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [done, setDone] = useState<any>(null);

  function run() {
    if (!confirm("להפעיל auto-improvement? זה יקרא ל-Gemini על עד 5 פרומפטים (~$0.005) ויעדכן אותם עם שמירת גרסה קודמת.")) return;
    setErr(""); setDone(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/learn/auto-improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId, max: 5 }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) setErr(j.error || `HTTP ${res.status}`);
        else {
          setDone(j);
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (e: any) {
        setErr(e.message || "שגיאה");
      }
    });
  }

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/5 border border-purple-500/30 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-white mb-1">🔄 הפעל Auto-Improvement</h3>
          <p className="text-xs text-slate-400 max-w-lg">
            המערכת תבחר פרומפטים עם ניתוח רזה ותשדרג אותם לפי התובנות העדכניות. כל שדרוג שומר את הגרסה הקודמת.
          </p>
        </div>
        <button
          onClick={run}
          disabled={pending}
          className="bg-gradient-to-l from-purple-500 to-cyan-500 hover:opacity-90 text-white font-bold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? "🔄 מריץ…" : "🚀 הרץ עכשיו"}
        </button>
      </div>
      {done && (
        <div className="mt-3 text-xs text-emerald-300">
          ✓ הושלם · נבדקו {done.examined} · שודרגו {done.improved} · עלות ${done.totalCostUsd?.toFixed(4) || "0"}
        </div>
      )}
      {err && <div className="mt-3 text-xs text-red-400">⚠ {err}</div>}
    </div>
  );
}
