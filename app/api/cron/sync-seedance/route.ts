import { NextRequest, NextResponse } from "next/server";
import { syncSeedanceRepo } from "@/lib/seedance-parser";

// Vercel Cron daily at 03:00 UTC.
// Protected by CRON_SECRET (auto-set by Vercel on crons, checked via Authorization header).

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncSeedanceRepo();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
