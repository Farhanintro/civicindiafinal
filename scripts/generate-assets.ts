// CivicLens asset generator — parallel image generation via z-ai-web-dev-sdk.
// Idempotent: skips files that already exist.
import ZAI from "z-ai-web-dev-sdk";
import { existsSync, writeFileSync, mkdirSync, statSync } from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "public", "samples");
mkdirSync(OUT, { recursive: true });

const SIZE = "1344x768" as const;

const IMAGES: { file: string; prompt: string }[] = [
  { file: "garbage.png", prompt: "Realistic smartphone photo of a large garbage pile with plastic bags and food waste dumped on the roadside corner in an Indian city street, stray dogs nearby, flies, daytime, documentary evidence photo style, high quality" },
  { file: "water-leak.png", prompt: "Realistic smartphone photo of a clean water pipeline leakage on an Indian city road, water gushing and pooling over asphalt pavement near a residential area, morning light, documentary evidence photo style, high quality" },
  { file: "streetlight.png", prompt: "Realistic smartphone photo of a broken bent streetlight pole with damaged lamp head hanging over an Indian city footpath at dusk, dim surroundings, wires exposed, documentary evidence photo style, high quality" },
  { file: "manhole.png", prompt: "Realistic smartphone photo of an uncovered open manhole with broken concrete rim on an Indian city street, dark deep hole visible, warning stones placed around by locals, daytime, documentary evidence photo style, high quality" },
  { file: "sewage.png", prompt: "Realistic smartphone photo of sewage drain overflow with black waste water spreading across an Indian city road edge, clogged open drainage, stagnant dirty water, daytime, documentary evidence photo style, high quality" },
  { file: "dumping.png", prompt: "Realistic smartphone photo of illegal construction debris and rubble dumped beside a wall on an empty plot in an Indian city, bricks and concrete waste mixed with trash, daytime, documentary evidence photo style, high quality" },
  { file: "obstruction.png", prompt: "Realistic smartphone photo of a large fallen tree branch blocking half of a city road in India, vehicles diverted, traffic buildup, daytime after storm, documentary evidence photo style, high quality" },
  { file: "infrastructure.png", prompt: "Realistic smartphone photo of a damaged public bus stop shelter with broken fiberglass roof panel and bent metal bench on an Indian city street, daytime, documentary evidence photo style, high quality" },
  { file: "after-pothole.png", prompt: "Realistic smartphone photo of a freshly repaired smooth asphalt road patch where a pothole used to be, clean tar surface, Indian city road, bright daylight, documentary photo style, high quality" },
  { file: "after-garbage.png", prompt: "Realistic smartphone photo of a freshly cleaned Indian city street corner where garbage was removed, swept pavement, clean roadside, bright daylight, documentary photo style, high quality" },
  { file: "hero.png", prompt: "Wide cinematic aerial view of an Indian city neighborhood at golden hour, dense streets with mixed residential buildings and roads, soft warm light, subtle haze, professional drone photography, teal and warm color grade, high quality" },
];

async function generateOne(zai: Awaited<ReturnType<typeof ZAI.create>>, item: { file: string; prompt: string }, attempt = 1): Promise<boolean> {
  const target = path.join(OUT, item.file);
  if (existsSync(target) && statSize(target) > 10000) {
    console.log(`✓ skip ${item.file}`);
    return true;
  }
  try {
    const res = await zai.images.generations.create({ prompt: item.prompt, size: SIZE });
    const b64 = res.data?.[0]?.base64;
    if (!b64) throw new Error("no image data");
    writeFileSync(target, Buffer.from(b64, "base64"));
    console.log(`✓ ${item.file}`);
    return true;
  } catch (err) {
    console.error(`✗ ${item.file} (attempt ${attempt}): ${String(err).slice(0, 120)}`);
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 3000));
      return generateOne(zai, item, attempt + 1);
    }
    return false;
  }
}

function statSize(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

const zai = await ZAI.create();
const CONCURRENCY = 4;
let ok = 0;
for (let i = 0; i < IMAGES.length; i += CONCURRENCY) {
  const batch = IMAGES.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map((item) => generateOne(zai, item)));
  ok += results.filter(Boolean).length;
}
console.log(`DONE ${ok}/${IMAGES.length}`);
process.exit(ok === IMAGES.length ? 0 : 1);
