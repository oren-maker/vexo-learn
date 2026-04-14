const ALLOWED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "pexels.com",
  "www.pexels.com",
  "videos.pexels.com",
  "pixabay.com",
  "cdn.pixabay.com",
];

export function validateUrl(url: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "כתובת URL לא חוקית" };
  }
  if (!["http:", "https:"].includes(parsed.protocol))
    return { ok: false, reason: "רק HTTP/HTTPS נתמכים" };

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    host.startsWith("169.254.") ||
    host === "::1"
  ) {
    return { ok: false, reason: "כתובות פנימיות חסומות" };
  }

  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  if (!allowed) return { ok: false, reason: `מארח לא מאושר (${host}). מותר: YouTube, Vimeo, Pexels, Pixabay` };
  return { ok: true };
}
