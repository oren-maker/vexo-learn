import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { sourceId, rating } = await req.json();
    if (!sourceId) return NextResponse.json({ ok: false, error: "sourceId נדרש" }, { status: 400 });
    const r = rating === null ? null : Number(rating);
    if (r !== null && (!Number.isInteger(r) || r < 1 || r > 5)) {
      return NextResponse.json({ ok: false, error: "דירוג חייב להיות 1-5 או null" }, { status: 400 });
    }
    await prisma.learnSource.update({
      where: { id: sourceId },
      data: { userRating: r },
    });
    return NextResponse.json({ ok: true, rating: r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
