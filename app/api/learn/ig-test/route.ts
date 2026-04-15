import { NextRequest, NextResponse } from "next/server";
import { extractInstagram } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("u") || "";
  if (!url) return NextResponse.json({ error: "?u= required" }, { status: 400 });
  try {
    const r = await extractInstagram(url);
    return NextResponse.json({
      ok: true,
      hasVideoUrl: !!r.videoUrl,
      hasCaption: !!r.caption,
      hasThumbnail: !!r.thumbnail,
      videoUrlHead: r.videoUrl?.slice(0, 200) || null,
      captionHead: r.caption?.slice(0, 200) || null,
      thumbnailHead: r.thumbnail?.slice(0, 200) || null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message || e).slice(0, 300) }, { status: 500 });
  }
}
