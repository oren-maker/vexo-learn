"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddSource() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/learn/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, prompt }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "שגיאה");
      setBusy(false);
      return;
    }
    const j = await res.json();
    router.push(`/learn/sources/${j.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">הוספת מקור</h1>
      <p className="text-sm text-slate-400 mb-6">
        הוסף URL של סרטון (YouTube, Vimeo, Pexels, Pixabay) + הפרומפט שהמדריך השתמש בו. המערכת תוריד, תנתח ותוציא ידע.
      </p>

      <form onSubmit={onSubmit} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">URL של הסרטון *</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
          <div className="text-[11px] text-slate-500 mt-1">
            מותרים: YouTube, Vimeo, Pexels, Pixabay
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">הפרומפט של המדריך *</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={6}
            placeholder="A cinematic close-up shot of..."
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">{err}</div>}

        <div className="flex gap-2">
          <button
            disabled={busy || !url || !prompt}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium px-6 py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {busy ? "שולח..." : "🚀 הפעל pipeline"}
          </button>
          <button type="button" onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2.5 rounded-lg text-sm">
            ביטול
          </button>
        </div>

        <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
          ⚠ Pipeline ירוץ ברקע: metadata → הורדה ב-yt-dlp → Gemini analysis → Knowledge extraction. עלול לקחת 2-10 דקות לפי אורך הסרטון.
        </div>
      </form>
    </div>
  );
}
