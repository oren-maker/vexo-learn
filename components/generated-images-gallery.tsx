import { prisma } from "@/lib/db";

export default async function GeneratedImagesGallery({ sourceId }: { sourceId: string }) {
  const images = await prisma.generatedImage.findMany({
    where: { sourceId },
    orderBy: { createdAt: "desc" },
  });

  if (images.length === 0) return null;

  const totalCost = images.reduce((s, i) => s + i.usdCost, 0);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider">
          🎨 תמונות שחוללו ({images.length})
        </h2>
        <span className="text-xs text-slate-400">עלות מצטברת: <b className="text-amber-300">${totalCost.toFixed(4)}</b></span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {images.map((img) => (
          <figure key={img.id} className="bg-slate-950/50 rounded-lg overflow-hidden border border-slate-800">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.blobUrl} alt="" className="w-full h-48 object-cover" />
              <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
                <span className="text-[10px] font-mono bg-slate-950/85 text-cyan-300 px-2 py-1 rounded backdrop-blur border border-cyan-500/30">
                  {img.model}
                </span>
                <span className="text-[10px] font-mono bg-slate-950/85 text-amber-300 px-2 py-1 rounded backdrop-blur border border-amber-500/30">
                  ${img.usdCost.toFixed(4)}
                </span>
              </div>
            </div>
            <figcaption className="p-2 text-[10px] text-slate-500 flex items-center justify-between">
              <span>
                {new Date(img.createdAt).toLocaleDateString("he-IL")} · {new Date(img.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <a href={img.blobUrl} target="_blank" download className="text-cyan-400 hover:underline">
                ⬇ הורד
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
