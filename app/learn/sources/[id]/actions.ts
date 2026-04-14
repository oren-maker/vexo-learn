"use server";

import { prisma } from "@/lib/db";
import { extractInstagram } from "@/lib/instagram";
import { extractPromptFromVideo } from "@/lib/gemini-prompt-from-video";
import { generatePromptWithClaude } from "@/lib/claude-prompt";
import { revalidatePath } from "next/cache";

function isQuotaError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("expired") || msg.includes("403");
}

// Retry analysis for a failed source. Re-fetches caption/thumbnail from the original
// Instagram URL if available, then tries Gemini video → Claude fallback.
export async function retryAnalysisAction(sourceId: string) {
  const source = await prisma.learnSource.findUnique({ where: { id: sourceId } });
  if (!source) return { ok: false as const, error: "source not found" };
  if (!source.blobUrl) return { ok: false as const, error: "אין video URL לניתוח" };

  await prisma.learnSource.update({
    where: { id: sourceId },
    data: { status: "processing", error: null },
  });

  // Re-fetch Instagram caption + thumbnail if URL is an IG reel
  let caption: string | null = null;
  let thumbnail: string | null = source.thumbnail;
  if (source.url && /instagram\.com/.test(source.url)) {
    try {
      const ig = await extractInstagram(source.url);
      caption = ig.caption;
      if (!thumbnail) thumbnail = ig.thumbnail;
    } catch {
      // ignore, work with what we have
    }
  }

  let analyzed;
  let engine = "gemini-video";
  try {
    analyzed = await extractPromptFromVideo(source.blobUrl, caption || source.prompt);
  } catch (e: any) {
    if (isQuotaError(e)) {
      try {
        analyzed = await generatePromptWithClaude(caption || source.prompt, thumbnail);
        engine = "claude-fallback";
      } catch (e2: any) {
        await prisma.learnSource.update({
          where: { id: sourceId },
          data: { status: "failed", error: `רטריי נכשל: Gemini quota + Claude: ${String(e2.message || e2).slice(0, 200)}` },
        });
        return { ok: false as const, error: `שני המנועים נכשלו. נסה שוב מאוחר יותר או enable billing ב-Gemini.` };
      }
    } else {
      await prisma.learnSource.update({
        where: { id: sourceId },
        data: { status: "failed", error: String(e.message || e).slice(0, 500) },
      });
      return { ok: false as const, error: String(e.message || e).slice(0, 200) };
    }
  }

  // Save analysis + knowledge nodes
  // Remove existing analysis if any
  await prisma.videoAnalysis.deleteMany({ where: { sourceId } });

  const analysis = await prisma.videoAnalysis.create({
    data: {
      sourceId,
      description: analyzed.captionEnglish || analyzed.generatedPrompt.slice(0, 300),
      techniques: analyzed.techniques,
      howTo: [],
      tags: analyzed.tags,
      style: analyzed.style,
      mood: analyzed.mood,
      difficulty: null,
      insights: [],
      promptAlignment: null,
      rawGemini: JSON.stringify({ engine, ...analyzed }),
    },
  });

  const nodes = analyzed.techniques.map((t: string) => ({
    type: "technique",
    title: t.slice(0, 120),
    body: t,
    tags: [...analyzed.tags, analyzed.style || ""].filter(Boolean),
    confidence: 0.85,
    analysisId: analysis.id,
  }));
  if (nodes.length > 0) await prisma.knowledgeNode.createMany({ data: nodes });

  await prisma.learnSource.update({
    where: { id: sourceId },
    data: {
      prompt: analyzed.generatedPrompt,
      title: analyzed.title || source.title,
      thumbnail: thumbnail || source.thumbnail,
      status: "complete",
      error: null,
    },
  });

  revalidatePath(`/learn/sources/${sourceId}`);
  revalidatePath("/learn/sources");
  return { ok: true as const, engine, title: analyzed.title };
}
