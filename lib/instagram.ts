// Instagram reel / post → direct MP4 URL + caption + thumbnail.
// Uses instagram-url-direct for the CDN URL. Scrapes og meta tags for caption.

import { instagramGetUrl } from "instagram-url-direct";

export type IgExtract = {
  videoUrl: string | null;
  thumbnail: string | null;
  caption: string | null;
  sourceUrl: string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

async function fetchMetaTags(url: string): Promise<{ caption: string | null; thumbnail: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { caption: null, thumbnail: null };
    const html = await res.text();

    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1]
      || html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]
      || null;
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || null;

    const caption = ogDesc ? decodeHtmlEntities(ogDesc) : null;
    const thumbnail = ogImage ? decodeHtmlEntities(ogImage) : null;
    return { caption, thumbnail };
  } catch {
    return { caption: null, thumbnail: null };
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

export async function extractInstagram(url: string): Promise<IgExtract> {
  const clean = url.split("?")[0]; // strip tracking params
  const r = await instagramGetUrl(clean);
  const videoUrl = r?.url_list?.[0] || null;

  const meta = await fetchMetaTags(clean);

  return {
    videoUrl,
    thumbnail: meta.thumbnail,
    caption: meta.caption,
    sourceUrl: clean,
  };
}
