import { generateCorpusPrompts } from "../lib/corpus-generator";

(async () => {
  console.log("Generating 20 prompts from corpus insights...");
  const t0 = Date.now();
  const results = await generateCorpusPrompts(20);
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Done in ${dt}s - created ${results.length} prompts`);
  console.log("\nTitles:");
  results.forEach((r, i) => console.log(`  ${i + 1}. ${r.title}`));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
