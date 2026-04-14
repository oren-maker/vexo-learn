// Gemini nano-banana (gemini-2.5-flash-image) - image generation from text.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { put } from "@vercel/blob";
import { logUsage } from "./usage-tracker";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-image";

export async function generateImageFromPrompt(
  prompt: string,
  sourceId?: string,
): Promise<{ blobUrl: string; usdCost: number }> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      // responseMimeType: "image/png", // nano-banana returns images as inline_data parts
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

  // Extract image bytes from response parts
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

  // Log usage - 1 image at nano-banana pricing
  await logUsage({
    model: MODEL,
    operation: "image-gen",
    inputTokens: Math.round(prompt.length / 4), // rough estimate
    outputTokens: 0,
    imagesOut: 1,
    sourceId,
    meta: { mimeType, byteSize: buffer.length },
  });

  const usdCost = 0.039;
  return { blobUrl: blob.url, usdCost };
}
