import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;

// Use gemini-1.5-flash — free tier, plenty fast for prompt composition.
const MODEL = "gemini-1.5-flash";

export type ComposedPrompt = {
  prompt: string;
  rationale: string;
  similar: Array<{ id: string; title: string | null; externalId: string | null }>;
};

// Pull top K reference prompts by keyword overlap with the user's brief.
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

function buildSystemPrompt() {
  return `You are an expert AI video prompt engineer for Seedance 2.0, Sora, Kling, and Veo.

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
}

export async function composePrompt(brief: string): Promise<ComposedPrompt> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");
  if (!brief || brief.trim().length < 5) throw new Error("Brief קצר מדי");

  const refs = await pickReferences(brief, 5);
  if (refs.length === 0) throw new Error("אין מספיק פרומפטים ב-DB. הרץ סנכרון Seedance קודם.");

  const referenceBlock = refs
    .map((r, i) => {
      const snippet = r.prompt.slice(0, 800).trim();
      return `--- REFERENCE ${i + 1}${r.title ? ` (${r.title})` : ""} ---\n${snippet}`;
    })
    .join("\n\n");

  const userMsg = `User's brief (what they want to generate):
${brief.trim()}

Reference prompts from the curated Seedance 2.0 library (use these for style, structure, and level of detail; do NOT copy content):

${referenceBlock}

Return the JSON object now.`;

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: buildSystemPrompt(),
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  });

  const result = await model.generateContent(userMsg);
  const text = result.response.text();

  let parsed: { prompt?: string; rationale?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini החזיר JSON לא תקין");
  }
  if (!parsed.prompt) throw new Error("Gemini לא החזיר prompt");

  return {
    prompt: String(parsed.prompt).trim(),
    rationale: String(parsed.rationale || "").trim(),
    similar: refs.map((r) => ({ id: r.id, title: r.title, externalId: r.externalId })),
  };
}

// Suggest N similar prompts to a given LearnSource (semantic similarity via Gemini)
export async function suggestSimilar(sourceId: string, count = 3): Promise<ComposedPrompt[]> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");

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
