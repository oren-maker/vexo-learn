// After every new InsightsSnapshot, run one pass of auto-improvement on a
// handful of prompts that look "stale" vs the current corpus norms.
// Uses Gemini Flash. Every improvement snapshots the previous version
// into PromptVersion so nothing is lost.

import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { logUsage } from "./usage-tracker";
import { snapshotCurrentVersion, computeTextDiff } from "./prompt-versioning";
import { computeCorpusInsights } from "./corpus-insights";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";

const SYSTEM = `You upgrade existing Seedance 2.0 / Sora video prompts based on what the curated corpus has learned.

You receive:
1. The current prompt (may be thin or outdated)
2. A list of 'derived rules' that describe what makes prompts work well in this corpus
3. Top co-occurring techniques that strong prompts use together
4. Style signatures that characterize each visual style

Your job:
- Decide if the prompt needs improvement. If it's already strong (>150 words, uses timecodes, rich in technical language, specific character/camera/lighting), return { keep: true }
- Otherwise, produce an upgraded prompt that applies the corpus rules WITHOUT changing the core subject/scene
- Be conservative: keep the user's creative intent, only add/tighten cinematic + technical layers
- Return ONLY JSON:
  { "keep": true }  // if no change needed
  OR
  { "keep": false, "upgradedPrompt": "...", "reason": "one short Hebrew sentence explaining what you changed" }

No markdown, no commentary.`;

function isQuotaError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("expired") || msg.includes("403");
}

async function improveWithGemini(userMsg: string): Promise<any> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY חסר");
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM,
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  });
  const result = await model.generateContent(userMsg);
  const u = result.response.usageMetadata;
  await logUsage({
    model: MODEL,
    operation: "improve",
    inputTokens: u?.promptTokenCount || 0,
    outputTokens: u?.candidatesTokenCount || 0,
    meta: { purpose: "auto-improve" },
  });
  return JSON.parse(result.response.text());
}

async function improveWithClaude(userMsg: string): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY חסר");
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  await logUsage({
    model: "claude-haiku-4-5-20251001",
    operation: "improve",
    inputTokens: res.usage?.input_tokens || 0,
    outputTokens: res.usage?.output_tokens || 0,
    meta: { purpose: "auto-improve" },
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Claude returned no text");
  return JSON.parse(block.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
}

export async function runAutoImprovement(snapshotId: string, maxCandidates = 5): Promise<{
  examined: number;
  improved: number;
  totalCostUsd: number;
  details: Array<{ sourceId: string; kept: boolean; reason?: string }>;
}> {
  const run = await prisma.improvementRun.create({
    data: { snapshotId, status: "running" },
  });

  try {
    const insights = await computeCorpusInsights();

    // Target "stale" prompts: thin analysis + few techniques
    const candidates = await prisma.learnSource.findMany({
      where: {
        status: "complete",
        analysis: { isNot: null },
      },
      include: { analysis: true },
      take: maxCandidates * 3,
    });
    const stale = candidates
      .filter((s) => s.analysis && s.analysis.techniques.length < 4 && s.prompt.length < 800)
      .slice(0, maxCandidates);

    const rulesBlock = insights.derivedRules.map((r) => `- ${r}`).join("\n");
    const cooccurBlock = insights.cooccurrencePairs
      .slice(0, 6)
      .map((p) => `- ${p.a} + ${p.b} (lift ×${p.lift})`)
      .join("\n");
    const styleBlock = insights.styleProfiles
      .slice(0, 4)
      .map((p) => `- ${p.style}: ${p.signaturePhrases.slice(0, 3).join(", ") || p.topTechniques.slice(0, 3).map((t) => t.name).join(", ")}`)
      .join("\n");

    const details: Array<{ sourceId: string; kept: boolean; reason?: string }> = [];
    let improved = 0;
    let totalCost = 0;
    const startCost = (await prisma.apiUsage.aggregate({ _sum: { usdCost: true } }))._sum.usdCost || 0;

    for (const source of stale) {
      const userMsg = `=== CURRENT PROMPT ===\n${source.prompt}\n\n=== DERIVED RULES ===\n${rulesBlock}\n\n=== CO-OCCURRENCE PAIRS ===\n${cooccurBlock}\n\n=== STYLE SIGNATURES ===\n${styleBlock}\n\nReturn JSON now.`;

      let parsed: any;
      try {
        parsed = await improveWithGemini(userMsg);
      } catch (e: any) {
        if (!isQuotaError(e)) {
          details.push({ sourceId: source.id, kept: true, reason: `error: ${String(e.message || e).slice(0, 100)}` });
          continue;
        }
        try {
          parsed = await improveWithClaude(userMsg);
        } catch {
          details.push({ sourceId: source.id, kept: true, reason: "both models unavailable" });
          continue;
        }
      }

      if (parsed.keep) {
        details.push({ sourceId: source.id, kept: true });
        continue;
      }

      const upgradedPrompt = String(parsed.upgradedPrompt || "").trim();
      const reason = String(parsed.reason || "שדרוג אוטומטי").trim();
      if (upgradedPrompt.length < 100) {
        details.push({ sourceId: source.id, kept: true, reason: "response too short" });
        continue;
      }

      // Snapshot current before changing
      await snapshotCurrentVersion(source.id, "auto-improve", reason, snapshotId);
      const diff = computeTextDiff(source.prompt, upgradedPrompt);

      await prisma.learnSource.update({
        where: { id: source.id },
        data: { prompt: upgradedPrompt },
      });

      // Store diff in the just-created PromptVersion
      const latestVersion = await prisma.promptVersion.findFirst({
        where: { sourceId: source.id },
        orderBy: { version: "desc" },
      });
      if (latestVersion) {
        await prisma.promptVersion.update({
          where: { id: latestVersion.id },
          data: { diff: diff as any },
        });
      }

      improved++;
      details.push({ sourceId: source.id, kept: false, reason });
    }

    const endCost = (await prisma.apiUsage.aggregate({ _sum: { usdCost: true } }))._sum.usdCost || 0;
    totalCost = Math.max(0, endCost - startCost);

    await prisma.improvementRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        sourcesExamined: stale.length,
        sourcesImproved: improved,
        totalCostUsd: totalCost,
        status: "complete",
        summary: `נבדקו ${stale.length} פרומפטים · שודרגו ${improved}`,
      },
    });

    return { examined: stale.length, improved, totalCostUsd: totalCost, details };
  } catch (e: any) {
    await prisma.improvementRun.update({
      where: { id: run.id },
      data: { status: "failed", summary: String(e.message || e).slice(0, 300), completedAt: new Date() },
    });
    throw e;
  }
}
