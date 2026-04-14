// Gemini nano-banana (gemini-2.5-flash-image) - image generation from text.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { put } from "@vercel/blob";
import { logUsage } from "./usage-tracker";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-image";
const TEXT_MODEL = "gemini-flash-latest";

// Based on the 6-layer image prompt framework (Subject → Action → Environment → Style → Lighting → Technical).
// Word order matters: earlier layers dominate. Transform an arbitrary video prompt into a structured image prompt.
const IMAGE_PROMPT_SYSTEM = `You convert video-scene descriptions into a single structured IMAGE-generation prompt for nano-banana / DALL-E / similar models.

HARD RULE: word order controls emphasis — put the most critical element FIRST. Write the 6 layers in this exact order, each starting with a bold label:

1. **Subject:** who/what — age, body, clothing materials, specific physical details, expression
2. **Action:** what is happening in this single frame — the decisive moment captured
3. **Environment:** location, weather, background elements, props
4. **Art Style:** visual approach (photorealistic / cinematic 35mm / oil painting / cyberpunk / watercolor / synthwave / minimalism)
5. **Lighting:** direction + time (Golden Hour / Blue Hour / Rembrandt / volumetric / overcast diffused), color temperature
6. **Technical:** lens (85mm portrait bokeh / 50mm / macro / wide angle / drone aerial), depth of field, 4K/8K, film grain, effects

REALISM BOOSTERS when photo/cinematic style:
- Skin: "visible pores, subtle imperfections, natural texture variation"
- Fabric: "realistic folds, detailed weave, visible fibers"
- Metal/glass: "accurate reflections, subsurface depth"

TEXT IN IMAGE: if text is needed — put it inside "quotation marks", specify font, and state exact placement.

Output pure text (no JSON, no markdown fencing), 80–200 words, flowing naturally but keeping the 6 labeled layers. This text goes directly to the image model.`;

async function buildStructuredImagePrompt(videoPrompt: string): Promise<string> {
  if (!API_KEY) return videoPrompt.slice(0, 2000);
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      systemInstruction: IMAGE_PROMPT_SYSTEM,
      generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
    });
    const result = await model.generateContent(
      `Convert this video prompt into a single-frame IMAGE prompt using the 6-layer structure. Choose the single most cinematic beat to capture as a still.\n\n=== VIDEO PROMPT ===\n${videoPrompt.slice(0, 3500)}\n\nReturn only the final image prompt text.`,
    );
    const u = result.response.usageMetadata;
    await logUsage({
      model: TEXT_MODEL,
      operation: "image-prompt-build",
      inputTokens: u?.promptTokenCount || 0,
      outputTokens: u?.candidatesTokenCount || 0,
    });
    return result.response.text().trim();
  } catch {
    return videoPrompt.slice(0, 2000);
  }
}

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

  const structured = await buildStructuredImagePrompt(prompt);

  let result;
  try {
    result = await model.generateContent([{ text: structured }]);
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
        promptHead: structured.slice(0, 200),
      },
    }).catch(() => {});
  }

  return { blobUrl: blob.url, usdCost, model: MODEL };
}
