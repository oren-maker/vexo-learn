import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Scan all past user messages in chats. If a user message has instructional content
// but no corresponding BrainUpgradeRequest row exists, create one.
const INSTRUCTION_PATTERNS = [
  "תעשה", "תגדיר", "שיהיה", "שימור", "תזכור", "שדרוג", "תוסיף", "צריך ש", "חשוב ש",
  "תדאג", "שיופיע", "שהמוח", "תשדרג", "תרשם", "תשמור", "תדע", "תנסה", "תבדוק", "תחבר",
  "תייצר", "שתדע", "תעבור", "תחליף", "שינוי", "תקן", "תתקן", "לשדרוגים", "מתעדכן",
];

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;

  const userMessages = await prisma.brainMessage.findMany({
    where: { role: "user" },
    orderBy: { createdAt: "asc" },
    include: { chat: true },
  });

  const existing = await prisma.brainUpgradeRequest.findMany({ select: { messageId: true } });
  const existingIds = new Set(existing.map((e) => e.messageId).filter(Boolean));

  let created = 0;
  const samples: Array<{ id: string; text: string }> = [];

  for (const m of userMessages) {
    if (existingIds.has(m.id)) continue;
    if (m.content.length < 15) continue;
    const hit = INSTRUCTION_PATTERNS.some((p) => m.content.includes(p));
    if (!hit) continue;

    await prisma.brainUpgradeRequest.create({
      data: {
        chatId: m.chatId,
        messageId: m.id,
        instruction: m.content.slice(0, 2000),
        status: "pending",
        priority: 3,
      },
    });
    created++;
    if (samples.length < 10) samples.push({ id: m.id, text: m.content.slice(0, 120) });
  }

  return NextResponse.json({ ok: true, created, scanned: userMessages.length, samples });
}
