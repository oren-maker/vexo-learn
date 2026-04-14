// VEO 3 video generation with progress tracking.
// Each stage updates the GeneratedVideo row so the client can poll.

import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { logUsage } from "./usage-tracker";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;

const VEO_PRICING = {
  "veo-3.1-generate-preview": 0.75,
  "veo-3.1-fast-generate-preview": 0.40,
  "veo-3.1-lite-generate-preview": 0.15,
  "veo-3.0-generate-001": 0.75,
  "veo-3.0-fast-generate-001": 0.40,
} as const;

export type VeoModel = keyof typeof VEO_PRICING;

async function updateProgress(videoId: string, data: {
  status?: string;
  progressPct?: number;
  progressMessage?: string;
  operationId?: string | null;
  error?: string;
}) {
  try {
    await prisma.generatedVideo.update({ where: { id: videoId }, data });
  } catch {}
}

// Starts generation, returns the videoId immediately. The caller should
// run this with waitUntil so the function stays alive to complete the work.
export async function startVideoGeneration(
  prompt: string,
  sourceId: string,
  opts: { model?: VeoModel; durationSec?: number; aspectRatio?: "16:9" | "9:16" } = {},
): Promise<string> {
  const model = opts.model || "veo-3.1-fast-generate-preview";
  const duration = opts.durationSec || 8;
  const aspect = opts.aspectRatio || "16:9";

  const row = await prisma.generatedVideo.create({
    data: {
      sourceId,
      blobUrl: "",
      model,
      usdCost: 0,
      durationSec: duration,
      aspectRatio: aspect,
      promptHead: prompt.slice(0, 200),
      status: "submitting",
      progressPct: 2,
      progressMessage: "מכין את הבקשה…",
    },
  });

  return row.id;
}

// Does the actual work — long-running. Should run inside waitUntil.
export async function runVideoGeneration(videoId: string, prompt: string): Promise<void> {
  if (!API_KEY) {
    await updateProgress(videoId, { status: "failed", error: "GEMINI_API_KEY חסר", progressMessage: "מפתח Gemini חסר", progressPct: 0 });
    return;
  }

  const row = await prisma.generatedVideo.findUnique({ where: { id: videoId } });
  if (!row) return;

  const model = row.model as VeoModel;
  const duration = row.durationSec;
  const aspect = row.aspectRatio as "16:9" | "9:16";
  const usdCost = VEO_PRICING[model] * duration;

  try {
    const client = new GoogleGenAI({ apiKey: API_KEY });

    await updateProgress(videoId, { status: "submitting", progressPct: 5, progressMessage: "שולח ל-VEO 3…" });

    let operation: any = await client.models.generateVideos({
      model,
      prompt: prompt.slice(0, 3000),
      config: { aspectRatio: aspect } as any,
    });

    await updateProgress(videoId, {
      status: "rendering",
      progressPct: 15,
      progressMessage: "VEO 3 מרנדר את הוידאו… (1-3 דקות)",
      operationId: operation?.name || operation?.operation?.name || null,
    });

    // Poll. Each loop ~= 6s; at 180s estimate the % approaches 85%
    const startTime = Date.now();
    const deadline = startTime + 5 * 60 * 1000;
    while (!operation.done) {
      if (Date.now() > deadline) throw new Error("VEO polling timeout (5 min)");
      await new Promise((r) => setTimeout(r, 6000));
      operation = await client.operations.getVideosOperation({ operation });
      // Update progress percent based on elapsed time (simulated - VEO doesn't expose real %)
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = Math.min(85, 15 + Math.round((elapsed / 120) * 70));
      await updateProgress(videoId, {
        status: "rendering",
        progressPct: pct,
        progressMessage: `VEO 3 מרנדר… ${Math.round(elapsed)}s`,
      });
    }

    const generated = (operation.response as any)?.generatedVideos?.[0];
    const videoRef = generated?.video;
    if (!videoRef) throw new Error("VEO: no video in response");

    await updateProgress(videoId, { status: "downloading", progressPct: 88, progressMessage: "מוריד את הוידאו מ-VEO…" });

    const videoUri = (videoRef as any).uri || (videoRef as any).fileUri;
    if (!videoUri) throw new Error("VEO: video URI missing in response");
    const fetchUrl = videoUri.includes("?") ? `${videoUri}&key=${API_KEY}` : `${videoUri}?key=${API_KEY}`;
    const videoRes = await fetch(fetchUrl);
    if (!videoRes.ok) throw new Error(`VEO download ${videoRes.status}`);
    const buffer = Buffer.from(await videoRes.arrayBuffer());

    await updateProgress(videoId, { status: "uploading", progressPct: 95, progressMessage: "שומר ל-Vercel Blob…" });

    const filename = `prompt-videos/${row.sourceId}-${Date.now()}.mp4`;
    const blob = await put(filename, buffer, { access: "public", contentType: "video/mp4" });

    await prisma.generatedVideo.update({
      where: { id: videoId },
      data: {
        blobUrl: blob.url,
        usdCost,
        status: "complete",
        progressPct: 100,
        progressMessage: "הושלם!",
        completedAt: new Date(),
      },
    });

    await logUsage({
      model,
      operation: "image-gen",
      inputTokens: Math.round(prompt.length / 4),
      videoSeconds: duration,
      sourceId: row.sourceId,
      meta: { aspect, videoGeneration: true, blobUrl: blob.url, usdCost, videoId },
    });
  } catch (e: any) {
    const msg = String(e.message || e).slice(0, 500);
    await prisma.generatedVideo.update({
      where: { id: videoId },
      data: { status: "failed", error: msg, progressMessage: msg.slice(0, 120), progressPct: 0 },
    }).catch(() => {});
    await logUsage({
      model,
      operation: "image-gen",
      videoSeconds: duration,
      sourceId: row.sourceId,
      errored: true,
      meta: { error: msg, videoId },
    }).catch(() => {});
  }
}

export function estimateVeoCost(model: VeoModel, durationSec: number): number {
  return VEO_PRICING[model] * durationSec;
}
