import { prisma } from "@/lib/db";

export default async function GeneratedVideosGallery({ sourceId }: { sourceId: string }) {
  const videos = await prisma.generatedVideo.findMany({
    where: { sourceId },
    orderBy: { createdAt: "desc" },
  });
  if (videos.length === 0) return null;

  const totalCost = videos.reduce((s, v) => s + v.usdCost, 0);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-pink-300 uppercase tracking-wider">
          🎬 סרטונים שחוללו ({videos.length})
        </h2>
        <span className="text-xs text-slate-400">עלות מצטברת: <b className="text-amber-300">${totalCost.toFixed(2)}</b></span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {videos.map((v) => (
          <figure key={v.id} className="bg-slate-950/50 rounded-lg overflow-hidden border border-slate-800">
            <div className="relative bg-black">
              {v.status === "complete" && v.blobUrl ? (
                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                <video src={v.blobUrl} controls className="w-full aspect-video" />
              ) : v.status === "processing" ? (
                <div className="aspect-video flex items-center justify-center text-sm text-slate-400">
                  <span className="animate-pulse">🎬 יוצר... (1-3 דקות)</span>
                </div>
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center text-xs text-red-300 p-4">
                  <div>❌ {v.status}</div>
                  {v.error && <div className="mt-1 text-slate-500 text-[10px] line-clamp-3">{v.error}</div>}
                </div>
              )}
              <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
                <span className="text-[10px] font-mono bg-slate-950/85 text-pink-300 px-2 py-1 rounded backdrop-blur border border-pink-500/30">
                  {v.model.replace("veo-3.0-", "").replace("-preview", "")}
                </span>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-mono bg-slate-950/85 text-amber-300 px-2 py-1 rounded backdrop-blur border border-amber-500/30">
                    ${v.usdCost.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-950/85 text-slate-300 px-2 py-0.5 rounded backdrop-blur">
                    {v.durationSec}s · {v.aspectRatio}
                  </span>
                </div>
              </div>
            </div>
            <figcaption className="p-2 text-[10px] text-slate-500 flex items-center justify-between">
              <span>{new Date(v.createdAt).toLocaleDateString("he-IL")} · {new Date(v.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
              {v.blobUrl && (
                <a href={v.blobUrl} target="_blank" download className="text-pink-400 hover:underline">⬇ הורד</a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
