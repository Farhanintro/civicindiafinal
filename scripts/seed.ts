// CivicLens demo seed — run with: bun run seed  (add --reset to reseed demo data,
// --hard-reset to wipe ALL data and reseed for a pristine demo state)
// (bun auto-loads .env; tsconfig path aliases are respected by bun)
import { seedDemoData } from "../src/lib/services/seed-service";
import { log } from "../src/lib/services/logger";

const hardReset = process.argv.includes("--hard-reset");
const reset = process.argv.includes("--reset");
const result = await seedDemoData({ reset, hardReset });
log.info("api_ok", { route: "seed", ...result });
console.log(
  result.seeded
    ? `✓ Seeded ${result.incidents} demo incidents (${(result as { reports?: number }).reports ?? 0} reports) across India${hardReset ? " (hard reset)" : ""}.`
    : `• Demo data already present (${result.incidents} incidents). Use --reset to reseed or --hard-reset for a full wipe.`
);
process.exit(0);
