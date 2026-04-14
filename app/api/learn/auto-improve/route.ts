import { NextRequest, NextResponse } from "next/server";
import { runAutoImprovement } from "@/lib/auto-improve";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { snapshotId, max } = await req.json();
    if (!snapshotId) return NextResponse.json({ ok: false, error: "snapshotId נדרש" }, { status: 400 });
    const r = await runAutoImprovement(snapshotId, max || 5);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
