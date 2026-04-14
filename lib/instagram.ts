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

async function tryInstagramDirect(clean: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await instagramGetUrl(clean);
      const url = r?.url_list?.[0];
      if (url) return url;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.warn(`[ig] attempt ${i + 1}/${attempts} failed:`, msg.slice(0, 200));
      // 572/429/5xx — Instagram proxy rate-limit or transient. Retry with backoff.
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
    }
  }
  return null;
}

export async function extractInstagram(url: string): Promise<IgExtract> {
  const clean = url.split("?")[0]; // strip tracking params

  // Run direct + meta in parallel. Meta tags work even when the direct URL fetch fails.
  const [videoUrl, meta] = await Promise.all([
    tryInstagramDirect(clean),
    fetchMetaTags(clean),
  ]);

  if (!videoUrl && !meta.caption && !meta.thumbnail) {
    throw new Error(
      "Instagram חסום זמנית. נסה שוב בעוד דקה-שתיים, או העלה את הקובץ ידנית דרך לשונית 'העלאת קובץ'.",
    );
  }

  return {
    videoUrl,
    thumbnail: meta.thumbnail,
    caption: meta.caption,
    sourceUrl: clean,
  };
}
