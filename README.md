# Riley

**Your days are more than one emotion.**

A private visual diary. Every day becomes one orb — not a mood label, but the
actual mixture: happy but exhausted, proud with something anxious underneath, a
hard day with one beautiful moment in it. Over time the orbs gather into a globe
of your own.

Built with Expo (SDK 54) + React Native + expo-router, TypeScript throughout.

---

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app on your iPhone and open it in **Expo Go**.
For a standalone build:

```bash
npx expo run:ios          # needs Xcode on a Mac
# or
npx eas build -p ios      # cloud build
```

`npm run lint` runs a TypeScript check over the whole project.

### About the pinned versions

**`expo` and `react-native` are pinned to exact versions on purpose** — `54.0.36`
and `0.81.5` — and neither should be bumped casually.

The whole project is targeted at **SDK 54**, because that is the SDK the Expo Go
on the target phone supports. Expo Go is a prebuilt binary; its native side
cannot be rebuilt, so the JS has to meet it, not the other way round.

Two different failures come from getting this wrong, and they point in opposite
directions:

| What you see | Meaning | Fix |
|---|---|---|
| *"Project is incompatible with this version of Expo Go"* | project SDK is **newer** than the client | pin **down** |
| `React Native version mismatch. JavaScript version: X / Native version: Y` | SDK loaded, but RN **minor** differs | match RN to `Y` |

React Native's startup check compares only major and minor, so `0.81.5` against a
native `0.81.x` is fine; `0.85` against `0.86` is not.

To find the right target: Expo Go's home screen states the SDK version it
supports, and the `Native version:` number in a mismatch error identifies the
client's RN exactly. Those two are the ground truth — not npm's `latest`.

Because SDK 54 predates Expo's unified versioning, its packages use independent
version lines (`expo-audio@1.x`, `expo-video@3.x`, `expo-blur@15.x`). Do not
"correct" these to match the `expo` major.

`react-dom` is pinned to match `react` exactly. It is not used by the
iOS app, but `expo-router` depends on `vaul` and `@radix-ui/*` for its web build,
and those declare a `react-dom` peer. Left unpinned, npm resolves `react-dom` to
the newest release, which then demands a newer `react` than the SDK pins — and
npm 11+ fails the whole install with `ERESOLVE`.

`expo-audio` declares an unbounded `expo-asset@"*"` peer, so a lockfile-less
install can pull a newer SDK's copy of `expo-asset` (and `expo-constants`
behind it) into the tree — JS from one SDK against Expo Go's native side from
another. Keep `package-lock.json` committed and this stays a non-issue.

---

## What's in it

**Today.** Today's orb is the largest thing on the screen and the only primary
action. Colour it, then the globe below shows everything kept so far.

**A day is rarely one feeling.** You name what was most present, say whether
anything sat underneath it — on the surface, underneath, around the edges, or as
a brief moment — and how much of the day it took. You never draw, position or
blend anything; the renderer composes the orb from the description, so no input
can produce an ugly result. The composition is spoken, never charted:
*"Mostly calm, with some worry underneath."*

**The globe.** One coherent model at every scale: a facing arc for your first
fortnight, a chronological spiral for a season — oldest at the bottom, newest at
the top, so turning it moves through time — and month forms past a year that you
tap to open. Drag to turn, pinch to come closer, double-tap to recentre.

**Journal.** A quiet archive. Search, calendar and filter are three icons;
filters open in a sheet. The calendar shows real mixed orbs, not dots.

**Keepsakes.** A day or a week as a shareable card. Nothing you wrote is
included unless you explicitly choose it.

See [DESIGN.md](./DESIGN.md) for the full audit, design system, retention and
privacy reasoning, accessibility work and performance trade-offs.

## Notes on the globe's performance budget

Each position needs its own projection worklet per frame, so the globe is capped
at **110 nodes** (`MAX_NODES` in `src/components/OrbGlobe.tsx`). Past
`AGGREGATE_ABOVE` days it switches to one node per month rather than shrinking
days into specks nobody can tap — so a month, a year and five years all render
at the same cost.

---

## Layout

```
app/
  _layout.tsx          providers, theme, first-run routing
  onboarding.tsx       three screens, no account
  (tabs)/              Today · Globe · Journal · Settings
  compose-orb.tsx      the daily ritual: name it, keep it
  day/[day].tsx        one day as a finished page
  keepsake.tsx         shareable card, privacy-first
src/
  design/              tokens + theme provider (light / dark, a11y state)
  emotions/palette.ts  twelve pigments, renameable
  store/orb.ts         the feeling model, and migration from every older shape
  insights/            gentle observations + memory resurfacing
  components/          EmotionalOrb, FeelingComposer, OrbGlobe, globeMath, …
  utils/               date keys, month grids
```

Everything is stored locally via `AsyncStorage`. Nothing leaves the phone. Days
recorded under any earlier version of the app are migrated on read, so nothing
already written is lost.
