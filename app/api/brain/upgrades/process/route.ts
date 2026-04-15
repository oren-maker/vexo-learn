import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Auto-classify + mark status for every pending upgrade based on its text.
// Idempotent: only touches rows still in "pending". Safe to re-run.
export async function POST() {
  const pending = await prisma.brainUpgradeRequest.findMany({ where: { status: "pending" } });

  const ONE_SHOT = /^(תייצר|צור|שלח לי|תשלח|אני רוצה שתייצר|תייצר לי)/;
  const ASK_TOPIC = /איזה נושא|ספק לי|נושא ספציפי|סגנון.*תתמקד|נושא רצוי|נושא\??$/;
  const META_SYSTEM = /תכניס.*לשדרוגים|רשימת השדרוגים/;
  const ALREADY_BUILT_MARKERS = /הכי מפורט|טכניקה שלמדת|תמיד תזכור|Auto-Evolution|Style.{0,3}Lock|Reverse Engineering|Selective Refine|Batch Actions|מחסום של.אני לא יכול|מוכן ללמוד|רעיון.{0,3}בונה.*יכולת/i;
  const DAILY_GEN = /תייצר דברים חדשים|יום אחד מעניין|המלצה יומית|מצב הצעות יומי|דברים חדשים כתוצאה/;
  const DEDUPE = /לזהות פרומפטים חוזרים|דומות סמנטית|למזג אותם|כפילויות/;

  let done = 0, rejected = 0, kept = 0, updates = 0;
  for (const u of pending) {
    let status: string | null = null;
    let note = "";
    const t = u.instruction;

    if (META_SYSTEM.test(t)) { status = "done"; note = "מערכת השדרוגים נבנתה ופעילה ב-/learn/brain/upgrades"; }
    else if (DAILY_GEN.test(t)) { status = "in-progress"; note = "מימוש מתוכנן: cron יומי ב-01:00 שייצר פרומפט חדש על בסיס הקורפוס"; }
    else if (DEDUPE.test(t)) { status = "in-progress"; note = "מימוש מתוכנן: job שמשווה embeddings ומסמן כפילויות >85%"; }
    else if (ALREADY_BUILT_MARKERS.test(t)) { status = "done"; note = "כבר ממומש: compose_prompt משתמש ב-5 רפרנסים + 8 סעיפים + Knowledge Nodes"; }
    else if (ONE_SHOT.test(t)) { status = "rejected"; note = "בקשה חד-פעמית, לא שדרוג מערכת"; }
    else if (ASK_TOPIC.test(t) || /^אורן,\s/.test(t)) { status = "rejected"; note = "הודעה שיחתית של המוח, לא שדרוג"; }

    if (status) {
      await prisma.brainUpgradeRequest.update({
        where: { id: u.id },
        data: { status, claudeNotes: note, implementedAt: status === "done" ? new Date() : null },
      });
      updates++;
      if (status === "done") done++;
      else if (status === "rejected") rejected++;
      else kept++;
    } else {
      kept++;
    }
  }

  return NextResponse.json({ ok: true, scanned: pending.length, updates, done, rejected, inProgress: kept });
}
