import { syncAllRegistry } from "../lib/generic-md-parser";

async function main() {
  console.log("Syncing all registered prompt repos...");
  const t0 = Date.now();
  const results = await syncAllRegistry();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${dt}s`);
  let totalFetched = 0;
  let totalUpserted = 0;
  for (const r of results) {
    console.log(`\n${r.repo}:`);
    console.log(`  fetched: ${r.fetched}, upserted: ${r.upserted}, errors: ${r.errors.length}`);
    if (r.errors.length) r.errors.slice(0, 3).forEach((e) => console.log("   -", e));
    totalFetched += r.fetched;
    totalUpserted += r.upserted;
  }
  console.log(`\n=== TOTAL: ${totalUpserted} upserted (from ${totalFetched} parsed) ===`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
