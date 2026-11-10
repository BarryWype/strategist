// Plays 1000 runs (SIM_RUNS to change) with the balance bot and writes doc/sim-report.md.
// `-- --log "<label>"` also appends this run's row to the report's balance log, which every run keeps.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { fightRules } from '@/content/fight';
import { runRules } from '@/content/run';
import { playRun, type RunRecord } from '@/game/sim/bot';

const RUNS = Number(process.env.SIM_RUNS ?? 1000);
const started = Date.now();
const records: RunRecord[] = Array.from({ length: RUNS }, (_, i) => playRun(`sim-${i}`));
const seconds = ((Date.now() - started) / 1000).toFixed(1);

const sum = (f: (r: RunRecord) => number) => records.reduce((total, r) => total + f(r), 0);
const pct = (n: number, of: number) => (of === 0 ? '–' : `${((100 * n) / of).toFixed(1)}%`);
const avg = (f: (r: RunRecord) => number) => (sum(f) / records.length).toFixed(2);

const wins = sum((r) => (r.won ? 1 : 0));
const bossFights = sum((r) => (r.bossFought ? 1 : 0));
const crossings = { held: sum((r) => r.crossings.held), bent: sum((r) => r.crossings.bent), broken: sum((r) => r.crossings.broken) };
const crossingTotal = crossings.held + crossings.bent + crossings.broken;
const fights = sum((r) => r.fights);
const forwards = sum((r) => r.forwards);
const reachedRows = Array.from({ length: runRules.rows }, (_, i) => i + 1).map((n) => [n, records.filter((r) => r.reached === n).length] as const);

/** When more than 1 in 4 of Go forward's effects make things worse, the cases, to see why. */
function worseCases(): string {
  const worse = sum((r) => r.forwardWorse);
  if (worse * 4 <= sum((r) => r.forwardBetter + r.forwardWorse)) return '';
  const cases = records.flatMap((r) => r.worseCases.map((c) => `| ${r.seed} | ${c.row + 1} | ${c.crossing} | ${c.before} → ${c.after} | ${c.help} |`));
  return `
More than 1 in 4 of its effects made things worse:

| Seed | Row | Crossing | Result | Help |
|---|---|---|---|---|
${cases.join('\n')}
`;
}

/** The base game's targets, with this run's value and whether it is met. */
function targets(): string {
  const losses = Array.from({ length: runRules.rows }, (_, i) => records.filter((r) => !r.won && r.reached === i + 1).length / RUNS);
  const enemyStrength = (row: number) => {
    const rooms = records.flatMap((r) => r.rooms).filter((room) => room.row === row);
    return rooms.reduce((total, room) => total + room.enemyStrength, 0) / Math.max(1, rooms.length);
  };
  const curve = enemyStrength(7) / enemyStrength(0);
  const share = (n: number, of: number) => (of === 0 ? 0 : n / of);
  const rows: [string, string, string, boolean][] = [
    ['Win rate', '0–10%', pct(wins, RUNS), share(wins, RUNS) <= 0.1],
    ['Boss reached', '35–50%', pct(bossFights, RUNS), share(bossFights, RUNS) >= 0.35 && share(bossFights, RUNS) <= 0.5],
    ['Boss win rate (of runs reaching him)', '25–35%', pct(wins, bossFights), share(wins, bossFights) >= 0.25 && share(wins, bossFights) <= 0.35],
    ['Most losses on one row', 'at most 25%', `${pct(Math.max(...losses), 1)} (row ${losses.indexOf(Math.max(...losses)) + 1})`, Math.max(...losses) <= 0.25],
    ['Deaths per run', '1–3', avg((r) => r.deaths), sum((r) => r.deaths) / RUNS >= 1 && sum((r) => r.deaths) / RUNS <= 3],
    ['Crossings Broken', '15–25%', pct(crossings.broken, crossingTotal), share(crossings.broken, crossingTotal) >= 0.15 && share(crossings.broken, crossingTotal) <= 0.25],
    ['Go forward: improved vs worsened', 'at least 3×', `${sum((r) => r.forwardBetter)} / ${sum((r) => r.forwardWorse)}`, sum((r) => r.forwardBetter) >= 3 * sum((r) => r.forwardWorse)],
    ['Enemy strength, row 8 vs row 1', 'about 2.5× (2–3×)', `${curve.toFixed(1)}×`, curve >= 2 && curve <= 3],
  ];
  return rows.map(([measure, target, now, met]) => `| ${measure} | ${target} | ${now} | ${met ? 'met' : 'off'} |`).join('\n');
}

