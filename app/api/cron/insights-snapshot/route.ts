import { NextRequest, NextResponse } from "next/server";
import { snapshotInsights } from "@/lib/insights-snapshots";
import { runAutoImprovement } from "@/lib/auto-improve";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const snap = await snapshotInsights();
    // Auto-improve a small batch after every snapshot so the corpus keeps tightening.
    let improvement: any = null;
    try {
      improvement = await runAutoImprovement(snap.snapshotId, 3);
    } catch (e: any) {
      improvement = { error: String(e.message || e).slice(0, 300) };
    }
    return NextResponse.json({ ok: true, snapshot: snap, improvement });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
