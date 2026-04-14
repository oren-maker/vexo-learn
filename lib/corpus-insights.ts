// Corpus-level analytics — aggregate across all analyzed prompts to produce
// actionable learning insights. This is what "learning" actually means:
// not tagging individual prompts but discovering patterns across the corpus.

import { prisma } from "./db";

export type CooccurrencePair = {
  a: string;
  b: string;
  count: number;
  lift: number; // P(A and B) / (P(A) * P(B)). >1 = positively correlated.
};

export type StyleProfile = {
  style: string;
  count: number;
  avgTechniquesPerPrompt: number;
  topTechniques: Array<{ name: string; freqPct: number }>;
  topMoods: Array<{ name: string; freqPct: number }>;
  topTags: Array<{ name: string; freqPct: number }>;
  difficultyMix: Record<string, number>;
  signaturePhrases: string[]; // techniques that appear disproportionately in this style
};

export type GapOpportunity = {
  dimension: "style" | "mood" | "tag";
  value: string;
  currentCount: number;
  medianCount: number;
  suggestion: string;
};

export type TopPerformer = {
  sourceId: string;
  title: string | null;
  techniqueCount: number;
  tagCount: number;
  hasTimecodes: boolean;
  wordCount: number;
  richnessScore: number; // weighted combo
};

export type CorpusInsights = {
  totals: {
    sources: number;
    analyses: number;
    knowledgeNodes: number;
    avgTechniquesPerPrompt: number;
    avgWordsPerPrompt: number;
    promptsWithTimecodes: number;
  };
  topTechniques: Array<{ name: string; count: number; pct: number }>;
  topStyles: Array<{ name: string; count: number; pct: number }>;
  topMoods: Array<{ name: string; count: number; pct: number }>;
  topTags: Array<{ name: string; count: number; pct: number }>;
  difficultyDistribution: Record<string, number>;
  cooccurrencePairs: CooccurrencePair[];
  styleProfiles: StyleProfile[];
  gaps: GapOpportunity[];
  topPerformers: TopPerformer[];
  derivedRules: string[]; // actionable rules derived from the data
};

// ---- helpers ----

