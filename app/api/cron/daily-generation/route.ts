import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { composePrompt } from "@/lib/gemini-compose";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const API_KEY = process.env.GEMINI_API_KEY;

// TODO: merge with composePrompt — currently 2 Gemini calls (topic pick + compose);
// composePrompt has its own keyword ref-picker + 2-attempt validation loop so inlining
// a `topic` parameter needs plumbing through multiple layers. Left as-is for now.
async function pickDailyTopic(): Promise<string> {
  // Use Gemini to pick a novel topic based on recent knowledge nodes + latest brain identity
  const [latestBrain, recentNodes, recentSources] = await Promise.all([
    prisma.dailyBrainCache.findFirst({ orderBy: { date: "desc" }, select: { identity: true } }),
    prisma.knowledgeNode.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { title: true, body: true } }),
    prisma.learnSource.findMany({ where: { addedBy: "daily-generation" }, orderBy: { createdAt: "desc" }, take: 10, select: { title: true } }),
  ]);
  const identity = latestBrain?.identity?.slice(0, 400) || "מערכת חדשה";
  const nodes = recentNodes.map((n) => `${n.title}: ${n.body?.slice(0, 60) || ""}`).slice(0, 15).join(" | ");
  const recent = recentSources.map((s) => s.title).filter(Boolean).join(" | ");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `אתה מוח של מערכת וידאו-פרומפטים.

זהות: ${identity}

Knowledge Nodes אחרונים: ${nodes}

נושאים שכבר יצרת ב-10 הימים האחרונים (אל תחזור!): ${recent}

החזר JSON בודד: {"brief": "תיאור מפורט של סצנה חדשה ויצירתית ליצירת פרומפט וידאו, 2-3 משפטים, בעברית, עם גיבור + סביבה + אווירה. לא דומה לנושאים הקודמים."}` }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 1.1, maxOutputTokens: 512 },
    }),
  });
  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.brief || text.slice(0, 300) || "סצנה דרמטית";
  } catch {
    // Model didn't return valid JSON — use raw text as brief
    return text.slice(0, 300) || "סצנה דרמטית";
  }
}

function slugify(text: string): string {
  const HE_TO_LAT: Record<string, string> = { א:"a",ב:"b",ג:"g",ד:"d",ה:"h",ו:"v",ז:"z",ח:"ch",ט:"t",י:"y",כ:"k",ך:"k",ל:"l",מ:"m",ם:"m",נ:"n",ן:"n",ס:"s",ע:"a",פ:"p",ף:"p",צ:"tz",ץ:"tz",ק:"k",ר:"r",ש:"sh",ת:"t" };
  return text.split("").map((c) => HE_TO_LAT[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "daily";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  try {
    const brief = await pickDailyTopic();
    const composed = await composePrompt(brief);
    const source = await prisma.learnSource.create({
      data: {
        type: "upload",
        prompt: composed.prompt,
        title: `🌅 ${brief.slice(0, 100)}`,
        status: "complete",
        addedBy: "daily-generation",
      },
    });
    return NextResponse.json({ ok: true, sourceId: source.id, brief, wordCount: composed.prompt.split(/\s+/).length });
  } catch (e: any) {
    console.error("[daily-generation]", e);
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status: 500 });
  }
}
