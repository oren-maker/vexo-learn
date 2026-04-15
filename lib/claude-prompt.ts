// Fallback prompt generator using Gemini text+image (was Claude, now Gemini-only).
// Used when the primary Gemini VIDEO call fails — we retry with a lighter
// Gemini flash text+thumbnail call that uses a different quota bucket.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logUsage } from "./usage-tracker";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";

export type ClaudeResult = {
  title: string;
  generatedPrompt: string;
  captionEnglish: string;
  techniques: string[];
  style: string | null;
  mood: string | null;
  tags: string[];
};

const SYSTEM = `You are a senior AI video prompt engineer. You receive an Instagram reel's caption (possibly in Hebrew) and its thumbnail image. Your job:

1. Understand what the video likely shows from caption + thumbnail.
2. Translate the caption to English.
3. Produce ONE production-ready video generation prompt (Sora 2 / Seedance 2.0 style) that would recreate a similar visual. Use timecoded beats, specific camera language, lighting, mood, and technical specs. 150-400 words.
4. Extract structured metadata.

Output ONLY valid JSON:
{
  "title": "short English title, max 80 chars",
  "generatedPrompt": "the full prompt, structured with [Style] [Scene] [Character] [Shots] [Camera] [Effects] [Audio] [Technical]",
  "captionEnglish": "caption translated to English (empty if none)",
  "techniques": ["specific inferred techniques"],
  "style": "Cinematic | Anime | Documentary | UGC | Wuxia | Cyberpunk | etc.",
  "mood": "Tense | Serene | Epic | Playful | etc.",
  "tags": ["5-8 lowercase tags"]
}`;

async function urlToInlineData(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4.5 * 1024 * 1024) return null;
    return { data: buf.toString("base64"), mimeType: contentType };
  } catch {
    return null;
  }
}

// Name kept for backward compatibility — internally uses Gemini flash now.
export async function generatePromptWithClaude(caption: string | null, thumbnailUrl: string | null): Promise<ClaudeResult> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM,
    generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: 2048 },
  });

  const parts: any[] = [];
  if (thumbnailUrl) {
    const img = await urlToInlineData(thumbnailUrl);
    if (img) parts.push({ inlineData: img });
  }
  parts.push({ text: `Caption (may be Hebrew/other language):\n${caption || "(no caption)"}\n\nReturn the JSON now.` });

  const result = await model.generateContent(parts);
  const u = result.response.usageMetadata;
  await logUsage({
    model: MODEL,
    operation: "video-analysis",
    inputTokens: u?.promptTokenCount || 0,
    outputTokens: u?.candidatesTokenCount || 0,
  });

  const raw = result.response.text().trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(raw);
  return {
    title: String(parsed.title || "").slice(0, 200),
    generatedPrompt: String(parsed.generatedPrompt || "").trim(),
    captionEnglish: String(parsed.captionEnglish || "").trim(),
    techniques: Array.isArray(parsed.techniques) ? parsed.techniques.map(String) : [],
    style: parsed.style ? String(parsed.style) : null,
    mood: parsed.mood ? String(parsed.mood) : null,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
  };
}
