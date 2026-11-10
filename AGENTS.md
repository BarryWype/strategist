This is an Expo/React Native mobile application: a proof of concept for a dungeon-crawler roguelike where the player is the party's strategist. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
npm run sim:poc             # balance bot, 1000 runs, writes doc/sim-report.md (under a minute)
```

Checks:
- **While working:** `npm run test:changed` (tests related to uncommitted changes).
- **Before each commit:** `npm test`, `npm run typecheck` and `npm run lint`.

## Layout

- Game logic is pure TypeScript under `src/game/`, content under `src/content/`, screens under `src/app/`, shared components under `src/components/`, zustand stores under `src/store/`, hooks under `src/hooks/`. Map drawings (react-native-svg) live in `src/components/map/`: pure geometry in `layout.ts`, SVG pieces in `pieces.tsx`, and `MapCanvas` lays invisible 44 px buttons over the drawing.
- English only.
- Code copied from Pocket Quartermaster (`../pocket-quartermaster`) is copied, never imported across repos or symlinked, and starts with `// From pocket-quartermaster <path>, trimmed for the POC.`
- Save compatibility does not matter in the POC: a changed save may reset.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `npx eas-cli@latest <command>`; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Text and emoji

The game font (Fantaisie Artistique) has no emoji glyphs, so a Text that mixes an emoji with words measures its width wrong and clips the words in anything sized to its content. Never put an emoji and words in one Text element: render the emoji in its own element (`IconLabel`, `src/components/IconLabel.tsx`) beside the label. `src/components/noMixedEmojiText.test.ts` fails on any Text that mixes them; a full-width paragraph that wraps may opt out with `// mixed-emoji-ok: <reason>` on the Text line.

## Fixing bugs

Find the cause before changing code, and change only what the cause requires. If a fix doesn't fix the bug, revert it before trying something else: never stack a second fix on a failed one, and never leave speculative code (warm-ups, preloads, caches, locks) that wasn't shown to help. Prefer the platform's or the library's own mechanism over a custom layer.
