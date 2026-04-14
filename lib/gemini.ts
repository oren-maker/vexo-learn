import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { promises as fs } from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY;

export type VideoAnalysisResult = {
  description: string;
  techniques: string[];
  style: string | null;
  mood: string | null;
  difficulty: string | null;
  howTo: string[];
  tags: string[];
  promptAlignment: number | null;
  insights: string[];
};

function buildAnalysisPrompt(userPrompt: string): string {
  return `You are an expert video production analyst. Watch this video carefully.

Original prompt: "${userPrompt}"

Analyze and return ONLY valid JSON with this exact structure:
{
  "description": "2-3 sentence summary of what happens in the video",
  "techniques": ["array", "of", "specific", "filming/editing", "techniques"],
  "style": "overall visual style (e.g. cinematic, documentary, tutorial)",
  "mood": "emotional tone",
  "difficulty": "beginner | intermediate | advanced",
  "howTo": ["step-by-step instructions to recreate this style"],
  "tags": ["searchable", "tags"],
  "promptAlignment": 8,
  "insights": ["specific actionable learnings for video creators"]
}

promptAlignment is an integer from 1 to 10.
Return ONLY the JSON object, no markdown fencing, no explanation.`;
}

function parseResponse(text: string): VideoAnalysisResult {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    description: String(parsed.description || ""),
    techniques: Array.isArray(parsed.techniques) ? parsed.techniques.map(String) : [],
    style: parsed.style ? String(parsed.style) : null,
    mood: parsed.mood ? String(parsed.mood) : null,
    difficulty: parsed.difficulty ? String(parsed.difficulty) : null,
    howTo: Array.isArray(parsed.howTo) ? parsed.howTo.map(String) : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    promptAlignment: typeof parsed.promptAlignment === "number" ? parsed.promptAlignment : null,
    insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
  };
}

export async function analyzeLocalVideo(
  localPath: string,
  userPrompt: string
): Promise<{ analysis: VideoAnalysisResult; raw: string }> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY חסר ב-env");

  const fileManager = new GoogleAIFileManager(API_KEY);
  const genAI = new GoogleGenerativeAI(API_KEY);

  const ext = path.extname(localPath).toLowerCase().replace(".", "");
  const mimeType =
    ext === "mp4" ? "video/mp4" :
    ext === "webm" ? "video/webm" :
    ext === "mov" ? "video/quicktime" :
    "video/mp4";

  const uploaded = await fileManager.uploadFile(localPath, {
    mimeType,
    displayName: path.basename(localPath),
  });

  let file = uploaded.file;
  const start = Date.now();
  while (file.state === FileState.PROCESSING) {
    if (Date.now() - start > 5 * 60 * 1000) throw new Error("Gemini upload processing timeout");
    await new Promise((r) => setTimeout(r, 5000));
    file = await fileManager.getFile(file.name);
  }

  if (file.state !== FileState.ACTIVE) {
    throw new Error(`Gemini file state: ${file.state}`);
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const result = await model.generateContent([
    { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
    { text: buildAnalysisPrompt(userPrompt) },
  ]);

  const text = result.response.text();
  const analysis = parseResponse(text);

  // cleanup the uploaded file
  try {
    await fileManager.deleteFile(file.name);
  } catch {}

  return { analysis, raw: text };
}

export async function cleanupLocalFile(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch {}
}
