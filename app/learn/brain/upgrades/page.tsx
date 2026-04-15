import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BrainUpgradesPage() {
  const upgrades = await prisma.brainUpgradeRequest.findMany({
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const pending = upgrades.filter((u) => u.status === "pending").length;
  const done = upgrades.filter((u) => u.status === "done").length;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/learn/brain" className="text-xs text-slate-400 hover:text-cyan-400">← חזרה למוח</Link>
          <h1 className="text-3xl font-bold text-white mt-1">🔧 בקשות שדרוג</h1>
          <p className="text-sm text-slate-400 mt-1">
            הוראות ששלחת למוח נשמרות כאן. Claude מיישם אותן בשדרוגים הבאים של המערכת.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/40 px-3 py-1 rounded">
            ⏳ ממתין: {pending}
          </span>
          <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded">
            ✓ הושלם: {done}
          </span>
        </div>
      </header>

      {upgrades.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 text-center text-sm text-slate-400">
          עדיין אין בקשות שדרוג. דבר עם המוח ב-<Link href="/learn/brain/chat" className="text-cyan-400 underline">/learn/brain/chat</Link> ותן הוראות.
        </div>
      ) : (
        <div className="space-y-2">
          {upgrades.map((u) => (
            <div
              key={u.id}
              className={`rounded-lg p-4 border ${
                u.status === "pending" ? "bg-amber-500/5 border-amber-500/30" :
                u.status === "in-progress" ? "bg-cyan-500/5 border-cyan-500/30" :
                u.status === "done" ? "bg-emerald-500/5 border-emerald-500/30 opacity-70" :
                "bg-slate-900/60 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <span className="text-[10px] uppercase font-semibold tracking-wider">
                  {u.status === "pending" && "⏳ ממתין"}
                  {u.status === "in-progress" && "🔄 בעבודה"}
                  {u.status === "done" && "✓ הושלם"}
                  {u.status === "rejected" && "✗ נדחה"}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(u.createdAt).toLocaleString("he-IL")}
                </span>
              </div>
              <div className="text-sm text-slate-100 whitespace-pre-wrap">{u.instruction}</div>
              {u.claudeNotes && (
                <div className="mt-2 text-xs text-slate-400 border-t border-slate-800 pt-2">
                  <span className="text-emerald-400 font-semibold">📝 ביצוע:</span> {u.claudeNotes}
                </div>
              )}
              {u.chatId && (
                <Link
                  href={`/learn/brain/chat?id=${u.chatId}`}
                  className="text-[10px] text-cyan-400 hover:underline mt-2 inline-block"
                >
                  מקור: שיחה ←
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
