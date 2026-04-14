"use server";

import { put } from "@vercel/blob";
import { extractInstagram } from "@/lib/instagram";
import { extractPromptFromVideo } from "@/lib/gemini-prompt-from-video";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Full pipeline for an Instagram / TikTok / other social video URL:
// 1. Extract direct MP4 URL + caption + thumbnail
// 2. Re-upload the MP4 to Vercel Blob (so it persists even when IG CDN link expires)
// 3. Send video + caption to Gemini → receive generated prompt + translation + metadata
// 4. Save as LearnSource with status=complete and all the extracted data

export async function ingestSocialVideoAction(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return { ok: false as const, error: "URL ריק" };

  // Check what kind of URL it is
  const isInstagram = /(?:^|\.)instagram\.com\//i.test(url);
  if (!isInstagram) {
    return { ok: false as const, error: "רק Instagram נתמך כרגע בזרימה הזו. עבור Pexels/קובץ מקומי — השתמש בטאבים האחרים." };
  }

  try {
    // Step 1: Extract direct URL + caption
    const ig = await extractInstagram(url);
    if (!ig.videoUrl) {
      return { ok: false as const, error: "לא הצלחתי למצוא קישור ישיר לוידאו (אולי הפוסט פרטי)." };
    }

    // Step 2: Download MP4 and push to Blob so the link survives
    let blobUrl: string;
    try {
      const res = await fetch(ig.videoUrl, {
        headers: { "User-Agent": "Mozilla/5.0 vexo-learn" },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`video fetch ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const blob = await put(`instagram/${Date.now()}.mp4`, buffer, {
        access: "public",
        contentType: "video/mp4",
      });
      blobUrl = blob.url;
    } catch (e: any) {
      return { ok: false as const, error: `הורדת הוידאו נכשלה: ${String(e.message || e).slice(0, 120)}` };
    }

    // Step 3: Create pending source so we can show status
    const source = await prisma.learnSource.create({
      data: {
        type: "instructor_url",
        url: ig.sourceUrl,
        blobUrl,
        thumbnail: ig.thumbnail,
        prompt: ig.caption || "(יחולץ מהסרטון)",
        title: (ig.caption || "Instagram reel").slice(0, 150),
        status: "processing",
        addedBy: "instagram",
      },
    });

    // Step 4: Gemini — extract prompt, translate caption, pull metadata
    try {
      const analyzed = await extractPromptFromVideo(blobUrl, ig.caption);

      // Save analysis + knowledge nodes
      const analysis = await prisma.videoAnalysis.create({
        data: {
          sourceId: source.id,
          description: analyzed.captionEnglish || analyzed.generatedPrompt.slice(0, 300),
          techniques: analyzed.techniques,
          howTo: [],
          tags: analyzed.tags,
          style: analyzed.style,
          mood: analyzed.mood,
          difficulty: null,
          insights: [],
          promptAlignment: null,
          rawGemini: JSON.stringify(analyzed),
        },
      });
      const nodes = analyzed.techniques.map((t) => ({
        type: "technique",
        title: t.slice(0, 120),
        body: t,
        tags: [...analyzed.tags, analyzed.style || ""].filter(Boolean),
        confidence: 0.85,
        analysisId: analysis.id,
      }));
      if (nodes.length > 0) await prisma.knowledgeNode.createMany({ data: nodes });

      // Update source with final prompt + title
      await prisma.learnSource.update({
        where: { id: source.id },
        data: {
          prompt: analyzed.generatedPrompt,
          title: analyzed.title || source.title,
          status: "complete",
        },
      });

      revalidatePath("/learn/sources");
      revalidatePath("/learn/my-prompts");

      return {
        ok: true as const,
        id: source.id,
        title: analyzed.title,
        generatedPrompt: analyzed.generatedPrompt,
        captionEnglish: analyzed.captionEnglish,
        originalCaption: ig.caption,
        techniques: analyzed.techniques,
        style: analyzed.style,
        mood: analyzed.mood,
        thumbnail: ig.thumbnail,
        videoUrl: blobUrl,
      };
    } catch (e: any) {
      await prisma.learnSource.update({
        where: { id: source.id },
        data: { status: "failed", error: String(e.message || e).slice(0, 500) },
      });
      return { ok: false as const, error: `ניתוח Gemini נכשל: ${String(e.message || e).slice(0, 200)}` };
    }
  } catch (e: any) {
    return { ok: false as const, error: String(e.message || e).slice(0, 300) };
  }
}
