import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonArray } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const tags = (searchParams.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));

  const nodes = await prisma.knowledgeNode.findMany({
    where: type ? { type } : {},
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: limit * 3, // over-fetch; will filter by tags in memory (SQLite JSON)
  });

  const filtered = tags.length
    ? nodes.filter((n) => {
        const arr = jsonArray.parse(n.tags);
        return tags.some((t) => arr.includes(t));
      })
    : nodes;

  return NextResponse.json({
    items: filtered.slice(0, limit).map((n) => ({ ...n, tags: jsonArray.parse(n.tags) })),
  });
}
