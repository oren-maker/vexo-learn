"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FileUpload from "@/components/file-upload";

export default function AddSource() {
  const router = useRouter();
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onUrlSubmit(e: React.FormEvent) {
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
        העלה קובץ וידאו או הזן URL ישיר. המערכת תשלח ל-Gemini לניתוח ותחלץ ידע.
      </p>

      <div className="flex gap-2 mb-5 bg-slate-900/60 border border-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode("upload")}
          className={`px-4 py-2 rounded text-sm font-medium transition ${
            mode === "upload" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📤 העלאת קובץ
        </button>
        <button
          onClick={() => setMode("url")}
          className={`px-4 py-2 rounded text-sm font-medium transition ${
            mode === "url" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🔗 URL ישיר
        </button>
      </div>

      {mode === "upload" ? (
        <FileUpload />
      ) : (
        <form onSubmit={onUrlSubmit} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">URL ישיר למקור וידאו *</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
              placeholder="https://videos.pexels.com/.../video.mp4"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              מותרים: Pexels, Pixabay, Vercel Blob, URL ישיר ל-MP4/webm. YouTube/Vimeo לא נתמכים ב-serverless.
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">הפרומפט של המדריך *</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              rows={5}
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
        </form>
      )}
    </div>
  );
}
