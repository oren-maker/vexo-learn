"use client";

import { useState } from "react";

export default function SyncPage() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [path, setPath] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  async function onSync() {
    setBusy(true);
    setErr("");
    setResult(null);
    const res = await fetch("/api/internal/sync/cedance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": "dev-internal-key-change-me",
      },
      body: JSON.stringify({ owner, repo, path, token: token || undefined }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setErr(j.error || "שגיאה");
    else setResult(j);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">סנכרון CeDance / GitHub</h1>
      <p className="text-sm text-slate-400 mb-6">
        סנכרון פרומפטים מ-repo ציבורי ב-GitHub. כל קובץ JSON/YAML/MD יהפוך ל-LearnSource בסטטוס &ldquo;complete&rdquo;.
      </p>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Owner</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="organization or user"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Repo</label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="repo-name"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Path</label>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="prompts"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">GitHub Token (אופציונלי)</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_... (לא חובה ל-repos ציבוריים)"
            type="password"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          onClick={onSync}
          disabled={busy || !owner || !repo || !path}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-50 w-fit"
        >
          {busy ? "מסנכרן..." : "🔄 הפעל סנכרון"}
        </button>

        {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">{err}</div>}

        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-sm">
            <div className="text-emerald-300 font-semibold mb-2">✅ הסנכרון הושלם</div>
            <div className="text-slate-300">קבצים שנסרקו: {result.fetched}</div>
            <div className="text-slate-300">פרומפטים שנשמרו: {result.upserted}</div>
            {result.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="text-amber-300 cursor-pointer">שגיאות ({result.errors.length})</summary>
                <ul className="mt-2 text-xs text-slate-400 list-disc pr-4">
                  {result.errors.map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
        💡 <b>טיפ:</b> לאחר שתספק לי את ה-repo של CeDance (owner/repo/path), ניתן גם להוסיף cron יומי אוטומטי.
      </div>
    </div>
  );
}
