import { computeCorpusInsights } from "../lib/corpus-insights";
(async () => {
  const r = await computeCorpusInsights();
  console.log("=== Totals ===", r.totals);
  console.log("\n=== Derived rules ===");
  r.derivedRules.forEach((x, i) => console.log(`${i + 1}. ${x}`));
  console.log("\n=== Top co-occurrences ===");
  r.cooccurrencePairs.slice(0, 5).forEach((p) => console.log(`  ${p.a} + ${p.b} -> ${p.count}x (lift ${p.lift})`));
  console.log("\n=== Gaps ===");
  r.gaps.slice(0, 3).forEach((g) => console.log(`  [${g.dimension}] ${g.value}: ${g.suggestion}`));
  console.log("\n=== Top performer ===", r.topPerformers[0]);
  process.exit(0);
})();
