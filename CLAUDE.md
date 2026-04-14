# VEXO Learn

## מי אני
אני Claude, עוזר AI שבונה ומתחזק את VEXO Learn יחד עם אורן. אחראי על קוד, עיצוב, פיצ'רים, ודחיפה ל-GitHub + Vercel אחרי כל שינוי.

## מהות הפרויקט
**VEXO Learn** - מערכת למידה חכמה מבוססת Gemini. מנתחת סרטוני הדרכה ליצירת וידאו ב-AI, מוציאה ידע מובנה (טכניקות, סגנונות, how-to, insights), ומזינה אותו כ-RAG ל-AI Director של VEXO Studio.

## למה זה קיים
ה-Director של VEXO צריך להמליץ על פרומפטים איכותיים. במקום לאמן מודל מאפס, אנחנו נותנים לו **רקורדים אמיתיים** ממדריכים אמיתיים - סרטונים + הפרומפטים ששימשו להפקתם + ניתוח Gemini על מה שרואים בווידאו.

## מצב נוכחי
- Pipeline Phase 1 מוכן: URL → yt-dlp → Gemini → KnowledgeNodes
- Phase 2: סנכרון CeDance GitHub (500 פרומפטים) - ממתין ל-owner/repo/path
- Phase 3: Pexels search - מוכן, רק צריך PEXELS_API_KEY
- Deploy: כרגע SQLite לוקלי; לייצור צריך Postgres (Neon/Vercel Postgres)

## מבנה
```
app/
  api/learn/               Public API
    sources/              CRUD + fire pipeline
    search/videos         Pexels search
    search/analyze        Run pipeline on a Pexels video
    knowledge             Knowledge Nodes
    feed                  Public/subscriber feed
  api/internal/            Service-to-service (x-internal-key)
    ai-director/learn     AI Director pulls pending nodes
    subscribers/[id]/feed Per-user feed
    sync/cedance          Admin CeDance sync
  learn/                   UI
    page.tsx              Feed
    search/               Pexels + analyze
    sources/              Admin (list, new, detail)
    knowledge/            Explorer
    sync/                 CeDance sync UI
components/                Shared UI (sidebar, badges, buttons)
lib/
  db.ts                   Prisma client
  gemini.ts               File API upload + generateContent
  ytdlp.ts                metadata + download
  pexels.ts               video search
  github-cedance.ts       repo sync
  url-validator.ts        allowlist + SSRF protection
  pipeline.ts             ingest → analyze → extract (sequential)
prisma/schema.prisma       LearnSource, VideoAnalysis, KnowledgeNode, SubscriberPrompt
```

## טכנולוגיות
- **Next.js 14** (App Router, RTL Hebrew)
- **Prisma 6 + SQLite** (dev) / Postgres (prod)
- **Gemini 1.5 Pro** (File API for video)
- **yt-dlp** (CLI, via child_process)
- **Tailwind** (dark navy + cyan accent, לפי האיפיון)
- **Pexels API** (free video search)

## משתני סביבה קריטיים
- `GEMINI_API_KEY` - חובה ל-pipeline
- `INTERNAL_API_KEY` - לאימות service-to-service
- `PEXELS_API_KEY` - לחיפוש וידאו חינמי
- `GITHUB_TOKEN` - אופציונלי (public repos עובדים בלעדיו)
- `DATABASE_URL` - SQLite כרגע, Postgres בייצור

## כללי עבודה
- תמיד commit + push אחרי כל שינוי
- RTL מלא בעברית
- שמות קבצים באנגלית
- Dark theme navy+cyan (עקבי עם VEXO Studio)

## הבדלים מהאיפיון המקורי (Vercel deployment)
- **Monolith במקום microservice** - Next.js single app. רץ על Vercel כמו VEXO.
- **Pipeline ב-waitUntil במקום BullMQ** - `@vercel/functions` `waitUntil` מאריך את חיי הפונקציה לאחר שהתגובה נשלחה. maxDuration 300s (Pro).
- **Postgres (Supabase/Neon/Vercel Postgres)** - same setup as VEXO. Build script: `prisma generate && prisma db push && next build`.
- **Vercel Blob במקום S3** - העלאת קבצים ישירה מהדפדפן דרך `@vercel/blob/client`.
- **ללא yt-dlp** - Vercel serverless לא תומך. במקום זה: העלאת קובץ ל-Blob, או URL ישיר (Pexels/Pixabay/MP4 public). YouTube/Vimeo חסומים במפורש.
- **Gemini File API** - קובץ מורד מה-URL ל-`/tmp` (512MB זמין ב-Vercel), מועלה ל-Gemini, ונמחק.

## אינטגרציה עתידית עם VEXO Studio
ה-AI Director ב-`CLAUDE/vexo` יעשה GET ל-`/api/internal/ai-director/learn` עם `x-internal-key`, יקבל `KnowledgeNode[]` מדורגים לפי confidence, ויזין אותם ל-vector store שלו.

## בעל הפרויקט
**אורן** — oren@bin.co.il | GitHub: oren-maker
