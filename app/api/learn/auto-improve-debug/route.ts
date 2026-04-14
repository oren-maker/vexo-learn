import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const total = await prisma.learnSource.count();
  const complete = await prisma.learnSource.count({ where: { status: "complete" } });
  const withAnalysis = await prisma.learnSource.count({ where: { analysis: { isNot: null } } });
  const completeWithAnalysis = await prisma.learnSource.count({
    where: { status: "complete", analysis: { isNot: null } },
  });
  const byStatus = await prisma.learnSource.groupBy({ by: ["status"], _count: true });

  // Sample top 3 weakest
  const candidates = await prisma.learnSource.findMany({
    where: { status: "complete", analysis: { isNot: null } },
    include: { analysis: true },
    take: 50,
  });
  const ranked = candidates
    .filter((s) => s.analysis)
    .map((s) => {
      const techniques = s.analysis!.techniques.length;
      const words = s.prompt.split(/\s+/).length;
      const hasTimecodes = /\b\d{1,2}:\d{2}\b/.test(s.prompt) ? 1 : 0;
      const score = techniques * 3 + Math.min(words / 40, 10) + hasTimecodes * 2;
      return { id: s.id, title: s.title, techniques, words, hasTimecodes, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return NextResponse.json({
    total,
    complete,
    withAnalysis,
    completeWithAnalysis,
    byStatus,
    topWeakest: ranked,
    geminiKeySet: !!process.env.GEMINI_API_KEY,
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
  });
}
