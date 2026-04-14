import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";

type AnalysisShape = {
  description: string;
  techniques: string[];
  style: string | null;
  mood: string | null;
  difficulty: string | null;
  howTo: string[];
  tags: string[];
  insights: string[];
};

const SYSTEM = `You are a senior video prompt engineer. Read the given Seedance 2.0 / AI video prompt
and extract structured knowledge from it. Output ONLY valid JSON matching:

{
  "description": "2-3 sentence summary of what the prompt generates",
  "techniques": ["specific filming/editing/VFX techniques named in the prompt"],
  "style": "overall visual style (cinematic, documentary, anime, UGC, wuxia, etc.)",
  "mood": "emotional tone (tense, serene, euphoric, ominous, etc.)",
  "difficulty": "beginner | intermediate | advanced",
  "howTo": ["step-by-step instructions to recreate this shot"],
  "tags": ["5-10 searchable lowercase tags"],
  "insights": ["actionable lessons a prompt writer can learn from this example"]
}

Rules:
- Each techniques/howTo/insights item is a full, concrete sentence — not a keyword.
- techniques should name real camera/lens/lighting/VFX moves (e.g. "anamorphic 35mm lens with teal-orange color grade", "ultra-slow-motion ring-shaped shockwave on weapon clash").
- insights should teach the reader HOW to write better prompts (e.g. "Pair sensory sound design with visual beats to deepen immersion").
- tags lowercase, no spaces (use-hyphens).
- difficulty based on how many advanced techniques/timing beats are needed.
- No markdown, no commentary, JSON only.`;

export async function extractKnowledgeFromPromptText(
  promptText: string
): Promise<AnalysisShape> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר");
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM,
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  });
  const result = await model.generateContent(promptText.slice(0, 6000));
  const raw = result.response.text();
  const parsed = JSON.parse(raw);
  return {
    description: String(parsed.description || ""),
    techniques: Array.isArray(parsed.techniques) ? parsed.techniques.map(String) : [],
    style: parsed.style ? String(parsed.style) : null,
    mood: parsed.mood ? String(parsed.mood) : null,
    difficulty: parsed.difficulty ? String(parsed.difficulty) : null,
    howTo: Array.isArray(parsed.howTo) ? parsed.howTo.map(String) : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
  };
}

function analysisToNodes(
  analysis: AnalysisShape,
  analysisId: string
) {
  const nodes: Array<{
    type: string;
    title: string;
    body: string;
    tags: string[];
    confidence: number;
    analysisId: string;
  }> = [];

  for (const t of analysis.techniques) {
    nodes.push({
      type: "technique",
      title: t.slice(0, 120),
      body: t,
      tags: [...analysis.tags, analysis.style || ""].filter(Boolean),
      confidence: 0.82,
      analysisId,
    });
  }
  if (analysis.style) {
    nodes.push({
      type: "style",
      title: `Style: ${analysis.style}`,
      body: analysis.description,
      tags: [analysis.style, analysis.mood || "", ...analysis.tags].filter(Boolean),
      confidence: 0.85,
      analysisId,
    });
  }
  for (const step of analysis.howTo) {
    nodes.push({
      type: "how_to",
      title: step.slice(0, 120),
      body: step,
      tags: analysis.tags,
      confidence: 0.78,
      analysisId,
    });
  }
  for (const ins of analysis.insights) {
    nodes.push({
      type: "insight",
      title: ins.slice(0, 120),
      body: ins,
      tags: analysis.tags,
      confidence: 0.8,
      analysisId,
    });
  }
  return nodes;
}

// Process one source: call Gemini, create VideoAnalysis + KnowledgeNodes.
// Skips if analysis already exists.
export async function extractForSource(sourceId: string): Promise<{ created: boolean; nodeCount: number; error?: string }> {
  const source = await prisma.learnSource.findUnique({
    where: { id: sourceId },
    include: { analysis: true },
  });
  if (!source) return { created: false, nodeCount: 0, error: "not found" };
  if (source.analysis) return { created: false, nodeCount: 0, error: "already has analysis" };

  try {
    const analysis = await extractKnowledgeFromPromptText(source.prompt);
    const saved = await prisma.videoAnalysis.create({
      data: {
        sourceId: source.id,
        description: analysis.description,
        techniques: analysis.techniques,
        howTo: analysis.howTo,
        tags: analysis.tags,
        style: analysis.style,
        mood: analysis.mood,
        difficulty: analysis.difficulty,
        insights: analysis.insights,
        promptAlignment: null,
        rawGemini: JSON.stringify(analysis),
      },
    });
    const nodes = analysisToNodes(analysis, saved.id);
    if (nodes.length > 0) {
      await prisma.knowledgeNode.createMany({ data: nodes });
    }
    return { created: true, nodeCount: nodes.length };
  } catch (e: any) {
    return { created: false, nodeCount: 0, error: String(e.message || e).slice(0, 200) };
  }
}

// Batch process all sources without analysis. Sequential with small delay to stay under Gemini Flash rate limits.
export async function extractAllPending(limit = 200): Promise<{
  processed: number;
  created: number;
  totalNodes: number;
  errors: string[];
}> {
  const pending = await prisma.learnSource.findMany({
    where: {
      type: "cedance",
      status: "complete",
      analysis: { is: null },
    },
    take: limit,
  });

  let created = 0;
  let totalNodes = 0;
  const errors: string[] = [];

  for (const source of pending) {
    const r = await extractForSource(source.id);
    if (r.created) {
      created++;
      totalNodes += r.nodeCount;
    } else if (r.error && r.error !== "already has analysis") {
      errors.push(`${source.externalId || source.id}: ${r.error}`);
    }
    // Gemini Flash free tier: 15 RPM. Pause ~2s between calls to stay safe.
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { processed: pending.length, created, totalNodes, errors };
}
