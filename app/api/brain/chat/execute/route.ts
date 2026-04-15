import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { scrapeGuideFromUrl } from "@/lib/guide-scraper";
import { extractInstagram } from "@/lib/instagram";
import { generateGuideFromTopic } from "@/lib/guide-ai";
import { translateGuideToLang } from "@/lib/translate";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u0590-\u05FF\u0600-\u06FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  try {
    const { action, chatId } = await req.json();
    if (!action?.type) return NextResponse.json({ error: "action.type required" }, { status: 400 });

    let resultText = "";
    let resultUrl: string | null = null;

    if (action.type === "import_guide_url") {
      const scraped = await scrapeGuideFromUrl(action.url);
      const lang = action.lang || "he";
      const slug = `${slugify(scraped.title) || "guide"}-${Date.now().toString(36).slice(-4)}`;
      const guide = await prisma.guide.create({
        data: {
          slug, defaultLang: lang, status: "draft", isPublic: true,
          source: "url-import", sourceUrl: action.url, coverImageUrl: scraped.coverImageUrl,
          translations: { create: { lang, title: scraped.title, description: scraped.description, isAuto: false } },
          stages: scraped.stages.length > 0 ? {
            create: scraped.stages.map((s, i) => ({
              order: i,
              type: i === 0 ? "start" : i === scraped.stages.length - 1 ? "end" : "middle",
              transitionToNext: "fade",
              translations: { create: { lang, title: s.title, content: s.content, isAuto: false } },
              images: s.images.length > 0 ? { create: s.images.map((u, idx) => ({ blobUrl: u, source: "url-scrape", order: idx })) } : undefined,
            })),
          } : undefined,
        },
      });
      if (lang !== "he") waitUntil(translateGuideToLang(guide.id, "he").catch(() => {}));
      resultUrl = `/guides/${guide.slug}`;
      resultText = `✅ יצרתי מדריך: "${scraped.title}" עם ${scraped.stages.length} שלבים.`;
    } else if (action.type === "ai_guide") {
      const lang = action.lang || "he";
      const ai = await generateGuideFromTopic(action.topic, lang);
      const slug = `${slugify(ai.title || action.topic) || "guide"}-${Date.now().toString(36).slice(-4)}`;
      const guide = await prisma.guide.create({
        data: {
          slug, defaultLang: lang, status: "draft", isPublic: true,
          source: "ai-generated", category: ai.category || null, estimatedMinutes: ai.estimatedMinutes || null,
          translations: { create: { lang, title: ai.title, description: ai.description, isAuto: true } },
          stages: { create: ai.stages.map((s, i) => ({ order: i, type: s.type, transitionToNext: "fade", translations: { create: { lang, title: s.title, content: s.content, isAuto: true } } })) },
        },
      });
      if (lang !== "he") waitUntil(translateGuideToLang(guide.id, "he").catch(() => {}));
      resultUrl = `/guides/${guide.slug}`;
      resultText = `✅ יצרתי מדריך AI: "${ai.title}" עם ${ai.stages.length} שלבים.`;
    } else if (action.type === "import_instagram_guide") {
      const ig = await extractInstagram(action.url);
      const lang = action.lang || "he";
      const title = (ig.caption || "Instagram guide").split(/[.!?\n]/)[0].slice(0, 200);
      const slug = `${slugify(title) || "ig-guide"}-${Date.now().toString(36).slice(-4)}`;
      const guide = await prisma.guide.create({
        data: {
          slug, defaultLang: lang, status: "draft", isPublic: true,
          source: "instagram", sourceUrl: ig.sourceUrl, coverImageUrl: ig.thumbnail,
          translations: { create: { lang, title, description: ig.caption?.slice(0, 500) || null, isAuto: false } },
          stages: ig.caption ? {
            create: [{
              order: 0, type: "start", transitionToNext: "fade",
              translations: { create: { lang, title, content: ig.caption, isAuto: false } },
              images: ig.thumbnail ? { create: [{ blobUrl: ig.thumbnail, source: "instagram", order: 0 }] } : undefined,
            }],
          } : undefined,
        },
      });
      if (lang !== "he") waitUntil(translateGuideToLang(guide.id, "he").catch(() => {}));
      resultUrl = `/guides/${guide.slug}`;
      resultText = `✅ ייבאתי מ-Instagram: "${title.slice(0, 60)}".`;
    } else if (action.type === "import_source") {
      const source = await prisma.learnSource.create({
        data: { type: "instructor_url", url: action.url, prompt: "", status: "pending", addedBy: "brain-chat" },
      });
      waitUntil(runPipeline(source.id).catch(() => {}));
      resultUrl = `/learn/sources/${source.id}`;
      resultText = `✅ יצרתי מקור חדש — רץ pipeline ברקע. תוכל לראות את הפרומפט בעוד דקה.`;
    } else {
      return NextResponse.json({ error: `unknown action type: ${action.type}` }, { status: 400 });
    }

    // Record result as brain message in the chat
    if (chatId) {
      await prisma.brainMessage.create({
        data: { chatId, role: "brain", content: `${resultText}${resultUrl ? `\n🔗 ${resultUrl}` : ""}` },
      });
      await prisma.brainChat.update({ where: { id: chatId }, data: { updatedAt: new Date(), summarizedAt: null } });
    }

    return NextResponse.json({ ok: true, text: resultText, url: resultUrl });
  } catch (e: any) {
    console.error("[brain-chat-execute]", e);
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status: 500 });
  }
}
