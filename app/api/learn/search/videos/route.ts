import { NextRequest, NextResponse } from "next/server";
import { searchPexels } from "@/lib/pexels";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const source = searchParams.get("source") || "pexels";

  if (!q) return NextResponse.json({ error: "q נדרש" }, { status: 400 });

  try {
    if (source === "pexels") {
      const results = await searchPexels(q, 3);
      return NextResponse.json({ results });
    }
    return NextResponse.json({ error: "מקור לא נתמך" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
