import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";

export type ComposedPrompt = {
  prompt: string;
  rationale: string;
  similar: Array<{ id: string; title: string | null; externalId: string | null }>;
  engine?: "gemini" | "claude";
};

function isQuotaError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("expired") || msg.includes("403");
}

async function pickReferences(brief: string, k = 5) {
  const STOP = new Set(["a", "an", "the", "of", "and", "or", "in", "to", "with", "for", "on", "at", "by", "from"]);
  const keywords = brief
    .toLowerCase()
    .split(/[\s,.!?;:]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .slice(0, 10);

  if (keywords.length === 0) {
    return prisma.learnSource.findMany({
      where: { type: "cedance", status: "complete" },
      take: k,
      orderBy: { createdAt: "desc" },
    });
  }

  const candidates = await prisma.learnSource.findMany({
    where: {
      type: "cedance",
      status: "complete",
      OR: keywords.flatMap((kw) => [
        { prompt: { contains: kw, mode: "insensitive" as const } },
        { title: { contains: kw, mode: "insensitive" as const } },
      ]),
    },
    take: k * 5,
    orderBy: { createdAt: "desc" },
  });

  const scored = candidates.map((c) => {
    const hay = `${c.title || ""}\n${c.prompt}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) score += hay.split(kw).length - 1;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.c);
}

const SYSTEM_PROMPT = `You are an expert AI video prompt engineer for Seedance 2.0, Sora, Kling, and Veo.

Your job: compose ONE high-quality video generation prompt based on the user's brief, studying the provided reference prompts for:
- Structure: [Style] / [Scene] / [Character] / [Shots] / [Camera] / [Effects] blocks, or timecoded beats [00:00-00:05]
- Cinematic language: lens, lighting, color grade, depth of field, motion, VFX
- Level of detail and sensory richness (sound, atmosphere, micro-expressions)
- Technical specs: resolution (720p/1080p/8K), aspect ratio (16:9/9:16), duration (4-15 seconds)

RULES:
- Match the style and structure of the reference prompts, but do NOT copy their content.
- Write the prompt in English (Seedance's native language).
- Include timecoded shot breakdown when appropriate (for 10-15s prompts).
- End with resolution / aspect / duration line if the references use one.
- Output ONLY valid JSON, no markdown fencing, in this exact shape:
{
  "prompt": "the full prompt text...",
  "rationale": "one short paragraph in Hebrew explaining which techniques from the references you applied and why"
}`;

function buildUserMsg(brief: string, refs: Array<{ title: string | null; prompt: string }>): string {
  const referenceBlock = refs
    .map((r, i) => `--- REFERENCE ${i + 1}${r.title ? ` (${r.title})` : ""} ---\n${r.prompt.slice(0, 800).trim()}`)
    .join("\n\n");
  return `User's brief:\n${brief.trim()}\n\nReference prompts from Seedance 2.0 library (use for style, structure, and detail level; do NOT copy content):\n\n${referenceBlock}\n\nReturn JSON now.`;
}

function parseComposeJson(raw: string): { prompt: string; rationale: string } {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.prompt) throw new Error("model did not return a prompt field");
  return { prompt: String(parsed.prompt).trim(), rationale: String(parsed.rationale || "").trim() };
}

async function composeWithGemini(brief: string, refs: any[]): Promise<ComposedPrompt> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  });
  const result = await model.generateContent(buildUserMsg(brief, refs));
  const { prompt, rationale } = parseComposeJson(result.response.text());
  return {
    prompt,
    rationale,
    similar: refs.map((r) => ({ id: r.id, title: r.title, externalId: r.externalId })),
    engine: "gemini",
  };
}

async function composeWithClaude(brief: string, refs: any[]): Promise<ComposedPrompt> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY חסר");
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMsg(brief, refs) }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Claude returned no text");
  const { prompt, rationale } = parseComposeJson(block.text);
  return {
    prompt,
    rationale,
    similar: refs.map((r) => ({ id: r.id, title: r.title, externalId: r.externalId })),
    engine: "claude",
  };
}

export async function composePrompt(brief: string): Promise<ComposedPrompt> {
  if (!brief || brief.trim().length < 5) throw new Error("Brief קצר מדי");

  const refs = await pickReferences(brief, 5);
  if (refs.length === 0) throw new Error("אין מספיק פרומפטים ב-DB. הרץ סנכרון קודם.");

  // Try Gemini first. On quota/403/429 → fall back to Claude.
  if (API_KEY) {
    try {
      return await composeWithGemini(brief, refs);
    } catch (e: any) {
      if (!isQuotaError(e)) throw e;
    }
  }
  return composeWithClaude(brief, refs);
}

export async function suggestSimilar(sourceId: string, count = 3): Promise<ComposedPrompt[]> {
  const source = await prisma.learnSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("source not found");

  const brief = `Create ${count} distinct variations inspired by this prompt (different subjects or scenes, same style/structure):\n\n${source.prompt.slice(0, 800)}`;

  const results: ComposedPrompt[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const c = await composePrompt(brief);
      results.push(c);
    } catch {
      // continue on individual failure
    }
  }
  return results;
}