function countBy<T>(items: T[], key: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function sortMap(m: Map<string, number>, limit = 10) {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function toPct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

// ---- main analytics ----

export async function computeCorpusInsights(): Promise<CorpusInsights> {
  const analyses = await prisma.videoAnalysis.findMany({
    include: { source: true },
  });
  const nodeCount = await prisma.knowledgeNode.count();

  const total = analyses.length;
  if (total === 0) {
    return {
      totals: { sources: 0, analyses: 0, knowledgeNodes: 0, avgTechniquesPerPrompt: 0, avgWordsPerPrompt: 0, promptsWithTimecodes: 0 },
      topTechniques: [], topStyles: [], topMoods: [], topTags: [],
      difficultyDistribution: {}, cooccurrencePairs: [], styleProfiles: [],
      gaps: [], topPerformers: [], derivedRules: [],
    };
  }

  // ---- Global frequencies ----
  const techCount = new Map<string, number>();
  const styleCount = new Map<string, number>();
  const moodCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const difficulty: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0 };

  let totalTechniques = 0;
  let totalWords = 0;
  let promptsWithTimecodes = 0;

  for (const a of analyses) {
    for (const t of a.techniques) techCount.set(t, (techCount.get(t) || 0) + 1);
    if (a.style) styleCount.set(a.style, (styleCount.get(a.style) || 0) + 1);
    if (a.mood) moodCount.set(a.mood, (moodCount.get(a.mood) || 0) + 1);
    for (const tag of a.tags) tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    if (a.difficulty && difficulty[a.difficulty] !== undefined) difficulty[a.difficulty]++;

    totalTechniques += a.techniques.length;
    const wc = a.source.prompt.split(/\s+/).length;
    totalWords += wc;
    if (/\[?\d{1,2}[:.]\d{2}/.test(a.source.prompt)) promptsWithTimecodes++;
  }

  const topTechniques = sortMap(techCount, 15).map((x) => ({ ...x, pct: toPct(x.count, total) }));
  const topStyles = sortMap(styleCount, 10).map((x) => ({ ...x, pct: toPct(x.count, total) }));
  const topMoods = sortMap(moodCount, 10).map((x) => ({ ...x, pct: toPct(x.count, total) }));
  const topTags = sortMap(tagCount, 15).map((x) => ({ ...x, pct: toPct(x.count, total) }));

  // ---- Technique co-occurrence (pairs that appear together more than chance) ----
  const pairCount = new Map<string, number>();
  const topTechNames = topTechniques.slice(0, 20).map((x) => x.name);
  const techSet = new Set(topTechNames);

  for (const a of analyses) {
    const techs = a.techniques.filter((t) => techSet.has(t));
    for (let i = 0; i < techs.length; i++) {
      for (let j = i + 1; j < techs.length; j++) {
        const [x, y] = [techs[i], techs[j]].sort();
        const k = `${x}||${y}`;
        pairCount.set(k, (pairCount.get(k) || 0) + 1);
      }
    }
  }

  const cooccurrencePairs: CooccurrencePair[] = Array.from(pairCount.entries())
    .map(([k, count]) => {
      const [a, b] = k.split("||");
      const pA = (techCount.get(a) || 0) / total;
      const pB = (techCount.get(b) || 0) / total;
      const pAB = count / total;
      const lift = pA > 0 && pB > 0 ? pAB / (pA * pB) : 0;
      return { a, b, count, lift: Math.round(lift * 100) / 100 };
    })
    .filter((p) => p.count >= 3 && p.lift >= 1.2)
    .sort((a, b) => b.lift * b.count - a.lift * a.count)
    .slice(0, 12);

  // ---- Style profiles ----
  const styleProfiles: StyleProfile[] = [];
  for (const { name: styleName, count: styleN } of topStyles.slice(0, 6)) {
    const subset = analyses.filter((a) => a.style === styleName);
    const subTech = new Map<string, number>();
    const subMood = new Map<string, number>();
    const subTag = new Map<string, number>();
    const subDiff: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0 };
    let subTechTotal = 0;

    for (const a of subset) {
      for (const t of a.techniques) subTech.set(t, (subTech.get(t) || 0) + 1);
      if (a.mood) subMood.set(a.mood, (subMood.get(a.mood) || 0) + 1);
      for (const tag of a.tags) subTag.set(tag, (subTag.get(tag) || 0) + 1);
      if (a.difficulty && subDiff[a.difficulty] !== undefined) subDiff[a.difficulty]++;
      subTechTotal += a.techniques.length;
    }

    // Signature phrases: techniques with much higher freq here than globally
    const signature: string[] = [];
    for (const [tech, n] of Array.from(subTech.entries())) {
      const localPct = n / subset.length;
      const globalPct = (techCount.get(tech) || 0) / total;
      if (localPct >= 0.25 && localPct > globalPct * 1.8 && signature.length < 6) {
        signature.push(tech);
      }
    }

    styleProfiles.push({
      style: styleName,
      count: styleN,
      avgTechniquesPerPrompt: Math.round((subTechTotal / subset.length) * 10) / 10,
      topTechniques: sortMap(subTech, 5).map((x) => ({ name: x.name, freqPct: toPct(x.count, subset.length) })),
      topMoods: sortMap(subMood, 3).map((x) => ({ name: x.name, freqPct: toPct(x.count, subset.length) })),
      topTags: sortMap(subTag, 5).map((x) => ({ name: x.name, freqPct: toPct(x.count, subset.length) })),
      difficultyMix: subDiff,
      signaturePhrases: signature,
    });
  }

  // ---- Gap analysis: underrepresented style × mood combinations ----
  const gaps: GapOpportunity[] = [];
  const styleMedian = Math.max(1, Math.round(total / Math.max(topStyles.length, 1)));

  // Styles that are rare
  for (const s of topStyles) {
    if (s.count > 0 && s.count < styleMedian / 3) {
      gaps.push({
        dimension: "style",
        value: s.name,
        currentCount: s.count,
        medianCount: styleMedian,
        suggestion: `יש רק ${s.count} פרומפטים בסגנון "${s.name}". הוסף עוד כדי שה-AI Director יוכל להציע וריאציות בסגנון זה.`,
      });
    }
  }

  // Tags barely represented
  const tagMedian = Math.max(1, Math.round(total / Math.max(topTags.length * 2, 1)));
  const weakTags = topTags.filter((t) => t.count < tagMedian).slice(0, 3);
  for (const t of weakTags) {
    gaps.push({
      dimension: "tag",
      value: t.name,
      currentCount: t.count,
      medianCount: tagMedian,
      suggestion: `נושא "${t.name}" מיוצג חלש (${t.count} פרומפטים) — סדרה עם נושא זה תחזור עם פחות reference context.`,
    });
  }

  // ---- Top performers (richness score) ----
  const topPerformers: TopPerformer[] = analyses
    .map((a) => {
      const wc = a.source.prompt.split(/\s+/).length;
      const hasTC = /\[?\d{1,2}[:.]\d{2}/.test(a.source.prompt);
      const richnessScore =
        a.techniques.length * 2 +
        (hasTC ? 6 : 0) +
        a.tags.length +
        Math.min(wc / 100, 4);
      return {
        sourceId: a.sourceId,
        title: a.source.title,
        techniqueCount: a.techniques.length,
        tagCount: a.tags.length,
        hasTimecodes: hasTC,
        wordCount: wc,
        richnessScore: Math.round(richnessScore * 10) / 10,
      };
    })
    .sort((a, b) => b.richnessScore - a.richnessScore)
    .slice(0, 8);

  // ---- Derived rules (the actual "learning") ----
  const rules: string[] = [];
  const timecodePct = toPct(promptsWithTimecodes, total);
  const avgTech = Math.round((totalTechniques / total) * 10) / 10;
  const avgWords = Math.round(totalWords / total);

  if (timecodePct >= 30) {
    rules.push(`${timecodePct}% מהפרומפטים האיכותיים משתמשים ב-timecoded beats — זו חתימה של פרומפט לסרטון ארוך (10-15s).`);
  }
  rules.push(`ממוצע של ${avgTech} טכניקות קולנועיות לפרומפט. מתחת ל-${Math.max(1, avgTech - 2)} — הפרומפט דורש העשרה.`);
  rules.push(`אורך ממוצע: ${avgWords} מילים. פרומפטים של 100+ מילים ב-${topStyles[0]?.name || "Cinematic"} נותנים תוצאה עשירה יותר.`);

  if (cooccurrencePairs.length > 0) {
    const top = cooccurrencePairs[0];
    rules.push(`זוג טכניקות "${top.a}" + "${top.b}" מופיע יחד ב-${top.count} פרומפטים (lift ×${top.lift}) — שילוב מומלץ.`);
  }

  for (const p of styleProfiles.slice(0, 3)) {
    if (p.signaturePhrases.length > 0) {
      rules.push(`סגנון "${p.style}" מאופיין ב-: ${p.signaturePhrases.slice(0, 3).join(", ")}.`);
    }
  }

  // Correlation: do top performers share features?
  const tpAvgTech = topPerformers.reduce((s, p) => s + p.techniqueCount, 0) / Math.max(topPerformers.length, 1);
  const tpTimecodePct = toPct(topPerformers.filter((p) => p.hasTimecodes).length, topPerformers.length);
  rules.push(
    `הפרומפטים הטובים ביותר במאגר: ${Math.round(tpAvgTech)} טכניקות בממוצע (פי ${Math.max(1, Math.round(tpAvgTech / Math.max(avgTech, 1)))} מהממוצע), ${tpTimecodePct}% משתמשים ב-timecodes.`,
  );

  return {
    totals: {
      sources: total,
      analyses: total,
      knowledgeNodes: nodeCount,
      avgTechniquesPerPrompt: avgTech,
      avgWordsPerPrompt: avgWords,
      promptsWithTimecodes,
    },
    topTechniques,
    topStyles,
    topMoods,
    topTags,
    difficultyDistribution: difficulty,
    cooccurrencePairs,
    styleProfiles,
    gaps,
    topPerformers,
    derivedRules: rules,
  };
}
