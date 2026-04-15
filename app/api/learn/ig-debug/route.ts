import { NextRequest, NextResponse } from "next/server";
import { instagramGetUrl } from "instagram-url-direct";

export const runtime = "nodejs";
export const maxDuration = 60;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("u") || "";
  if (!url) return NextResponse.json({ error: "?u=<instagram url> required" }, { status: 400 });

  const out: any = { url };

  // 1. Try the library
  try {
    const r = await instagramGetUrl(url);
    out.library = { ok: true, urlListLen: r?.url_list?.length || 0, firstUrl: r?.url_list?.[0]?.slice(0, 200) || null };
  } catch (e: any) {
    out.library = { ok: false, error: String(e?.message || e).slice(0, 300) };
  }

  // 2. Raw HTML fetch
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    out.htmlFetch = {
      status: res.status,
      contentType: res.headers.get("content-type"),
    };
    if (res.ok) {
      const html = await res.text();
      out.htmlFetch.htmlLength = html.length;

      // Look for relevant patterns
      const ogVideo = html.match(/<meta\s+property="og:video"\s+content="([^"]*)"/i)?.[1];
      const ogVideoSecure = html.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]*)"/i)?.[1];
      const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1];
      const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1];
      const jsonVideo = html.match(/"video_url":"([^"]+)"/)?.[1];
      const videoVersions = html.match(/"video_versions":\[\{[^}]*"url":"([^"]+)"/)?.[1];
      const xdtVideo = html.match(/"playback_url":"([^"]+)"/)?.[1];

      out.htmlFetch.found = {
        ogVideo: ogVideo?.slice(0, 200) || null,
        ogVideoSecure: ogVideoSecure?.slice(0, 200) || null,
        ogImage: ogImage?.slice(0, 200) || null,
        ogDesc: ogDesc?.slice(0, 200) || null,
        jsonVideo: jsonVideo?.slice(0, 200) || null,
        videoVersions: videoVersions?.slice(0, 200) || null,
        xdtVideo: xdtVideo?.slice(0, 200) || null,
      };

      // Take a 500-char sample around any potential video reference
      const idx = html.search(/video_url|playback_url|og:video/i);
      out.htmlFetch.contextSnippet = idx >= 0 ? html.slice(Math.max(0, idx - 50), idx + 450) : "(no video keyword found)";
    }
  } catch (e: any) {
    out.htmlFetch = { error: String(e?.message || e).slice(0, 300) };
  }

  return NextResponse.json(out);
}
