// Claude-based prompt generator — fallback for when Gemini quota is exhausted.
// Uses caption text + thumbnail image (vision) since Claude doesn't support video directly.

import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.ANTHROPIC_API_KEY;

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

async function urlToBase64(url: string): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4.5 * 1024 * 1024) return null; // Claude image limit
    const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType) ? contentType : "image/jpeg") as any;
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

export async function generatePromptWithClaude(caption: string | null, thumbnailUrl: string | null): Promise<ClaudeResult> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY חסר");

  const client = new Anthropic({ apiKey: API_KEY });
  const content: any[] = [];

  if (thumbnailUrl) {
    const img = await urlToBase64(thumbnailUrl);
    if (img) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      });
    }
  }

  content.push({
    type: "text",
    text: `Caption (may be Hebrew/other language):\n${caption || "(no caption)"}\n\nReturn the JSON now.`,
  });

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim()
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
