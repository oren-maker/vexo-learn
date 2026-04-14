import { syncSeedanceRepo } from "../lib/seedance-parser";

async function main() {
  console.log("Starting Seedance sync...");
  const t0 = Date.now();
  const result = await syncSeedanceRepo();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${dt}s`);
  console.log(`  fetched:  ${result.fetched}`);
  console.log(`  upserted: ${result.upserted}`);
  console.log(`  withVideo: ${result.withVideo}`);
  console.log(`  errors:   ${result.errors.length}`);
  if (result.errors.length) {
    console.log("First 10 errors:");
    result.errors.slice(0, 10).forEach((e) => console.log("  -", e));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
