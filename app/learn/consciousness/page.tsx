import Link from "next/link";
import { prisma } from "@/lib/db";
import TriggerImprovementButton from "./trigger-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConsciousnessPage() {
  const [snapshots, improvementRuns, versionCount, sourcesWithVersions, topImprovedSources] = await Promise.all([
    prisma.insightsSnapshot.findMany({
      orderBy: { takenAt: "desc" },
      take: 48,
    }),
    prisma.improvementRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.promptVersion.count(),
    prisma.promptVersion.groupBy({
      by: ["sourceId"],
      _count: true,
    }),
    prisma.promptVersion.groupBy({
      by: ["sourceId"],
      _count: true,
      orderBy: { _count: { sourceId: "desc" } },
      take: 10,
    }),
  ]);

  // Gather per-run details: PromptVersions created with triggeredBy=auto-improve, grouped by snapshotId
  const autoImproveVersions = await prisma.promptVersion.findMany({
    where: { triggeredBy: "auto-improve" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, sourceId: true, snapshotId: true, reason: true, version: true, createdAt: true },
  });
  const versionsBySnapshot: Record<string, typeof autoImproveVersions> = {};
  for (const v of autoImproveVersions) {
    if (!v.snapshotId) continue;
    (versionsBySnapshot[v.snapshotId] ||= []).push(v);
  }

  const allSourceIds = Array.from(
    new Set([
      ...topImprovedSources.map((s) => s.sourceId),
      ...autoImproveVersions.map((v) => v.sourceId),
    ]),
  );
  const sourceMap = allSourceIds.length
    ? await prisma.learnSource.findMany({
        where: { id: { in: allSourceIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById: Record<string, string | null> = {};
  for (const s of sourceMap) titleById[s.id] = s.title;

  const latest = snapshots[0];
  const totalImprovementCost = improvementRuns.reduce((s, r) => s + r.totalCostUsd, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">🧠 תודעה</h1>
        <p className="text-sm text-slate-400 mt-1">
          יומן עבר של המערכת: snapshots של תובנות, השוואות, שדרוגי פרומפטים אוטומטיים. <b>כלום לא נמחק — הכל נשמר.</b>
        </p>
      </header>

      {snapshots.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <h2 className="text-lg font-semibold text-white mb-1">אין עדיין snapshots</h2>
          <p className="text-sm text-slate-400">ה-cron רץ כל שעה. הsnapshot הראשון יופיע ברגע שמגיע לשעה העגולה הבאה.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Kpi value={snapshots.length.toString()} label="Snapshots" accent="cyan" hint="48 אחרונים" />
            <Kpi value={versionCount.toString()} label="גרסאות פרומפטים" accent="purple" hint={`${sourcesWithVersions.length} מקורות`} />
            <Kpi value={improvementRuns.length.toString()} label="הרצות Auto-Improve" accent="emerald" />
            <Kpi value={`$${totalImprovementCost.toFixed(4)}`} label="עלות שדרוגים" accent="amber" />
          </div>

          {latest && <TriggerImprovementButton snapshotId={latest.id} />}

          <Section title="ציר זמן Snapshots" subtitle="כל עמודה = snapshot שעתי. גובה = כמות Knowledge Nodes">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-end gap-1 h-24">
                {snapshots.slice().reverse().map((s) => {
                  const max = Math.max(...snapshots.map((x) => x.nodesCount), 1);
                  const h = Math.max(6, (s.nodesCount / max) * 90);
                  return (
                    <div
                      key={s.id}
                      className="flex-1 bg-gradient-to-t from-cyan-500 to-purple-500 rounded-t cursor-help relative group"
                      style={{ height: `${h}px` }}
                      title={`${new Date(s.takenAt).toLocaleString("he-IL")} · ${s.sourcesCount} sources · ${s.nodesCount} nodes · ${s.avgTechniques} avg tech`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                <span>{snapshots.length > 1 && new Date(snapshots[snapshots.length - 1].takenAt).toLocaleString("he-IL", { month: "2-digit", day: "2-digit" })}</span>
                <span>עכשיו</span>
              </div>
            </div>
          </Section>

          <Section title="יומן שינויים בתובנות" subtitle="מה השתנה בין snapshot לקודמו">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/60 text-right text-[10px] text-slate-400 uppercase">
                    <th className="px-3 py-2">זמן</th>
                    <th className="px-3 py-2">מקורות</th>
                    <th className="px-3 py-2">Nodes</th>
                    <th className="px-3 py-2">ממוצע טכניקות</th>
                    <th className="px-3 py-2">סיכום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {snapshots.slice(0, 20).map((s) => {
                    const delta = s.delta as any;
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">
                          {new Date(s.takenAt).toLocaleString("he-IL", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 text-white">
                          {s.sourcesCount}
                          {delta?.sourcesAdded !== undefined && delta.sourcesAdded !== 0 && (
                            <span className={`text-[10px] mr-1 ${delta.sourcesAdded > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              ({delta.sourcesAdded > 0 ? "+" : ""}{delta.sourcesAdded})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-white">
                          {s.nodesCount}
                          {delta?.nodesAdded !== undefined && delta.nodesAdded !== 0 && (
                            <span className={`text-[10px] mr-1 ${delta.nodesAdded > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              ({delta.nodesAdded > 0 ? "+" : ""}{delta.nodesAdded})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{s.avgTechniques}</td>
                        <td className="px-3 py-2 text-slate-400">{s.summary || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {latest?.delta && (latest.delta as any).sourcesAdded !== undefined && (
            <Section title="שינויים ב-snapshot האחרון" subtitle={new Date(latest.takenAt).toLocaleString("he-IL")}>
              <DeltaPanel delta={latest.delta as any} />
            </Section>
          )}

          <Section title="הרצות Auto-Improvement" subtitle="שדרוגי פרומפטים שהמערכת הפעילה על עצמה">
            {improvementRuns.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 text-center text-sm text-slate-500">
                אין עדיין הרצות. השתמש בכפתור ההפעלה למעלה או המתן לריצה האוטומטית.
              </div>
            ) : (
              <ul className="space-y-2">
                {improvementRuns.map((r) => {
                  const versions = versionsBySnapshot[r.snapshotId] || [];
                  return (
                    <li key={r.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <Link href={`/learn/logs/improvement/${r.id}`} className="text-slate-200 font-medium hover:text-cyan-300">
                            {r.summary || "—"}
                          </Link>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(r.startedAt).toLocaleString("he-IL")} · משך {r.completedAt ? Math.round((r.completedAt.getTime() - r.startedAt.getTime()) / 1000) : "—"}s · {r.status} · נבדקו {r.sourcesExamined} · שודרגו {r.sourcesImproved}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/learn/logs/improvement/${r.id}`} className="text-[11px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-1 rounded">
                            תוצאות →
                          </Link>
                          <div className="text-amber-300 font-mono">${r.totalCostUsd.toFixed(4)}</div>
                        </div>
                      </div>
                      {versions.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-[11px] text-cyan-400 cursor-pointer hover:underline">
                            הצג {versions.length} פרומפטים ששודרגו
                          </summary>
                          <ul className="mt-2 space-y-1 pr-3 border-r border-slate-800">
                            {versions.map((v) => (
                              <li key={v.id} className="text-xs">
                                <Link href={`/learn/sources/${v.sourceId}/logs`} className="flex items-start justify-between gap-3 bg-slate-950/40 hover:bg-slate-900 rounded p-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium truncate">{titleById[v.sourceId] || "(ללא כותרת)"}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{v.reason || "—"}</div>
                                  </div>
                                  <span className="text-[10px] text-purple-300 font-mono shrink-0">v{v.version}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {topImprovedSources.length > 0 && (
            <Section title="פרומפטים ששודרגו הכי הרבה">
              <ul className="space-y-1">
                {topImprovedSources.map((s) => (
                  <li key={s.sourceId}>
                    <Link
                      href={`/learn/sources/${s.sourceId}`}
                      className="flex items-center justify-between bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-sm"
                    >
                      <span className="text-white">{titleById[s.sourceId] || "(ללא כותרת)"}</span>
                      <span className="text-xs text-cyan-300 font-mono">{s._count} גרסאות</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ value, label, accent, hint }: { value: string; label: string; accent: "cyan" | "purple" | "emerald" | "amber"; hint?: string }) {
  const colorMap = {
    cyan: "text-cyan-300",
    purple: "text-purple-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
  };
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className={`text-3xl font-black ${colorMap[accent]}`}>{value}</div>
      <div className="text-sm text-slate-300 mt-1">{label}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

function DeltaPanel({ delta }: { delta: any }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
        <DeltaStat label="מקורות שנוספו" value={delta.sourcesAdded ?? 0} />
        <DeltaStat label="Nodes שנוספו" value={delta.nodesAdded ?? 0} />
        <DeltaStat label="שינוי ממוצע טכניקות" value={delta.avgTechniquesChange ?? 0} />
      </div>

      {delta.newTechniques?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase text-emerald-400 mb-1">🆕 טכניקות חדשות</div>
          <div className="flex flex-wrap gap-1">
            {delta.newTechniques.map((t: any) => (
              <span key={t.name} className="text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                {t.name} · +{t.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {delta.risingTechniques?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase text-cyan-400 mb-1">📈 טכניקות שעולות</div>
          <div className="flex flex-wrap gap-1">
            {delta.risingTechniques.slice(0, 6).map((t: any) => (
              <span key={t.name} className="text-[11px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
                {t.name} +{t.deltaCount}
              </span>
            ))}
          </div>
        </div>
      )}

      {delta.newStyles?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase text-purple-400 mb-1">🎨 סגנונות חדשים</div>
          <div className="flex flex-wrap gap-1">
            {delta.newStyles.map((s: any) => (
              <span key={s.name} className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {delta.newRules?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase text-amber-400 mb-1">💡 כללים חדשים שנגזרו</div>
          <ul className="text-xs text-slate-200 space-y-1">
            {delta.newRules.map((r: string, i: number) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function DeltaStat({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-slate-400";
  const sign = value > 0 ? "+" : "";
  return (
    <div className="bg-slate-950/50 rounded-lg p-3">
      <div className={`text-2xl font-bold ${color}`}>{sign}{value}</div>
      <div className="text-[10px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}
