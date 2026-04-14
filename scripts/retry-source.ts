import { prisma } from "../lib/db";
import { extractInstagram } from "../lib/instagram";
import { extractPromptFromVideo } from "../lib/gemini-prompt-from-video";
import { generatePromptWithClaude } from "../lib/claude-prompt";

const SOURCE_ID = process.argv[2];
if (!SOURCE_ID) { console.error("usage: tsx retry-source.ts <sourceId>"); process.exit(1); }

function isQuotaError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("expired") || msg.includes("403");
}

(async () => {
  const source = await prisma.learnSource.findUnique({ where: { id: SOURCE_ID } });
  if (!source) { console.log("not found"); process.exit(1); }
  console.log("Source:", source.title, "| URL:", source.url);
  console.log("Has blob:", !!source.blobUrl);

  let caption: string | null = null;
  let thumbnail: string | null = source.thumbnail;
  if (source.url?.includes("instagram")) {
    try {
      const ig = await extractInstagram(source.url);
      caption = ig.caption;
      thumbnail = thumbnail || ig.thumbnail;
      console.log("Instagram caption recovered:", caption?.slice(0, 100));
      console.log("Thumbnail recovered:", !!thumbnail);
    } catch (e: any) { console.log("IG fetch:", e.message); }
  }

  let analyzed: any;
  let engine = "gemini";
  try {
    console.log("\n→ Trying Gemini video analysis...");
    analyzed = await extractPromptFromVideo(source.blobUrl!, caption || source.prompt);
    console.log("✓ Gemini success");
  } catch (e: any) {
    console.log("Gemini failed:", e.message.slice(0, 150));
    if (!isQuotaError(e)) throw e;
    console.log("\n→ Trying Claude fallback with caption + thumbnail...");
    analyzed = await generatePromptWithClaude(caption || source.prompt, thumbnail);
    engine = "claude";
    console.log("✓ Claude success");
  }

  await prisma.videoAnalysis.deleteMany({ where: { sourceId: SOURCE_ID } });
  const analysis = await prisma.videoAnalysis.create({
    data: {
      sourceId: SOURCE_ID,
      description: analyzed.captionEnglish || analyzed.generatedPrompt.slice(0, 300),
      techniques: analyzed.techniques,
      howTo: [],
      tags: analyzed.tags,
      style: analyzed.style,
      mood: analyzed.mood,
      difficulty: null,
      insights: [],
      promptAlignment: null,
      rawGemini: JSON.stringify({ engine, ...analyzed }),
    },
  });

  const nodes = analyzed.techniques.map((t: string) => ({
    type: "technique", title: t.slice(0, 120), body: t,
    tags: [...analyzed.tags, analyzed.style || ""].filter(Boolean),
    confidence: 0.85, analysisId: analysis.id,
  }));
  if (nodes.length > 0) await prisma.knowledgeNode.createMany({ data: nodes });

  await prisma.learnSource.update({
    where: { id: SOURCE_ID },
    data: {
      prompt: analyzed.generatedPrompt, title: analyzed.title || source.title,
      thumbnail: thumbnail || source.thumbnail,
      status: "complete", error: null,
    },
  });

  console.log("\n=== DONE ===");
  console.log("Title:", analyzed.title);
  console.log("Style:", analyzed.style, "| Mood:", analyzed.mood);
  console.log("Techniques:", analyzed.techniques.length, "| KnowledgeNodes:", nodes.length);
  console.log("Engine:", engine);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
