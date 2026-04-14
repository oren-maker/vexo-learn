"use client";

import { useState, useTransition } from "react";
import { similarAction, saveComposedAction } from "@/app/learn/compose/actions";

type Item = { prompt: string; rationale: string; similar: Array<{ id: string; title: string | null }> };

export default function SuggestSimilar({ sourceId, sourceTitle }: { sourceId: string; sourceTitle?: string | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Map<number, string>>(new Map());

  function generate() {
    setErr(""); setItems([]); setSavedIds(new Map());
    startTransition(async () => {
      const r = await similarAction(sourceId, 3);
      if (!r.ok) setErr(r.error);
      else if (r.items.length === 0) setErr("לא התקבלו וריאציות (ייתכן שה-quota מוצה)");
      else setItems(r.items);
    });
  }

  async function saveItem(i: number) {
    setSaving(i);
    const it = items[i];
    const r = await saveComposedAction({
      prompt: it.prompt,
      brief: `variation of ${sourceTitle || sourceId}`,
      parentSourceId: sourceId,
      lineageNotes: it.rationale,
      addedBy: "variation",
    });
    setSaving(null);
    if (r.ok) {
      const next = new Map(savedIds);
      next.set(i, r.id);
      setSavedIds(next);
    } else {
      setErr(r.error);
    }
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider">הצע 3 פרומפטים דומים</h2>
        <button
          onClick={generate}
          disabled={pending}
          className="bg-purple-500 hover:bg-purple-400 text-white font-medium px-4 py-1.5 rounded-lg text-xs disabled:opacity-50"
        >
          {pending ? "מחולל..." : "✨ חולל וריאציות"}
        </button>
      </div>

      {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded p-2 text-xs mb-3">⚠ {err}</div>}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((it, i) => {
            const savedId = savedIds.get(i);
            return (
              <div key={i} className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase text-purple-400 font-semibold">וריאציה {i + 1}</span>
                  {savedId ? (
                    <a href={`/learn/sources/${savedId}`} className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium px-2 py-1 rounded hover:bg-emerald-500/30">
                      ✓ נשמר · פתח ←
                    </a>
                  ) : (
                    <button
                      onClick={() => saveItem(i)}
                      disabled={saving === i}
                      className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-2 py-1 rounded disabled:opacity-50"
                    >
                      {saving === i ? "שומר..." : "💾 שמור למקור"}
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-100 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto" dir="ltr">
                  {it.prompt}
                </div>
                {it.rationale && (
                  <div className="mt-2 text-[11px] text-slate-400 italic">💡 {it.rationale}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!pending && items.length === 0 && (
        <p className="text-xs text-slate-500">לחץ על הכפתור כדי לבקש מ-Gemini לחולל 3 וריאציות על בסיס הפרומפט הזה + 5 דומים לו מהמערכת. כל וריאציה שתשמור תקושר למקור הזה אוטומטית.</p>
      )}
    </div>
  );
}