function byRow(): string {
  const rooms = records.flatMap((r) => r.rooms);
  return Array.from({ length: runRules.rows }, (_, row) => rooms.filter((room) => room.row === row))
    .map((rs, row) => {
      if (rs.length === 0) return `| ${row + 1} | 0 | | | | | | |`;
      const mean = (f: (room: (typeof rs)[number]) => number) => rs.reduce((total, room) => total + f(room), 0) / rs.length;
      const crossingCount = rs.reduce((total, room) => total + room.crossings, 0);
      const brokenCount = rs.reduce((total, room) => total + room.broken, 0);
      return `| ${row + 1} | ${rs.length} | ${mean((room) => room.heroes).toFixed(1)} | ${pct(mean((room) => room.hpShare), 1)} | ${mean((room) => room.tired).toFixed(1)} | ${mean((room) => room.packHp).toFixed(0)} | ${(mean((room) => room.partyStrength) / 1000).toFixed(1)}k vs ${(mean((room) => room.enemyStrength) / 1000).toFixed(1)}k | ${pct(brokenCount, crossingCount)} |`;
    })
    .join('\n');
}

const report = `# Balance report

${RUNS} runs with the balance bot (\`npm run sim:poc\`, seeds \`sim-0\` to \`sim-${RUNS - 1}\`), in ${seconds} s.

The bot picks a random next room. In the briefing it sends heroes greedily to answer each crossing's threats, then the rest
by strength to the crossing whose heroes are weakest against its pack; heroes at death's door stay on the bench while there are
enough others. In the aftermath it tends first, then searches, then visits the peddler (rations, two draughts, a storm flask
from row 6, a recruit below six heroes), then buries and repairs. It goes forward with a healing draught when a crossing's tug
falls below 0.3.

## Targets (no unlocks)

| Measure | Target | Now | |
|---|---|---|---|
${targets()}

## Runs

| | |
|---|---|
| Win rate | ${pct(wins, RUNS)} (${wins} of ${RUNS}) |
| Ends: win / rout / wipe / boss stands | ${(['win', 'rout', 'wipe', 'bossStands'] as const).map((k) => pct(sum((r) => (r.end === k ? 1 : 0)), RUNS)).join(' / ')} |
| Reached the boss | ${pct(bossFights, RUNS)} |
| Boss win rate (of runs reaching him) | ${pct(wins, bossFights)} |
| Deaths per run | ${avg((r) => r.deaths)} |
| Heroes sent hungry per run | ${avg((r) => r.hungry)} |
| Gold left at the end | ${avg((r) => r.goldLeft)} |

## Room reached

The node the run ended on (the boss is the ${runRules.rows}th).

| Node | Runs |
|---|---|
${reachedRows.map(([n, count]) => `| ${n} | ${count} (${pct(count, RUNS)}) |`).join('\n')}

## By row

The party as it went into each fight (averages over the fights on that row), and how often a crossing broke there.

| Row | Fights | Heroes | HP share | Tired | Enemy HP in the room | Party vs enemy strength | Broken crossings |
|---|---|---|---|---|---|---|---|
${byRow()}

## Crossings

| Result | Crossings |
|---|---|
| Held | ${crossings.held} (${pct(crossings.held, crossingTotal)}) |
| Bent | ${crossings.bent} (${pct(crossings.bent, crossingTotal)}) |
| Broken | ${crossings.broken} (${pct(crossings.broken, crossingTotal)}) |

## Go forward

| | |
|---|---|
| Rooms where the bot went forward | ${forwards} of ${fights} fights (${pct(forwards, fights)}) |
| Crossings it improved | ${sum((r) => r.forwardBetter)} |
| Crossings it worsened | ${sum((r) => r.forwardWorse)} (${pct(sum((r) => r.forwardWorse), sum((r) => r.forwardBetter + r.forwardWorse))} of its effects) |
${worseCases()}
## Round cap

| | |
|---|---|
| Fights that hit the round cap (${fightRules.maxRounds} rounds) | ${sum((r) => r.timedOut)} of ${fights} (${pct(sum((r) => r.timedOut), fights)}) |
| Boss fights that hit it | ${sum((r) => (r.bossTimedOut ? 1 : 0))} of ${bossFights} |
`;

const LOG_HEADING = '## Balance log';
const out = path.join(process.cwd(), 'doc/sim-report.md');
const previous = existsSync(out) ? readFileSync(out, 'utf8') : '';
const logStart = previous.indexOf(LOG_HEADING);
let log =
  logStart >= 0
    ? previous.slice(logStart).trimEnd()
    : `${LOG_HEADING}

One row per balance change, from \`npm run sim:poc -- --log "<label>"\`.

| Change | Win rate | Boss reached | Deaths per run | Held / Bent / Broken | Most runs end on | Go forward improved / worsened |
|---|---|---|---|---|---|---|`;
const label = process.argv.includes('--log') ? process.argv[process.argv.indexOf('--log') + 1] : undefined;
if (label) {
  const [endRow, endCount] = [...reachedRows].sort((a, b) => b[1] - a[1])[0];
  const share = (n: number) => pct(n, crossingTotal);
  log += `\n| ${label} | ${pct(wins, RUNS)} | ${pct(bossFights, RUNS)} | ${avg((r) => r.deaths)} | ${share(crossings.held)} / ${share(crossings.bent)} / ${share(crossings.broken)} | node ${endRow} (${pct(endCount, RUNS)}) | ${sum((r) => r.forwardBetter)} / ${sum((r) => r.forwardWorse)} |`;
}
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${report}\n${log}\n`);
console.log(report);
console.log(`Written to ${out}`);
