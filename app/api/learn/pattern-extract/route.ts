import { NextResponse } from "next/server";
import { extractAllDeterministic } from "@/lib/text-knowledge-extractor";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const r = await extractAllDeterministic();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
