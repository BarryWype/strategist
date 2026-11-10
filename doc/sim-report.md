# Balance report

1000 runs with the balance bot (`npm run sim:poc`, seeds `sim-0` to `sim-999`), in 3.1 s.

The bot picks a random next room. In the briefing it sends heroes greedily to answer each crossing's threats, then the rest
by strength to the crossing whose heroes are weakest against its pack; heroes at death's door stay on the bench while there are
enough others. In the aftermath it tends first, then searches, then visits the peddler (rations, two draughts, a storm flask
from row 6, a recruit below six heroes), then buries and repairs. It goes forward with a healing draught when a crossing's tug
falls below 0.3.

## Targets (no unlocks)

| Measure | Target | Now | |
|---|---|---|---|
| Win rate | 0–10% | 9.9% | met |
| Boss reached | 35–50% | 30.9% | off |
| Boss win rate (of runs reaching him) | 25–35% | 32.0% | met |
| Most losses on one row | at most 25% | 27.4% (row 7) | off |
| Deaths per run | 1–3 | 3.12 | off |
| Crossings Broken | 15–25% | 21.6% | met |
| Go forward: improved vs worsened | at least 3× | 633 / 39 | met |
| Enemy strength, row 8 vs row 1 | about 2.5× (2–3×) | 3.6× | off |

## Runs

| | |
|---|---|
| Win rate | 9.9% (99 of 1000) |
| Ends: win / rout / wipe / boss stands | 9.9% / 88.9% / 1.2% / 0.0% |
| Reached the boss | 30.9% |
| Boss win rate (of runs reaching him) | 32.0% |
| Deaths per run | 3.12 |
| Heroes sent hungry per run | 0.00 |
| Gold left at the end | 54.98 |

## Room reached

The node the run ended on (the boss is the 9th).

| Node | Runs |
|---|---|
| 1 | 0 (0.0%) |
| 2 | 0 (0.0%) |
| 3 | 35 (3.5%) |
| 4 | 59 (5.9%) |
| 5 | 7 (0.7%) |
| 6 | 164 (16.4%) |
| 7 | 274 (27.4%) |
| 8 | 152 (15.2%) |
| 9 | 309 (30.9%) |

## By row

The party as it went into each fight (averages over the fights on that row), and how often a crossing broke there.

| Row | Fights | Heroes | HP share | Tired | Enemy HP in the room | Party vs enemy strength | Broken crossings |
|---|---|---|---|---|---|---|---|
| 1 | 1000 | 6.0 | 100.0% | 0.0 | 97 | 2.9k vs 0.7k | 0.0% |
| 2 | 1000 | 6.0 | 95.0% | 0.0 | 97 | 3.0k vs 0.6k | 0.0% |
| 3 | 838 | 6.0 | 93.0% | 0.0 | 97 | 1.3k vs 0.6k | 10.3% |
| 4 | 834 | 6.0 | 88.4% | 1.7 | 167 | 2.5k vs 1.3k | 12.0% |
| 5 | 784 | 6.0 | 82.0% | 0.0 | 197 | 3.3k vs 1.5k | 2.0% |
| 6 | 750 | 6.0 | 77.7% | 0.0 | 195 | 2.5k vs 1.5k | 26.5% |
| 7 | 645 | 6.0 | 79.1% | 0.8 | 265 | 3.0k vs 2.0k | 44.2% |
| 8 | 412 | 6.0 | 76.1% | 0.5 | 308 | 3.4k vs 2.3k | 44.5% |
| 9 | 309 | 6.0 | 70.1% | 0.2 | 554 | 3.2k vs 5.8k | 89.5% |

## Crossings

| Result | Crossings |
|---|---|
| Held | 12229 (72.1%) |
| Bent | 1062 (6.3%) |
| Broken | 3665 (21.6%) |

## Go forward

| | |
|---|---|
| Rooms where the bot went forward | 1656 of 6572 fights (25.2%) |
| Crossings it improved | 633 |
| Crossings it worsened | 39 (5.8% of its effects) |

## Round cap

| | |
|---|---|
| Fights that hit the round cap (30 rounds) | 0 of 6572 (0.0%) |
| Boss fights that hit it | 0 of 309 |

## Balance log

One row per balance change, from `npm run sim:poc -- --log "<label>"`.

| Change | Win rate | Boss reached | Deaths per run | Held / Bent / Broken | Most runs end on | Go forward improved / worsened |
|---|---|---|---|---|---|---|
| Baseline (step 7) | 0.0% | 22.5% | 6.24 | 34.1% / 3.1% / 62.7% | node 5 (31.0%) | 23 / 7 |
| Part 1 – better bot | 0.0% | 100.0% | 2.38 | 18.5% / 0.5% / 81.0% | node 9 (100.0%) | 3 / 1 |
| Part 2 – recovery | 0.0% | 100.0% | 2.37 | 18.8% / 0.5% / 80.7% | node 9 (100.0%) | 11 / 1 |
| Part 3 – fatigue | 0.0% | 100.0% | 2.17 | 26.9% / 0.9% / 72.1% | node 9 (100.0%) | 17 / 4 |
| Part 4 – breaches | 0.0% | 100.0% | 2.06 | 27.1% / 1.1% / 71.8% | node 9 (100.0%) | 21 / 4 |
| Rout and the new Bent rule | 0.0% | 0.0% | 0.00 | 66.8% / 2.6% / 30.6% | node 4 (79.5%) | 21 / 4 |
| Part 5 – Go forward keeps the luck | 0.0% | 0.0% | 0.00 | 66.8% / 2.6% / 30.7% | node 4 (79.5%) | 21 / 1 |
| Part 6 – growth | 0.0% | 0.0% | 0.00 | 67.8% / 2.6% / 29.6% | node 4 (78.0%) | 8 / 2 |
| Bot rotates ahead of time | 0.0% | 0.0% | 0.00 | 59.4% / 3.1% / 37.5% | node 3 (62.0%) | 35 / 7 |
| Part 7 – enemy curve | 9.5% | 33.5% | 0.00 | 74.9% / 3.3% / 21.7% | node 9 (33.5%) | 144 / 4 |
| Routed: the downed are left behind | 9.5% | 33.5% | 3.13 | 74.9% / 3.3% / 21.7% | node 9 (33.5%) | 144 / 4 |
| Bend line at 0.5 | 9.5% | 33.0% | 3.08 | 72.1% / 6.4% / 21.5% | node 9 (33.0%) | 122 / 3 |
| Final (1000 runs) | 9.9% | 30.9% | 3.12 | 72.1% / 6.3% / 21.6% | node 9 (30.9%) | 633 / 39 |
