"use client";

import { useState } from "react";

export default function SyncPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  async function onSeedanceSync() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/internal/sync/seedance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": "dev-internal-key-change-me",
        },
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "שגיאה");
      else setResult(j);
    } catch (e: any) {
      setErr(e.message || "שגיאה");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">סנכרון מקורות חיצוניים</h1>
      <p className="text-sm text-slate-400 mb-6">
        משוך פרומפטים מוכנים מ-repos ציבוריים ב-GitHub. כל פרומפט נשמר כ-LearnSource בסטטוס complete עם קישור לוידאו דוגמה.
      </p>

      <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/5 border border-purple-500/30 rounded-xl p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-2xl shrink-0">
            🎬
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">
              Seedance 2.0 Prompts{" "}
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded ml-1">
                1700+ prompts
              </span>
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              אוסף רשמי של ByteDance Seedance 2.0 prompts עם וידאו דוגמה לכל אחד.
              <br />
              <a
                href="https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts"
                target="_blank"
                className="text-cyan-400 hover:underline"
              >
                YouMind-OpenLab/awesome-seedance-2-prompts →
              </a>
            </p>

            <button
              onClick={onSeedanceSync}
              disabled={busy}
              className="bg-purple-500 hover:bg-purple-400 text-white font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              {busy ? "מסנכרן... (זה יכול לקחת דקה)" : "🚀 סנכרן את כל הפרומפטים"}
            </button>

            <div className="text-[11px] text-slate-500 mt-3">
              💡 הסנכרון בטוח להפעלה חוזרת — הוא מעדכן רשומות קיימות (upsert) ולא יוצר כפילויות.
            </div>
          </div>
        </div>
      </div>

      {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">{err}</div>}

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5">
          <div className="text-emerald-300 font-semibold mb-3 text-lg">✅ הסנכרון הושלם</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{result.fetched}</div>
              <div className="text-xs text-slate-400">נמצאו במקור</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-cyan-300">{result.upserted}</div>
              <div className="text-xs text-slate-400">נשמרו ב-DB</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-300">{result.withVideo}</div>
              <div className="text-xs text-slate-400">עם וידאו</div>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <details className="mt-4">
              <summary className="text-amber-300 cursor-pointer text-sm">שגיאות ({result.errors.length})</summary>
              <ul className="mt-2 text-xs text-slate-400 list-disc pr-4 max-h-40 overflow-y-auto">
                {result.errors.map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 text-sm text-slate-300">
            עכשיו אפשר לפתוח את <a href="/learn/sources" className="text-cyan-400 underline">רשימת המקורות</a> ולראות את כל הפרומפטים. לחיצה על פרומפט תציג את הוידאו + תאפשר להריץ ניתוח Gemini ידני אם רוצים להעמיק.
          </div>
        </div>
      )}
    </div>
  );
}
