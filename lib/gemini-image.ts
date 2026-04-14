// Gemini nano-banana (gemini-2.5-flash-image) - image generation from text.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { put } from "@vercel/blob";
import { logUsage } from "./usage-tracker";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-image";

export async function generateImageFromPrompt(
  prompt: string,
  sourceId?: string,
): Promise<{ blobUrl: string; usdCost: number; model: string }> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseModalities: ["IMAGE"] as any,
    } as any,
  });

  let result;
  try {
    result = await model.generateContent([
      { text: `Generate a single photorealistic still image that captures this video prompt as a single frame:\n\n${prompt.slice(0, 3000)}` },
    ]);
  } catch (e: any) {
    await logUsage({ model: MODEL, operation: "image-gen", sourceId, errored: true, meta: { error: String(e.message || e).slice(0, 200) } });
    throw e;
  }

  const parts = result.response.candidates?.[0]?.content?.parts || [];
  let imageB64: string | null = null;
  let mimeType = "image/png";
  for (const p of parts as any[]) {
    if (p.inlineData?.data) {
      imageB64 = p.inlineData.data;
      mimeType = p.inlineData.mimeType || "image/png";
      break;
    }
  }
  if (!imageB64) {
    await logUsage({ model: MODEL, operation: "image-gen", sourceId, errored: true, meta: { error: "no image in response" } });
    throw new Error("Gemini did not return an image (check quota / model access)");
  }

  const buffer = Buffer.from(imageB64, "base64");
  const filename = `prompt-images/${sourceId || Date.now()}-${Date.now()}.${mimeType.split("/")[1] || "png"}`;
  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
  });

  await logUsage({
    model: MODEL,
    operation: "image-gen",
    inputTokens: Math.round(prompt.length / 4),
    outputTokens: 0,
    imagesOut: 1,
    sourceId,
    meta: { mimeType, byteSize: buffer.length },
  });

  const usdCost = 0.039;

  if (sourceId) {
    await prisma.generatedImage.create({
      data: {
        sourceId,
        blobUrl: blob.url,
        model: MODEL,
        usdCost,
        promptHead: prompt.slice(0, 200),
      },
    }).catch(() => {});
  }

  return { blobUrl: blob.url, usdCost, model: MODEL };
}
