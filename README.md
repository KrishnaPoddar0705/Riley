# Riley

An emotion diary and second brain for iPhone. Name it after the girl from *Inside
Out*, because that is the idea: every day becomes a coloured orb, and all your
orbs together make a globe you can spin.

Built with Expo (SDK 56) + React Native + expo-router, TypeScript throughout.

> Pinned to **SDK 56 deliberately**. That is what the App Store build of Expo Go
> currently runs. SDK 57 is on npm, but Expo Go rejects it with *"Project is
> incompatible with this version of Expo Go"* until Apple ships the newer client.
> Don't run `npx expo install --fix` expecting 57 — it will break Expo Go again.

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

`expo-audio` declares an unbounded `expo-asset@"*"` peer, so a lockfile-less
install happily pulls the SDK **57** copy of `expo-asset` (and `expo-constants`
behind it) into an otherwise-56 tree — JS from one SDK against Expo Go's native
side from another. `expo-asset` and `expo-font` are therefore pinned as direct
dependencies. Keep `package-lock.json` committed and this stays a non-issue.

---

## What's in it

**Check in on how the day felt.** A `Positive` / `Negative` toggle swaps the
emotion family, a snapping carousel of orbs picks the feeling, and you drag the
big orb up or down to say how strongly — the percentage under each orb updates
live off the UI thread. Step two takes a note, secondary emotions, and any media
you want to keep from the day.

**A globe of everything you have felt.** Days are laid out on a Fibonacci sphere
so nothing clumps at the poles. Drag to spin it, flick it and it keeps going,
drag up or down to tip it. Lit orbs are days you logged; ghost orbs are the days
you did not. Tap any orb to open that day. Rotation, momentum and the 3D
projection all run in Reanimated worklets, so the globe stays at 60fps while the
page scrolls underneath it.

**A second brain, not just a mood tracker.** Text, voice notes (recorded in-app
with a live meter), photos, video and links all land on a day. Everything is
searchable and filterable by kind in the Journal tab.

**Calendar and profile.** A month grid where each day is its own orb, and a
profile page with the streak card, a slowly turning personal globe, and the
totals.

---

## Design

Grey-lavender gradient, drifting colour blooms, a dust of stars, and frosted
clay surfaces — the only saturated colour in the app is the orbs. Headings pair
a clean sans line with a script word set in **Snell Roundhand**, which ships with
iOS, so there are no fonts to download and no flash of unstyled text on launch.

The whole visual language lives in `src/theme/index.ts`: palette, the emotion
spectrum, type scale, the two clay shadow recipes, and the spring constants
every animation uses.

## Notes on the globe's performance budget

Each orb needs its own worklet per frame, so the sphere is capped at **120
nodes** (`MAX_NODES` in `src/components/EmotionGlobe.tsx`). Longer ranges don't
add orbs — they fold several days into one, and the orb takes the colour of the
strongest-felt day in its bucket. That keeps 3 months, 6 months and a year all
rendering at the same cost.

---

## Layout

```
app/
  _layout.tsx          providers, stack, modal presentation
  (tabs)/              Home · Journal · Globe · Calendar · Profile
  check-in.tsx         the two-step emotion flow
  compose.tsx          capture anything into the second brain
  day/[day].tsx        one day: its colour, note and everything saved
  entry/[id].tsx       one entry: edit, recolour, delete
src/
  theme/               palette, type, shadows, motion
  emotions/catalog.ts  the 13 emotions, their colours and prompts
  store/               AsyncStorage-backed diary state + first-run seed
  components/          Screen, Orb, EmotionGlobe, EmotionDial, Clay, …
  utils/               date keys, streaks, month grids
```

Everything is stored locally on the device via `AsyncStorage`. Nothing leaves
the phone. On first launch Riley seeds ~96 days of sample entries so the globe
has something to spin; **Reset Riley** on the profile page regenerates it.
