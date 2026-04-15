// Generic Gemini Flash translation + guide-specific translateGuideToLang.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";
import { logUsage } from "./usage-tracker";
import { langName } from "./guide-languages";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";

function buildSystem(targetLang: string): string {
  return `You are a professional translator. Translate the user's text to ${langName(targetLang)} (${targetLang}).
Rules:
- Preserve markdown formatting, code blocks, URLs, and emojis exactly.
- Output ONLY the translation. No commentary, no preamble.
- If the input is already in ${targetLang}, return it unchanged.
- Keep proper nouns in their original form unless conventionally translated.`;
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!API_KEY || !text.trim()) return text;
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: buildSystem(targetLang),
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });
    const result = await model.generateContent(text.slice(0, 12000));
    const u = result.response.usageMetadata;
    await logUsage({
      model: MODEL,
      operation: "translate",
      inputTokens: u?.promptTokenCount || 0,
      outputTokens: u?.candidatesTokenCount || 0,
      meta: { targetLang },
    });
    return result.response.text().trim();
  } catch (e: any) {
    console.warn("[translate] failed:", String(e?.message || e).slice(0, 200));
    return text;
  }
}

// Translate the entire guide (title/desc/summary + all stage titles+contents) to targetLang.
// Idempotent: skips fields already translated (unless force=true).
export async function translateGuideToLang(guideId: string, targetLang: string, force = false): Promise<void> {
  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    include: {
      translations: true,
      stages: { include: { translations: true }, orderBy: { order: "asc" } },
    },
  });
  if (!guide) return;
  const sourceLang = guide.defaultLang;
  const sourceGuideTrans = guide.translations.find((t) => t.lang === sourceLang);
  if (!sourceGuideTrans) return;

  const existingGuideTrans = guide.translations.find((t) => t.lang === targetLang);
  if (!existingGuideTrans || force) {
    const [tTitle, tDesc, tSummary] = await Promise.all([
      translateText(sourceGuideTrans.title, targetLang),
      sourceGuideTrans.description ? translateText(sourceGuideTrans.description, targetLang) : Promise.resolve(null),
      sourceGuideTrans.summary ? translateText(sourceGuideTrans.summary, targetLang) : Promise.resolve(null),
    ]);
    await prisma.guideTranslation.upsert({
      where: { guideId_lang: { guideId, lang: targetLang } },
      create: { guideId, lang: targetLang, title: tTitle, description: tDesc, summary: tSummary, isAuto: true },
      update: { title: tTitle, description: tDesc, summary: tSummary, isAuto: true },
    });
  }

  for (const stage of guide.stages) {
    const sourceTrans = stage.translations.find((t) => t.lang === sourceLang);
    if (!sourceTrans) continue;
    const existing = stage.translations.find((t) => t.lang === targetLang);
    if (existing && !force) continue;
    const [tTitle, tContent] = await Promise.all([
      translateText(sourceTrans.title, targetLang),
      translateText(sourceTrans.content, targetLang),
    ]);
    await prisma.guideStageTranslation.upsert({
      where: { stageId_lang: { stageId: stage.id, lang: targetLang } },
      create: { stageId: stage.id, lang: targetLang, title: tTitle, content: tContent, isAuto: true },
      update: { title: tTitle, content: tContent, isAuto: true },
    });
  }
}
