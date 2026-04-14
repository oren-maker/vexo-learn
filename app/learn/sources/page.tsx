import Link from "next/link";
import { prisma } from "@/lib/db";
import StatusBadge from "@/components/status-badge";
import RefreshButton from "@/components/refresh-button";
import DeleteSourceButton from "@/components/delete-source-button";

export const dynamic = "force-dynamic";

export default async function SourcesManager() {
  const [sources, total, withAnalysis, withVideo, byAddedBy, nodeCount] = await Promise.all([
    prisma.learnSource.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.learnSource.count(),
    prisma.learnSource.count({ where: { analysis: { is: {} } } }),
    prisma.learnSource.count({ where: { blobUrl: { not: null } } }),
    prisma.learnSource.groupBy({
      by: ["addedBy"],
      _count: true,
      orderBy: { _count: { addedBy: "desc" } },
      take: 30,
    }),
    prisma.knowledgeNode.count(),
  ]);

  // Categorize sources by origin
  let imported = 0;
  let aiGenerated = 0;
  let manual = 0;
  for (const row of byAddedBy) {
    const name = (row.addedBy || "").toLowerCase();
    const n = row._count as unknown as number;
    if (name.includes("compose") || name.includes("variation") || name.includes("gemini")) aiGenerated += n;
    else if (name === "manual" || name === "bulk-import" || name === "json-import" || name === "csv-import") manual += n;
    else imported += n; // seedance-sync, sora-ease, hr98w, etc.
  }

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">מקורות</h1>
          <p className="text-sm text-slate-400 mt-1">ניהול כל המקורות שהוזנו למערכת.</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Link
            href="/learn/sources/new"
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium px-5 py-2 rounded-lg text-sm"
          >
            ➕ הוסף URL
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard value={total} label="פרומפטים במאגר" accent="white" hint="סה״כ LearnSources" />
        <StatCard value={withAnalysis} label="נותחו ללמידה" accent="cyan" hint={`${Math.round((withAnalysis / Math.max(total, 1)) * 100)}% מהמאגר`} />
        <StatCard value={nodeCount} label="Knowledge Nodes" accent="purple" hint="זמינים ל-AI Director" />
        <StatCard value={aiGenerated} label="נוצרו ב-AI" accent="emerald" hint="compose + variations" />
        <StatCard value={imported} label="יובאו ממקורות" accent="amber" hint="Seedance, Sora…" />
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">פילוח לפי מקור</div>
        <div className="flex flex-wrap gap-2">
          {byAddedBy.slice(0, 12).map((row) => {
            const name = row.addedBy || "(ללא מקור)";
            return (
              <span key={name} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
                {prettyAddedBy(name)} <span className="text-slate-500">· {(row._count as unknown as number)}</span>
              </span>
            );
          })}
        </div>
        {withVideo > 0 && (
          <div className="text-[11px] text-slate-500 mt-3">
            🎬 {withVideo} מקורות כוללים קישור לוידאו דוגמה · ✍️ {manual} הועלו ידנית
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-right text-xs text-slate-400 uppercase">
              <th className="px-4 py-3">סטטוס</th>
              <th className="px-4 py-3">כותרת / פרומפט</th>
              <th className="px-4 py-3">סוג</th>
              <th className="px-4 py-3">נוצר</th>
              <th className="px-4 py-3 text-left">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3">
                  <div className="font-medium text-white line-clamp-1">{s.title || "—"}</div>
                  <div className="text-xs text-slate-400 line-clamp-1">{s.prompt}</div>
                  {s.error && <div className="text-xs text-red-400 mt-1">⚠ {s.error}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{s.type}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(s.createdAt).toLocaleDateString("he-IL")}
                </td>
                <td className="px-4 py-3 text-left">
                  <div className="flex gap-2 justify-end">
                    <Link href={`/learn/sources/${s.id}`} className="text-cyan-400 hover:underline text-xs">
                      פתח
                    </Link>
                    <DeleteSourceButton id={s.id} />
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  אין מקורות. <Link href="/learn/sources/new" className="text-cyan-400 underline">הוסף ראשון</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {total > sources.length && (
          <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-800 bg-slate-900/40">
            מציג {sources.length} מתוך {total} — יש {total - sources.length} נוספים
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label, accent, hint }: { value: number; label: string; accent: "white" | "cyan" | "purple" | "emerald" | "amber"; hint?: string }) {
  const colorMap = {
    white: "text-white",
    cyan: "text-cyan-300",
    purple: "text-purple-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
  };
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className={`text-3xl font-black ${colorMap[accent]}`}>{value.toLocaleString()}</div>
      <div className="text-sm text-slate-300 mt-1">{label}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function prettyAddedBy(raw: string): string {
  const map: Record<string, string> = {
    "seedance-sync": "🎬 Seedance",
    "sora-ease": "🎭 SoraEase",
    "awesome-sora-prompts (hr98w)": "📘 hr98w Sora",
    "awesome-sora-prompts (xjpp22)": "📗 xjpp22 Sora",
    "awesome-ai-video-prompts": "📕 AI Video",
    "gemini-compose": "✨ חולל AI",
    "bulk-import": "📥 ייבוא JSON",
    "json-import": "📥 JSON",
    "csv-import": "📊 CSV",
    "manual": "✍️ ידני",
  };
  if (map[raw]) return map[raw];
  if (raw.startsWith("aivideo")) return "📕 AI Video";
  if (raw.startsWith("sora-")) return "📘 Sora";
  if (raw.includes("variation")) return "🔁 וריאציה";
  return raw.slice(0, 25);
}
