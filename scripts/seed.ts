// CivicLens demo seed — run with: bun run seed
//   --base-only   seed ONLY categories + departments (no demo data) → run purely on REAL data
//   --reset       reseed demo data (real citizen reports are preserved)
//   --hard-reset  wipe ALL data and reseed for a pristine demo state
// (bun auto-loads .env; tsconfig path aliases are respected by bun)
import { seedDemoData } from "../src/lib/services/seed-service";
import { log } from "../src/lib/services/logger";

const hardReset = process.argv.includes("--hard-reset");
const reset = process.argv.includes("--reset");
const baseOnly = process.argv.includes("--base-only");
const result = await seedDemoData({ reset, hardReset, baseOnly });
log.info("api_ok", { route: "seed", ...result });
if ("baseOnly" in result && result.baseOnly) {
  console.log(
    "✓ Base data ready (10 categories + 8 departments). No demo incidents seeded — you are running on REAL data only.\n" +
      "  Log in with any name (Citizen or Authority) at http://localhost:3000"
  );
} else {
  console.log(
    result.seeded
      ? `✓ Seeded ${result.incidents} demo incidents (${(result as { reports?: number }).reports ?? 0} reports) across India${hardReset ? " (hard reset)" : ""}.`
      : `• Demo data already present (${result.incidents} incidents). Use --reset to reseed or --hard-reset for a full wipe.`
  );
}
process.exit(0);
