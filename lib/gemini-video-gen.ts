// VEO 3 / VEO 3 Fast video generation via @google/genai.
// Long-running — the operation takes 1-3 minutes. We poll server-side until
// the video is ready, then download + upload to Vercel Blob for permanent storage.

import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { logUsage } from "./usage-tracker";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;

// VEO pricing (USD per second of generated video)
const VEO_PRICING = {
  "veo-3.1-generate-preview": 0.75,
  "veo-3.1-fast-generate-preview": 0.40,
  "veo-3.1-lite-generate-preview": 0.15,
  "veo-3.0-generate-001": 0.75,
  "veo-3.0-fast-generate-001": 0.40,
} as const;

export type VeoModel = keyof typeof VEO_PRICING;

export async function generateVideoVEO3(
  prompt: string,
  sourceId: string,
  opts: { model?: VeoModel; durationSec?: number; aspectRatio?: "16:9" | "9:16" } = {},
): Promise<{ blobUrl: string; usdCost: number; model: string; videoId: string }> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");

  const model = opts.model || "veo-3.1-fast-generate-preview";
  const duration = opts.durationSec || 8;
  const aspect = opts.aspectRatio || "16:9";
  const usdCost = VEO_PRICING[model] * duration;

  // Pre-create a DB row in "processing" so UI can show status
  const row = await prisma.generatedVideo.create({
    data: {
      sourceId,
      blobUrl: "",
      model,
      usdCost: 0,
      durationSec: duration,
      aspectRatio: aspect,
      promptHead: prompt.slice(0, 200),
      status: "processing",
    },
  });

  try {
    const client = new GoogleGenAI({ apiKey: API_KEY });

    // Kick off the long-running video generation
    let operation: any = await client.models.generateVideos({
      model,
      prompt: prompt.slice(0, 3000),
      config: {
        aspectRatio: aspect,
      } as any,
    });

    await prisma.generatedVideo.update({
      where: { id: row.id },
      data: { operationId: operation?.name || operation?.operation?.name || null },
    });

    // Poll until done (max 5 min)
    const deadline = Date.now() + 5 * 60 * 1000;
    while (!operation.done) {
      if (Date.now() > deadline) throw new Error("VEO polling timeout after 5 min");
      await new Promise((r) => setTimeout(r, 6000));
      operation = await client.operations.getVideosOperation({ operation });
    }

    const generated = (operation.response as any)?.generatedVideos?.[0];
    const videoRef = generated?.video;
    if (!videoRef) throw new Error("VEO: no video in response");

    // Fetch video bytes directly from the URI (append API key for auth)
    const videoUri = (videoRef as any).uri || (videoRef as any).fileUri;
    if (!videoUri) throw new Error("VEO: video URI missing in response");
    const fetchUrl = videoUri.includes("?") ? `${videoUri}&key=${API_KEY}` : `${videoUri}?key=${API_KEY}`;
    const videoRes = await fetch(fetchUrl);
    if (!videoRes.ok) throw new Error(`VEO download ${videoRes.status}`);
    const buffer = Buffer.from(await videoRes.arrayBuffer());

    const filename = `prompt-videos/${sourceId}-${Date.now()}.mp4`;
    const blob = await put(filename, buffer, { access: "public", contentType: "video/mp4" });

    await prisma.generatedVideo.update({
      where: { id: row.id },
      data: {
        blobUrl: blob.url,
        usdCost,
        status: "complete",
      },
    });

    await logUsage({
      model,
      operation: "image-gen", // reusing operation type; cost still tracked separately
      inputTokens: Math.round(prompt.length / 4),
      outputTokens: 0,
      imagesOut: 0,
      videoSeconds: duration,
      sourceId,
      meta: { aspect, videoGeneration: true, blobUrl: blob.url, usdCost },
    });

    return { blobUrl: blob.url, usdCost, model, videoId: row.id };
  } catch (e: any) {
    await prisma.generatedVideo.update({
      where: { id: row.id },
      data: { status: "failed", error: String(e.message || e).slice(0, 500) },
    }).catch(() => {});
    await logUsage({
      model,
      operation: "image-gen",
      videoSeconds: duration,
      sourceId,
      errored: true,
      meta: { error: String(e.message || e).slice(0, 200) },
    }).catch(() => {});
    throw e;
  }
}

export function estimateVeoCost(model: VeoModel, durationSec: number): number {
  return VEO_PRICING[model] * durationSec;
}
