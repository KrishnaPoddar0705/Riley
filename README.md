# Riley

An emotion diary and second brain for iPhone. Name it after the girl from *Inside
Out*, because that is the idea: every day becomes a coloured orb, and all your
orbs together make a globe you can spin.

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

**Today.** One question, one object, one action. A globe of your recent days
fills the page; today's orb sits beneath it, empty and slowly breathing until
you shape it.

**The orb.** A day is not one feeling, so an orb is not one colour. Touch the
face to leave a pigment, drag to move it, hold to deepen it, pinch to spread it.
Two feelings meeting blend like wet ink rather than splitting into a pie chart,
and a colour can be sunk beneath the others to give the day a darker centre.
Every gesture has a visible control beside it.

**The globe.** Days laid oldest-to-newest along a Fibonacci spiral. Drag to
turn it; it carries weighted momentum and settles under its own weight. At rest
it is still.

**Journal.** A chronological read of the diary, with the month grid folded in
behind a toggle. Search what you wrote; filter by colour.

**Settings.** Two quiet lines of record, gentle observations you can switch off,
and the ability to rename any colour — the default names are only defaults.

See [DESIGN.md](./DESIGN.md) for the full design system, interaction decisions,
accessibility work and performance trade-offs.

## Notes on the globe's performance budget

Each orb needs its own projection worklet per frame, so the sphere is capped at
**110 nodes** (`MAX_NODES` in `src/components/OrbGlobe.tsx`). Longer ranges do
not add orbs — they sample days, preferring one that actually has an orb. That
keeps a month and a year rendering at the same cost.

---

## Layout

```
app/
  _layout.tsx          providers, theme, grain, modal presentation
  (tabs)/              Today · Globe · Journal · Settings
  compose-orb.tsx      the daily ritual: shape, write, save
  day/[day].tsx        one day: its orb, its words, what was kept
src/
  design/              tokens + theme provider (light / dark, a11y state)
  emotions/palette.ts  twelve pigments, renameable
  store/               orb model, diary state, legacy migration, seed
  insights/            gentle observations, off until asked for
  components/          EmotionalOrb, OrbPainter, OrbGlobe, Primitives, …
  utils/               date keys, month grids
```

Everything is stored locally via `AsyncStorage`. Nothing leaves the phone. On
first launch Riley seeds ~84 days so the globe has something to turn; **Erase
everything** in Settings regenerates it.
