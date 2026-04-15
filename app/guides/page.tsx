import Link from "next/link";
import { prisma } from "@/lib/db";
import { isValidLang, DEFAULT_LANG, isRtl } from "@/lib/guide-languages";
import LanguagePicker from "@/components/guides/language-picker";

export const dynamic = "force-dynamic";

export default async function GuidesLibraryPage({ searchParams }: { searchParams: { lang?: string; category?: string } }) {
  const lang = isValidLang(searchParams.lang || "") ? (searchParams.lang as string) : DEFAULT_LANG;
  const category = searchParams.category || undefined;

  const guides = await prisma.guide.findMany({
    where: {
      status: { in: ["draft", "published"] },
      ...(category ? { category } : {}),
    },
    include: { translations: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const categories = Array.from(new Set(guides.map((g) => g.category).filter(Boolean))) as string[];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">📖 ספריית מדריכים</h1>
          <p className="text-sm text-slate-400 mt-1">מדריכים מובנים בעברית ועוד 4 שפות, עם תמונות, שלבים, וייצוא ל-PDF.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LanguagePicker current={lang} />
          <Link href="/guides/new" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm">
            ➕ מדריך חדש
          </Link>
        </div>
      </header>

      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap text-xs">
          <span className="text-slate-500">קטגוריות:</span>
          <Link href={`/guides?lang=${lang}`} className={`px-3 py-1 rounded-full border ${!category ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
            הכל
          </Link>
          {categories.map((c) => (
            <Link key={c} href={`/guides?lang=${lang}&category=${encodeURIComponent(c)}`} className={`px-3 py-1 rounded-full border ${category === c ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
              {c}
            </Link>
          ))}
        </div>
      )}

      {guides.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <div className="text-5xl mb-3">📖</div>
          <h2 className="text-lg font-semibold text-white mb-1">אין עדיין מדריכים</h2>
          <p className="text-sm text-slate-400 mb-4">צור את הראשון</p>
          <Link href="/guides/new" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-sm">
            ➕ מדריך חדש
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((g) => {
            const t = g.translations.find((x) => x.lang === lang) || g.translations.find((x) => x.lang === g.defaultLang) || g.translations[0];
            const dir = isRtl(t?.lang || g.defaultLang) ? "rtl" : "ltr";
            return (
              <Link
                key={g.id}
                href={`/guides/${g.slug}?lang=${lang}`}
                className="bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 rounded-xl overflow-hidden transition group"
                dir={dir}
              >
                <div className="aspect-video bg-slate-800 overflow-hidden">
                  {g.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-5xl text-slate-700">📖</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1 text-[10px]">
                    {g.category && <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">{g.category}</span>}
                    {g.estimatedMinutes && <span className="text-slate-500">⏱ {g.estimatedMinutes} דק׳</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">{t?.title || "(ללא כותרת)"}</h3>
                  {t?.description && <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>}
                  {t?.isAuto && <span className="text-[9px] text-amber-400 mt-1 inline-block">🤖 תרגום AI</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
