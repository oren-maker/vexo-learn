"use client";

import { useState, useTransition } from "react";
import { generateImageAction } from "@/app/learn/sources/[id]/actions";

export default function GenerateImageButton({ sourceId }: { sourceId: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [cost, setCost] = useState<number | null>(null);

  function run() {
    if (!confirm("יצירת תמונה עולה כ-$0.039. להמשיך?")) return;
    setErr(""); setUrl(null); setCost(null);
    startTransition(async () => {
      const r = await generateImageAction(sourceId);
      if (!r.ok) setErr(r.error);
      else {
        setUrl(r.imageUrl);
        setCost(r.cost);
        setTimeout(() => window.location.reload(), 1200);
      }
    });
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={pending}
        className="bg-gradient-to-l from-amber-500 to-pink-500 hover:opacity-90 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
      >
        {pending ? "🎨 יוצר תמונה..." : "🎨 צור תמונה (nano-banana)"}
      </button>
      {url && cost !== null && (
        <div className="text-[11px] text-emerald-400 mt-2">✓ נוצר · עלות: ${cost.toFixed(4)}</div>
      )}
      {err && <div className="text-[11px] text-red-400 mt-2 max-w-md">⚠ {err}</div>}
    </div>
  );
}
