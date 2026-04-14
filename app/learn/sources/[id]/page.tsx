import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma, jsonArray } from "@/lib/db";
import StatusBadge from "@/components/status-badge";
import AutoRefresh from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function SourceDetail({ params }: { params: { id: string } }) {
  const source = await prisma.learnSource.findUnique({
    where: { id: params.id },
    include: { analysis: { include: { knowledgeNodes: true } } },
  });
  if (!source) notFound();

  const isLive = source.status === "pending" || source.status === "processing";

  return (
    <div className="max-w-5xl mx-auto">
      {isLive && <AutoRefresh intervalMs={5000} />}

      <div className="mb-5">
        <Link href="/learn/sources" className="text-xs text-slate-400 hover:text-cyan-400">
          ← חזרה למקורות
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="md:w-1/3">
          {source.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.thumbnail} alt="" className="w-full rounded-xl border border-slate-800" />
          ) : (
            <div className="aspect-video bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-5xl text-slate-700">🎬</div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={source.status} />
            <span className="text-[11px] text-slate-500">{source.type}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {source.title || "ממתין ל-metadata..."}
          </h1>
          {source.url && (
            <a href={source.url} target="_blank" className="text-xs text-cyan-400 hover:underline break-all">
              {source.url}
            </a>
          )}
          <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-500 uppercase mb-1">פרומפט מקורי</div>
            <div className="text-sm text-slate-200 whitespace-pre-wrap">{source.prompt}</div>
          </div>
          {source.error && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">
              ⚠ {source.error}
            </div>
          )}
          {isLive && (
            <div className="mt-3 text-sm text-amber-300 flex items-center gap-2">
              <span className="animate-pulse">⚙️</span>
              Pipeline רץ ברקע... הדף יתרענן אוטומטית.
            </div>
          )}
        </div>
      </div>

      {source.analysis && (
        <section className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3">תיאור הסרטון</h2>
            <p className="text-slate-200 leading-relaxed">{source.analysis.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="סגנון" value={source.analysis.style || "—"} />
            <Stat label="מצב רוח" value={source.analysis.mood || "—"} />
            <Stat label="רמת קושי" value={source.analysis.difficulty || "—"} />
          </div>

          {source.analysis.promptAlignment != null && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
              <div className="text-sm text-slate-400">התאמה לפרומפט:</div>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-cyan-400 to-blue-500"
                  style={{ width: `${source.analysis.promptAlignment * 10}%` }}
                />
              </div>
              <div className="font-bold text-cyan-300">{source.analysis.promptAlignment}/10</div>
            </div>
          )}

          <ListSection title="טכניקות" items={jsonArray.parse(source.analysis.techniques)} color="cyan" />
          <ListSection title="How-To" items={jsonArray.parse(source.analysis.howTo)} color="blue" numbered />
          <ListSection title="תובנות" items={jsonArray.parse(source.analysis.insights)} color="emerald" />
          <TagsSection tags={jsonArray.parse(source.analysis.tags)} />

          {source.analysis.knowledgeNodes.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3">
                Knowledge Nodes ({source.analysis.knowledgeNodes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {source.analysis.knowledgeNodes.map((n) => (
                  <div key={n.id} className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase text-cyan-400 font-semibold">{n.type}</span>
                      <span className="text-[10px] text-slate-500">
                        {Math.round(n.confidence * 100)}% · {n.sentToDirector ? "✅ נשלח" : "⏳ בהמתנה"}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white">{n.title}</div>
                    <div className="text-xs text-slate-400 line-clamp-2 mt-1">{n.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="text-[11px] text-slate-500 uppercase mb-1">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function ListSection({ title, items, color, numbered }: { title: string; items: string[]; color: "cyan" | "blue" | "emerald"; numbered?: boolean }) {
  if (items.length === 0) return null;
  const colorMap = {
    cyan: "text-cyan-300 border-cyan-500/30 bg-cyan-500/5",
    blue: "text-blue-300 border-blue-500/30 bg-blue-500/5",
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5",
  };
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className={`flex gap-3 items-start text-sm text-slate-200 p-3 rounded border ${colorMap[color]}`}>
            {numbered && <span className="font-bold shrink-0">{i + 1}.</span>}
            {!numbered && <span className="shrink-0">•</span>}
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagsSection({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3">תגיות</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="text-xs bg-cyan-500/10 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/20">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
