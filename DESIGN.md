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

## The orb is a canvas

A day is painted, not configured. Two kinds of paint land on the face:

- a **wash** — a soft radial bloom, the broad sense of how a day felt
- a **stroke** — something you drew, with a direction, a width and a flow

Three tools. The **brush** carries colour; the **airbrush** shades in faint
passes you build up a layer at a time; the **eraser** takes paint back off.
Three sizes, three flow strengths. Undo, redo and clear cover both kinds.

Each mark is laid down as three concentric passes — wide and faint, then
tighter and stronger — which is what gives a stroke a soft shoulder instead of
the hard vector edge a single line would have. Erasing works through an SVG
mask, so it cuts back to the bare sphere rather than painting over in
background colour.

The body underneath is deliberately pale. The first version darkened it toward
the dominant pigment and then dropped a heavy shade over the limb, which turned
every two-colour orb into grey-green sludge; the base now sits well above the
paint and the limb occlusion is a third of what it was.

## The data model

The core model changed. A day used to be:

```ts
{ emotion: 'joy', intensity: 0.8, also: ['calm'] }
```

It is now a composition of pigments placed on a face:

```ts
{
  stops:   [{ emotion, x, y, weight, spread, depth }],
  strokes: [{ emotion, kind, pts, size, flow }],
}
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

**The globe turns slowly on its own** — about 0.055 rad/s, the way a held
object does. Momentum from a flick bleeds off *into* that drift rather than to
a dead stop, so it never lurches to a halt.

**Drag right and it turns right.** This was inverted, and the sign convention
now lives in `globeMath.ts` where it can be tested rather than eyeballed:
increasing `spin` moves the front-facing point right, increasing `tilt` moves it
up — so a rightward drag increases spin and a downward drag *decreases* tilt.
There are assertions for each direction, plus assertions that the gesture
handlers still match.

**One finger turns, two fingers slide, pinch comes closer** (0.85×–2.2×, with
the slide springing back when you zoom out).

**Threads run between neighbouring orbs.** Each orb links to its two nearest
spatial neighbours — not to the next day, which on a Fibonacci spiral would
throw long chords across the sphere. The lattice is split into near and far
halves at different opacities so it wraps the cluster.

**The orbs assemble on arrival.** They drift in from ~2.4× radius, staggered
along the spiral, easing over 1.7s; the threads fade in once the orbs have
landed.

**Days are laid oldest-to-newest along a Fibonacci spiral**, so the globe has a
readable grain instead of scattered bubbles. Long ranges sample days rather than
adding nodes, and sampling prefers a day that actually has an orb.

**Every gesture has a visible equivalent.** Tools, brush size and flow are
buttons; washes, intensity and the sink/surface toggle are reachable from the
composition list. A mode switch turns drawing off entirely for anyone who does
not want it.

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

- **Orb rendering is split in two.** `EmotionalOrb` (SVG, layered gradients and
  stroke passes) is used where an orb is large and few; the globe draws its own
  plain-View orbs, because a hundred SVG gradient stacks would not hold frame
  rate. At globe scale a two- or three-colour read is all the mixture needs.
- **Every thread is one animated path.** ~180 segments rebuilt per frame inside
  a single worklet, rather than 180 animated `<Line>` elements with a worklet
  each.
- **A stroke records a point only after the finger has travelled 0.028 units**,
  and caps at 90 points. That bounds both the React updates while drawing and
  the path complexity afterwards.
- **The globe is capped at 110 nodes** (`MAX_NODES`). Each node runs its own
  projection worklet, so this is a measured ceiling, not a guess.
- **Paper grain is 110 static specks drawn once at the root**, not per screen.
- Reanimated worklets keep rotation, momentum and projection off the JS thread,
  so the globe stays smooth while lists scroll.

## Files

**Added** — `src/components/globeMath.ts` (testable projection + lattice),
`src/design/tokens.ts`, `src/design/theme.tsx`,
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
- 32 assertions over globe geometry, the assembly animation, the thread lattice
  and the stroke model — including one per rotation direction, checked against
  the live gesture handlers so the inversion cannot come back
- 28 assertions over composition, migration, placement and insights
- Contrast checked numerically across both themes
- Production export and dev bundle both build (1,735 modules)
