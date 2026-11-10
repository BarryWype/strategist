# Step 8 – Balance pass: fairness rules, run growth and a better bot

Paste the shared context from the POC prompts above this step.

The base game (no meta-progression yet) should be **hard but fair**: a first run is expected to fail, but it should fail late and for reasons the player can see. Meta-progression comes in a later step and will raise the odds; this step only adds the rules that make losses fair, gives the party a way to grow during a run, and tunes the enemy curve to the targets below.

Work through the parts in order. **After each part**, run `npm run sim:poc` and add one row to a new "Balance log" table at the end of `doc/sim-report.md` (part, win rate, boss reached, deaths per run, Held / Bent / Broken shares, the row where most runs end and its share, Go forward improved / worsened). Update tests for every rule you change. Stop for review after parts 1, 4 and 7.

## Targets (no unlocks)

| Measure | Target |
|---|---|
| Win rate | 0–10% |
| Boss reached | 35–50% |
| Runs ending on any single row | at most 25% |
| Deaths per run | 2–4 |
| Crossings Broken | 15–25% |
| Crossings Bent | 15–25% |
| Go forward | improves at least 3× as many crossings as it worsens |

## Part 1 – A better bot (`src/game/sim/bot.ts`)

Measure what was the bot's fault before changing any rule.

- **Rotation:** in the briefing, the bot benches tired heroes as long as every crossing still gets at least one hero.
- **Accepting a breach:** if filling a crossing would mean sending a hero at death's door, and that crossing's pack is the weakest of the room (lowest HP × damage), the bot leaves it empty.
- **Go forward earlier:** when a crossing's tug falls below 0.45 (was 0.3) and the bot holds a healing draught or a flask.
- **Aftermath order:** tend heroes at death's door first; then rest a tired hero if more than half the roster is tired; then search; then the peddler; then bury.
- Bot tests for each rule.

Stop for review with the numbers.

## Part 2 – Recovery (`src/content/run.ts`, `src/game/run/run.ts`)

- Heroes who **fought** heal 15% of their max HP after the room (new `runRules.foughtHeal: 0.15`), applied after knockouts are resolved; a hero at death's door gets it too.
- Heroes who **sat out** heal 40% (`runRules.benchHeal: 0.4`, was 0.25).

## Part 3 – Fatigue (`src/content/fight.ts`, `src/game/run/run.ts`, `src/game/run/types.ts`)

- Replace the `foughtLast` flag with a counter `roomsInARow`: +1 for each room fought, back to 0 after a room on the bench, at a camp, or when "rest" (the current repair action) is used.
- A hero is **tired from their 4th room in a row** (`runRules.tiredAfter: 3`).
- Tired heroes deal **−10%** damage (`fightRules.tiredDamage: 0.9`, was 0.8).
- The briefing shows each hero's counter so the player sees fatigue coming (the screen work can wait; expose it in the run state).

## Part 4 – Breaches (`src/game/fight/engine.ts`, `breach()` and the centre logic)

- Breached enemies reach the centre **2 rounds** after the breach (they currently join from the next round).
- Only **half of them, rounded up** (the strongest first), go on to join another crossing. The others stay on the broken crossing to loot it: a hero who **died** on that crossing can't be buried for their gear and keepsake; the grave shows "looted".
- Event lines: "Half of them stay to loot the stairs" (importance 2).
- Tests: the 2-round delay, the half that moves, looted graves.

Stop for review with the numbers after parts 2–4.

## Part 5 – Go forward never backfires (`resumeFight` in `src/game/fight/engine.ts`)

Revert the derived seed: after an intervention, the resumed fight continues **with the RNG state saved in the snapshot**, not a new seed. The help changes the fight; the luck stays the same. Update the resume tests: with no intervention the timeline is unchanged; with a heal, the healed hero's HP is higher in every later snapshot until they are hit again.

Report how often Go forward still makes a crossing worse. If above 1 in 4 of its effects, list the cases in the report so we can see why.

## Part 6 – Growth during the run

**Better weapons** (`src/content/gear.ts`, `search()` in `src/game/run/run.ts`, `lootRules`):
- Two quality steps above the starting gear: **Fine** (+2 to the weapon's damage stat) and **Masterwork** (+4). Same families as the base weapon. Shown in the name ("Fine mace").
- A weapon dropped by searching is Fine on rows 1–3 and Masterwork from row 4, with the existing `weaponChance` (0.35).
- The peddler sells one Fine weapon per visit at 35 gold.

**Veterans** (`src/game/run/types.ts`, `run.ts`):
- Each room a hero fights gives them **+5% max HP and damage**, up to **+25%** (5 rooms). Kept on the hero's run state, shown in the report ("Bram: veteran +15%").
- A recruit starts at +0%.

## Part 7 – The enemy curve (`src/game/run/rooms.ts`, `roomRules`, the enemy scale in `src/content/enemies.ts`)

- Add a column to the sim report's "By row" table: **party strength vs enemy strength** (the sum of HP × damage of the heroes sent, and of the room's enemies), so the curve can be read directly.
- Tune only `roomRules` (pack size, crossings per row, `toughFromRow`) and the enemy scale until the targets are met. Enemy strength from row 1 to the boss should grow roughly 2.5×, more gently than now (about 4.5× in enemy HP).
- Don't touch heroes, gear or families to hit the targets.

## Part 8 – Prepare for meta-progression (`scripts/`, `src/game/sim/`)

- `npm run sim:poc -- --meta <level>`: accepted and recorded in the report, does nothing yet.
- The report's run table gets a "meta level" line.

Stop for review with the final numbers, the balance log, and a short list of anything still off.
