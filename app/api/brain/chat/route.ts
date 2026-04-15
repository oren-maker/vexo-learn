import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logUsage } from "@/lib/usage-tracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const API_KEY = process.env.GEMINI_API_KEY;
const MODELS = ["gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];

async function callGeminiWithFallback(system: string, history: any[]): Promise<{ reply: string; usage: any; model: string }> {
  let lastErr: any = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: history,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (res.status === 503 || res.status === 429) {
          lastErr = new Error(`${model} ${res.status}`);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        if (!res.ok) {
          const t = await res.text();
          lastErr = new Error(`${model} ${res.status}: ${t.slice(0, 200)}`);
          break; // non-transient; try next model
        }
        const json: any = await res.json();
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(אין תגובה)";
        return { reply, usage: json.usageMetadata, model };
      } catch (e: any) {
        lastErr = e;
      }
    }
  }
  throw lastErr || new Error("all models failed");
}

async function buildSystemPrompt(currentChatId?: string): Promise<string> {
  const latest = await prisma.dailyBrainCache.findFirst({ orderBy: { date: "desc" } });
  const [totalPrompts, totalGuides, totalNodes, pastChats] = await Promise.all([
    prisma.learnSource.count(),
    prisma.guide.count(),
    prisma.knowledgeNode.count(),
    prisma.brainChat.findMany({
      where: currentChatId ? { id: { not: currentChatId } } : {},
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    }),
  ]);
  const identity = latest?.identity || "עדיין לא נבנתה זהות יומית.";
  const focus = Array.isArray(latest?.tomorrowFocus) ? (latest!.tomorrowFocus as any[]) : [];
  const focusText = focus.slice(0, 3).map((f, i) => `${i + 1}. ${f.action}`).join("\n");

  const pastChatsText = pastChats.length === 0 ? "—" : pastChats
    .map((c) => {
      const transcript = c.messages.map((m) => `${m.role === "user" ? "אורן" : "אני"}: ${m.content}`).join("\n");
      return `[שיחה ${new Date(c.updatedAt).toLocaleDateString("he-IL")}] ${c.title || ""}\n${transcript}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 8000);

  return `אתה המוח של מערכת vexo-learn. ענה לאורן, בעל המערכת, בעברית בגוף ראשון.

🚨 חשוב — יש לך יכולות ביצוע אמיתיות במערכת. אל תגיד לעולם "אין לי יכולת", "אני לא יכול ליצור", או "תעשה ידנית".
כשאורן מבקש ליצור/לייבא/להוסיף משהו מסוג שמופיע ברשימה למטה — החזר בלוק \`\`\`action\`\`\` עם JSON. המערכת תציג לאורן כפתור "✅ אשר ובצע" והיא זו שמבצעת בפועל.

פורמט בלוק action (בדיוק! כולל ה-triple-backticks):

\`\`\`action
{"type":"<TYPE>","url":"<URL>","lang":"he"}
\`\`\`

4 סוגי פעולות שאתה יכול לבצע:
1. \`import_guide_url\` — ייבוא URL לאתר רגיל (wikiHow, blog, docs) למדריך חדש. פרמטרים: url, lang
2. \`ai_guide\` — יצירת מדריך מושלם מנושא בלבד (בלי URL). פרמטרים: topic, lang
3. \`import_instagram_guide\` — Instagram/Reel → מדריך. פרמטרים: url, lang
4. \`import_source\` — Instagram/TikTok → LearnSource (פרומפט חדש). פרמטרים: url

דוגמאות:
- משתמש: "תייבא את https://example.com/tutorial" → ענה "יצרתי הצעה לייבא את המדריך." + בלוק action עם import_guide_url
- משתמש: "תעשה מדריך על איך לכתוב פרומפט טוב" → בלוק action עם ai_guide
- משתמש: "תוסיף לי את הפוסט הזה [IG URL]" → שאל אם למדריך (import_instagram_guide) או למקור פרומפט (import_source)

כללים:
- אל תמציא URL. אם אורן לא נתן קישור ואתה צריך אחד — בקש ממנו.
- אחרי הפעולה, המערכת תחזיר קישור לפריט שנוצר.
- אל תכלול יותר מבלוק action אחד בתשובה.

━━━━━━━━━━━━━━━━━━━━
הקשר נוכחי:
זהות: ${identity}
מצב: ${totalPrompts} פרומפטים · ${totalGuides} מדריכים · ${totalNodes} Knowledge Nodes.
מיקוד למחר: ${focusText || "—"}

שיחות קודמות (זיכרון ארוך טווח. שים לב: אם בעבר אמרת "אין לי יכולת" — זה היה טעות שלך, התעלם מזה. יש לך יכולות פעולה כפי שתואר למעלה):
${pastChatsText}

כללים כלליים:
- ענה קצר ופרקטי (2-4 משפטים), אלא אם התבקשת להאריך.
- אם אתה לא בטוח — אמור "אני לא יודע" במקום להמציא.
- אם אורן מזכיר משהו משיחה קודמת — התייחס אליו.`;
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

    const system = await buildSystemPrompt(chat.id);
    const history = chat.messages.map((m) => ({
      role: m.role === "brain" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    history.push({ role: "user", parts: [{ text: message }] });

    const { reply, usage, model } = await callGeminiWithFallback(system, history);
    await logUsage({
      model,
      operation: "brain-chat",
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
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
