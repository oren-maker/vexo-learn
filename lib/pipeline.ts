// Processing pipeline - runs sequentially in-process (simpler than BullMQ for MVP).
// Triggered from POST /learn/sources. Call in "fire-and-forget" mode via setTimeout.

import { prisma, jsonArray } from "./db";
import { fetchMetadata, downloadVideo, hasYtDlp } from "./ytdlp";
import { analyzeLocalVideo, cleanupLocalFile } from "./gemini";
import type { VideoAnalysisResult } from "./gemini";

function extractKnowledgeNodes(
  analysis: VideoAnalysisResult
): Array<{ type: string; title: string; body: string; tags: string[]; confidence: number }> {
  const nodes: Array<{ type: string; title: string; body: string; tags: string[]; confidence: number }> = [];

  for (const t of analysis.techniques) {
    nodes.push({
      type: "technique",
      title: t.slice(0, 120),
      body: `Technique observed in video: ${t}`,
      tags: [...analysis.tags, analysis.style || ""].filter(Boolean),
      confidence: analysis.promptAlignment ? analysis.promptAlignment / 10 : 0.8,
    });
  }
  if (analysis.style) {
    nodes.push({
      type: "style",
      title: `Style: ${analysis.style}`,
      body: analysis.description,
      tags: [analysis.style, analysis.mood || "", ...analysis.tags].filter(Boolean),
      confidence: 0.85,
    });
  }
  for (const step of analysis.howTo) {
    nodes.push({
      type: "how_to",
      title: step.slice(0, 120),
      body: step,
      tags: analysis.tags,
      confidence: 0.75,
    });
  }
  for (const ins of analysis.insights) {
    nodes.push({
      type: "insight",
      title: ins.slice(0, 120),
      body: ins,
      tags: analysis.tags,
      confidence: 0.8,
    });
  }
  return nodes;
}

export async function runPipeline(sourceId: string): Promise<void> {
  const source = await prisma.learnSource.findUnique({ where: { id: sourceId } });
  if (!source) return;
  if (source.type !== "instructor_url" && source.type !== "free_api") return;
  if (!source.url) {
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: { status: "failed", error: "URL חסר" },
    });
    return;
  }

  try {
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: { status: "processing" },
    });

    // Step 1: Metadata (best-effort)
    const ytdlpOk = await hasYtDlp();
    if (!ytdlpOk) throw new Error("yt-dlp לא מותקן ב-server");

    const meta = await fetchMetadata(source.url);
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: {
        title: meta.title || source.title,
        thumbnail: meta.thumbnail || source.thumbnail,
        duration: meta.duration || source.duration,
      },
    });

    // Step 2: Download
    const { localPath } = await downloadVideo(source.url, sourceId);
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: { localPath },
    });

    // Step 3: Gemini analysis
    const { analysis, raw } = await analyzeLocalVideo(localPath, source.prompt);

    const savedAnalysis = await prisma.videoAnalysis.create({
      data: {
        sourceId,
        description: analysis.description,
        techniques: jsonArray.stringify(analysis.techniques),
        howTo: jsonArray.stringify(analysis.howTo),
        tags: jsonArray.stringify(analysis.tags),
        style: analysis.style,
        mood: analysis.mood,
        difficulty: analysis.difficulty,
        insights: jsonArray.stringify(analysis.insights),
        promptAlignment: analysis.promptAlignment,
        rawGemini: raw,
      },
    });

    // Step 4: Extract knowledge nodes
    const nodes = extractKnowledgeNodes(analysis);
    if (nodes.length > 0) {
      await prisma.knowledgeNode.createMany({
        data: nodes.map((n) => ({
          type: n.type,
          title: n.title,
          body: n.body,
          tags: jsonArray.stringify(n.tags),
          confidence: n.confidence,
          analysisId: savedAnalysis.id,
        })),
      });
    }

    // Step 5: Done
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: { status: "complete" },
    });

    // Step 6: Cleanup local file (keep analysis, drop video bytes)
    await cleanupLocalFile(localPath);
  } catch (e: any) {
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: { status: "failed", error: String(e.message || e).slice(0, 500) },
    });
  }
}
