import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonArray } from "@/lib/db";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  return key && key === process.env.INTERNAL_API_KEY;
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const tags = (searchParams.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
  const limit = Math.min(50, Number(searchParams.get("limit") || 10));

  const subs = await prisma.subscriberPrompt.findMany({
    where: { userId: params.userId },
    include: { source: { include: { analysis: true } } },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
  });

  const filtered = tags.length
    ? subs.filter((s) => {
        if (!s.source.analysis) return false;
        const arr = jsonArray.parse(s.source.analysis.tags);
        return tags.some((t) => arr.includes(t));
      })
    : subs;

  return NextResponse.json({
    items: filtered.slice(0, limit).map((s) => ({
      id: s.id,
      viewed: s.viewed,
      saved: s.saved,
      prompt: s.source.prompt,
      title: s.source.title,
      thumbnail: s.source.thumbnail,
      analysis: s.source.analysis
        ? {
            description: s.source.analysis.description,
            tags: jsonArray.parse(s.source.analysis.tags),
            difficulty: s.source.analysis.difficulty,
          }
        : null,
    })),
  });
}
