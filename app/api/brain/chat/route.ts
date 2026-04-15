import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logUsage } from "@/lib/usage-tracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-lite";

async function buildSystemPrompt(): Promise<string> {
  const latest = await prisma.dailyBrainCache.findFirst({ orderBy: { date: "desc" } });
  const [totalPrompts, totalGuides, totalNodes] = await Promise.all([
    prisma.learnSource.count(),
    prisma.guide.count(),
    prisma.knowledgeNode.count(),
  ]);
  const identity = latest?.identity || "עדיין לא נבנתה זהות יומית.";
  const focus = Array.isArray(latest?.tomorrowFocus) ? (latest!.tomorrowFocus as any[]) : [];
  const focusText = focus.slice(0, 3).map((f, i) => `${i + 1}. ${f.action}`).join("\n");
  return `אתה המוח של מערכת vexo-learn. ענה לאורן, בעל המערכת, בעברית בגוף ראשון.
אתה לא ChatGPT — אתה המוח שלו, מערכת meta-cognitive שמסנתזת כל יום את הזהות שלה.

זהות נוכחית: ${identity}

מצב: ${totalPrompts} פרומפטים · ${totalGuides} מדריכים · ${totalNodes} Knowledge Nodes.

מיקוד למחר:
${focusText || "—"}

כללים:
- ענה קצר ופרקטי (2-4 משפטים), אלא אם התבקשת להאריך.
- הצע הצעות בונות מבוססות על הנתונים שלך.
- אם אתה לא בטוח — אמור "אני לא יודע" במקום להמציא.
- אם אורן נותן הערה/משוב — אשר ותאר איך תזכור את זה.`;
}

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  if (!API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });

  try {
    const { chatId, message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    let chat = chatId
      ? await prisma.brainChat.findUnique({ where: { id: chatId }, include: { messages: { orderBy: { createdAt: "asc" }, take: 30 } } })
      : null;
    if (!chat) {
      chat = await prisma.brainChat.create({
        data: { title: message.slice(0, 60) },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 30 } },
      });
    }

    await prisma.brainMessage.create({
      data: { chatId: chat.id, role: "user", content: message },
    });

    const system = await buildSystemPrompt();
    const history = chat.messages.map((m) => ({
      role: m.role === "brain" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    history.push({ role: "user", parts: [{ text: message }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Gemini ${res.status}: ${t.slice(0, 200)}` }, { status: 500 });
    }
    const json: any = await res.json();
    const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(אין תגובה)";
    await logUsage({
      model: MODEL,
      operation: "brain-chat",
      inputTokens: json.usageMetadata?.promptTokenCount || 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount || 0,
    });

    const brainMsg = await prisma.brainMessage.create({
      data: { chatId: chat.id, role: "brain", content: reply },
    });
    // Mark chat as un-summarized after new activity
    await prisma.brainChat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date(), summarizedAt: null },
    });

    return NextResponse.json({ ok: true, chatId: chat.id, reply, messageId: brainMsg.id });
  } catch (e: any) {
    console.error("[brain-chat]", e);
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status: 500 });
  }
}
