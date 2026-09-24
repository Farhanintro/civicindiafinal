#!/bin/bash
# CivicLens demo asset generation — realistic Indian civic issue photos
set -u
cd /home/z/my-project
mkdir -p public/samples
LOG=public/samples/gen.log
echo "START $(date)" > "$LOG"

gen() {
  local file="$1"; shift
  local prompt="$1"; shift
  if [ -s "public/samples/$file" ]; then echo "SKIP $file (exists)" >> "$LOG"; return; fi
  z-ai image -p "$prompt" -o "public/samples/$file" -s 1344x768 >> "$LOG" 2>&1 \
    && echo "OK $file" >> "$LOG" || echo "FAIL $file" >> "$LOG"
}

gen "pothole.png" "Realistic smartphone photo of a large deep pothole filled with muddy rainwater on a cracked asphalt city road in India, broken road surface, loose gravel, motorbike passing in background, overcast daylight, documentary evidence photo style, high quality"
gen "garbage.png" "Realistic smartphone photo of a large garbage pile with plastic bags and food waste dumped on the roadside corner in an Indian city street, stray dogs nearby, flies, daytime, documentary evidence photo style, high quality"
gen "water-leak.png" "Realistic smartphone photo of a clean water pipeline leakage on an Indian city road, water gushing and pooling over asphalt pavement near a residential area, morning light, documentary evidence photo style, high quality"
gen "streetlight.png" "Realistic smartphone photo of a broken bent streetlight pole with damaged lamp head hanging over an Indian city footpath at dusk, dim surroundings, wires exposed, documentary evidence photo style, high quality"
gen "manhole.png" "Realistic smartphone photo of an uncovered open manhole with broken concrete rim on an Indian city street, dark deep hole visible, warning stones placed around by locals, daytime, documentary evidence photo style, high quality"
gen "sewage.png" "Realistic smartphone photo of sewage drain overflow with black waste water spreading across an Indian city road edge, clogged open drainage, stagnant dirty water, daytime, documentary evidence photo style, high quality"
gen "dumping.png" "Realistic smartphone photo of illegal construction debris and rubble dumped beside a wall on an empty plot in an Indian city, bricks and concrete waste mixed with trash, daytime, documentary evidence photo style, high quality"
gen "obstruction.png" "Realistic smartphone photo of a large fallen tree branch blocking half of a city road in India, vehicles diverted, traffic buildup, daytime after storm, documentary evidence photo style, high quality"
gen "infrastructure.png" "Realistic smartphone photo of a damaged public bus stop shelter with broken fiberglass roof panel and bent metal bench on an Indian city street, daytime, documentary evidence photo style, high quality"
gen "after-pothole.png" "Realistic smartphone photo of a freshly repaired smooth asphalt road patch where a pothole used to be, clean tar surface, Indian city road, bright daylight, documentary photo style, high quality"
gen "after-garbage.png" "Realistic smartphone photo of a freshly cleaned Indian city street corner where garbage was removed, swept pavement, clean roadside, bright daylight, documentary photo style, high quality"
gen "hero.png" "Wide cinematic aerial view of an Indian city neighborhood at golden hour, dense streets with mixed residential buildings and roads, soft warm light, subtle haze, professional drone photography, teal and warm color grade, high quality"

echo "DONE $(date)" >> "$LOG"
