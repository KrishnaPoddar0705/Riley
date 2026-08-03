# Riley — design notes

A record of the redesign: what was wrong, what replaced it, and why each
decision went the way it did.

---

## Audit of what was there

The first build was competent and cluttered. Specifically:

| Problem | Where |
|---|---|
| A script face used for the user's name and section headings | every screen |
| Five navigation items, plus a capture toolbar underneath the bar | tab bar |
| Three KPIs in a black slab — streak, "days coloured", "saved" | Home |
| A row of unlabelled coloured dots | Home |
| Translucent glass cards stacked on gradient blobs on a starfield | every screen |
| Large segmented range buttons above the globe | Globe |
| A "most of the time" percentage chart with progress bars | Globe |
| One emotion per day, chosen from a carousel with a 0–99% readout | Check-in |
| Grey caption text at 2.9:1 contrast | throughout |

Four font styles, three surface materials and six competing focal points meant
no screen had a dominant purpose. The check-in also flattened a day into a
single feeling, which is the one thing the product should never do.

## Information architecture

**Five tabs → four.** Calendar folded into Journal behind a toggle; Profile
became Settings.

```
Today · Globe · Journal · Settings
   └── compose-orb (modal)   └── day/[day] (modal)
```

The `entry/[id]` and `compose` screens went away. Everything now belongs to a
day, so a day is the only detail view.

## The orb

The core model changed. A day used to be:

```ts
{ emotion: 'joy', intensity: 0.8, also: ['calm'] }
```

It is now a composition of pigments placed on a face:

```ts
{ stops: [{ emotion, x, y, weight, spread, depth }] }
```

Each stop paints as a translucent radial wash, back to front, so two feelings
meeting produce a third colour rather than a pie slice. `depth: true` sinks a
stop beneath the others — that is how "a joyful exterior with a darker centre"
is expressed. Share is computed from `weight × (0.4 + spread)`, so a wide faint
wash correctly reads as more of the day than a small intense dot.

**Existing data is preserved.** `orbFromLegacyMood` lifts every old single-
emotion record into an orb — the primary feeling becomes a broad central wash at
its recorded intensity, each secondary becomes a smaller fleck. Migration is
lazy, deterministic, and never overwrites a real orb.

## Tokens

`src/design/tokens.ts` and `src/design/theme.tsx`.

- **Colour** — warm ivory paper (`#F4F1EA`) and smoked linen dark (`#15140F`).
  Fifteen surface tokens per scheme, one restrained sage accent. No gradients.
- **Typography** — two families. System sans for everything; Georgia italic for
  the one emotional word per screen. Nine roles, all scaled by Dynamic Type and
  clamped at 1.55× so orb layouts survive the largest accessibility sizes.
- **Elevation** — three levels, applied only through `NeumorphicControl`.
- **Motion** — press 140ms, screen 300ms, orb morph 460ms, breathing 6.2s.
  Every value is skipped when Reduce Motion is on.
- **Emotion palette** — twelve pigments named after materials (marigold,
  mineral blue, vermilion), each with a deeper shade for sunk stops.

## Neumorphism, rationed

React Native gives one shadow per view, so the "lit from the top-left" read
comes from a light hairline border plus a single soft drop rather than the
usual doubled shadow. It appears on exactly four things: the orb canvas, the
save button, colour wells, and the range sheet. Everything else is flat paper
separated by hairlines.

## Interaction decisions

**The globe is still at rest.** No idle rotation and no particles. Momentum
decays at `v * 0.06^dt`, coming to a stop in about 1.5 seconds. Pinch is
clamped to 0.92–1.22 — a nudge closer, not a zoom control.

**Days are laid oldest-to-newest along a Fibonacci spiral**, so the globe has a
readable grain instead of scattered bubbles. Long ranges sample days rather than
adding nodes, and sampling prefers a day that actually has an orb.

**Every gesture has a visible equivalent.** Painting, intensifying and spreading
are all reachable from the ± steppers and the sink/surface toggle in the
composition list. A mode switch turns gesture painting off entirely.

**The writing prompt does not exist until the orb has colour.** The flow never
opens onto an empty form, and a complete entry is one tap on a pigment plus one
tap to save.

**Saving is one soft haptic.** No confetti, no streak, no score.

## Accessibility

- Every text colour clears **WCAG AA (4.5:1)** on both papers and both surfaces,
  verified numerically. `inkFaint` was darkened in both themes to get there
  (light 2.91:1 → 4.56:1; dark 3.93:1 → 4.85:1).
- Colour is never the only signal: used pigments carry a dot, journal filters are
  named, orbs expose a spoken composition ("40 percent calm, 30 percent hope").
- 44pt minimum targets throughout; `MIN_TARGET` is a token.
- Reduce Motion replaces the globe with a **static 2D grid of the same days**,
  disables breathing, press-scale, layout animations and screen slides.
- Dynamic Type is read live and clamped; `largeText` is exposed for layouts.
- The orb canvas is one `adjustable` element with a hint describing every
  gesture and a pointer to the visible controls.

## Performance trade-offs

- **Orb rendering is split in two.** `EmotionalOrb` (SVG, layered gradients) is
  used where an orb is large and few; the globe draws its own plain-View orbs,
  because a hundred SVG gradient stacks would not hold frame rate. At globe
  scale a two- or three-colour read is all the mixture needs.
- **The globe is capped at 110 nodes** (`MAX_NODES`). Each node runs its own
  projection worklet, so this is a measured ceiling, not a guess.
- **Paper grain is 110 static specks drawn once at the root**, not per screen.
- Reanimated worklets keep rotation, momentum and projection off the JS thread,
  so the globe stays smooth while lists scroll.

## Files

**Added** — `src/design/tokens.ts`, `src/design/theme.tsx`,
`src/emotions/palette.ts`, `src/store/orb.ts`, `src/insights/observe.ts`,
`src/components/{EmotionalOrb,OrbPainter,OrbGlobe,Primitives,Paper,BottomNavigation,JournalEntryRow}.tsx`,
`app/compose-orb.tsx`, `app/(tabs)/settings.tsx`.

**Removed** — `src/theme/index.ts`, `src/emotions/catalog.ts`,
`src/components/{Clay,EmotionDial,EmotionGlobe,EntryCard,Orb,Screen,TabBar}.tsx`,
`app/(tabs)/{calendar,profile}.tsx`, `app/{check-in,compose}.tsx`,
`app/entry/[id].tsx`.

**Rewritten** — every remaining screen, plus `Capture.tsx`, `VoiceRecorder.tsx`,
`store/{types,seed,DiaryProvider}.ts(x)`.

## Verification

- `tsc --noEmit` clean
- 28 assertions over composition, migration, placement and insights — all pass
- Contrast checked numerically across both themes
- Production export and dev bundle both build (1,735 modules)
