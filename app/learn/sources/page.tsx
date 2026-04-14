import Link from "next/link";
import { prisma } from "@/lib/db";
import StatusBadge from "@/components/status-badge";
import RefreshButton from "@/components/refresh-button";
import DeleteSourceButton from "@/components/delete-source-button";

export const dynamic = "force-dynamic";

export default async function SourcesManager() {
  const sources = await prisma.learnSource.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

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
      </div>
    </div>
  );
}
