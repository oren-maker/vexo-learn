import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonArray } from "@/lib/db";

// For MVP: when there's no logged-in user, returns all "complete" sources as a public feed.
// When userId provided, returns that subscriber's personal feed.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const tags = (searchParams.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
  const difficulty = searchParams.get("difficulty");
  const unread = searchParams.get("unread") === "true";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));

  if (userId) {
    const subs = await prisma.subscriberPrompt.findMany({
      where: {
        userId,
        ...(unread ? { viewed: false } : {}),
      },
      include: { source: { include: { analysis: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ items: subs });
  }

  // Public / admin view
  const items = await prisma.learnSource.findMany({
    where: { status: "complete" },
    include: { analysis: true },
    orderBy: { createdAt: "desc" },
    take: limit * 2,
  });

  const filtered = items.filter((s) => {
    if (!s.analysis) return true;
    if (difficulty && s.analysis.difficulty !== difficulty) return false;
    if (tags.length) {
      const arr = jsonArray.parse(s.analysis.tags);
      if (!tags.some((t) => arr.includes(t))) return false;
    }
    return true;
  });

  return NextResponse.json({ items: filtered.slice(0, limit) });
}
