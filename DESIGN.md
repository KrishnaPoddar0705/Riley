# Riley — design notes

> **Your days are more than one emotion.**

A record of what the product is, what was wrong at each stage, and why each
decision went the way it did.

---

## Thesis

A mood tracker reduces a day to a label. This does the opposite: it keeps the
contradiction. Happy but exhausted. Proud with something anxious underneath.
A hard day with one beautiful moment in it.

The user is not logging a mood. They are keeping the colour of a day.

---

## Audit — round three

The second build fixed the clutter but created three new problems, all visible
on device.

| Problem | Why it mattered |
|---|---|
| Threads between orbs | Read as a network graph, a molecular model, a social diagram. The lines carried no meaning, so they were noise pretending to be information. |
| Orbs looked alike | Nearly every orb was a glossy single-colour sphere, which quietly contradicts the entire product claim. |
| The editor was an art program | Brush, airbrush, eraser, undo, redo, sizes, flow, percentages. Nobody should need Photoshop to describe a Tuesday. |
| Painted output looked broken | Imprecise gestures produced geometric marks that read as rendering artefacts. That destroys trust in one glance. |
| Home had no focal action | The globe was the largest object on a screen whose job is *colour today*. |
| Journal filter carousel | Horizontal overflow, clipped "Confidence" — an unfinished shopping filter bar. |
| Entry detail | Date repeated three times, a giant "Reshape the Orb", delete at the top. |
| "Unnamed" as an emotion label | Read as missing data. |

Two of these came from me implementing an earlier request literally — the
connecting threads were built to spec last round and are now removed, because
seeing them in place showed they fought the product.

---

## The orb: described, not drawn

**Before:** the user painted. Washes, then brush strokes with size, flow and an
eraser. The app faithfully rendered whatever was drawn — including the mess.

**After:** the user *describes*. Three things, in words:

| The user says | The renderer does |
|---|---|
| **Which feeling** | Sets the body colour |
| **Where it sat** — on the surface / underneath / around the edges / a brief moment | Chooses the visual role |
| **How much** — a little / some / a lot | Sets presence |
| **"It never quite settled"** | Adds marbling and haze |

```ts
type Feeling = { emotion, place: Placement, presence: number, seed: number }
type Orb     = { day, feelings: Feeling[], clarity: number }
```

Nothing in `EmotionalOrb.tsx` comes from a coordinate the user chose. Positions
derive from a golden-angle walk seeded per feeling, so two calm days never look
identical and **no input can produce an ugly orb**. That is the point of the
rewrite: the app is responsible for the beauty, the user is responsible for the
truth.

### Expressive range

- **Surface** — off-centre soft washes, blended
- **Core** — a dense centre in the deeper shade: the private feeling
- **Edge** — a rim that never quite resolves
- **Moment** — small flecks, three per feeling, never a pattern
- **Marbling** — when feelings conflict, the same colours pulled the other way
- **Haze** — a pale veil when the day did not settle
- **Asymmetry** — the light source shifts a few degrees per day

### No percentages

Composition is spoken, not measured:

> *Mostly calm, with some worry underneath and a brief joy.*

The same sentence is the VoiceOver label. Percentages exist in `composition()`
for the globe's colour and for screen readers, and appear nowhere in the UI.

---

## The globe: time you can turn

**Before:** Fibonacci scatter with nearest-neighbour threads. Beautiful
distribution, zero information — and the lines made it look generated.

**After:** one spatial model, applied everywhere.

| Days | Layout | Why |
|---|---|---|
| ≤ 14 | Gentle facing arc | A first week must already feel like something, not a failed sphere |
| 15–120 | Chronological spiral | Oldest at the bottom, newest at the top; turning it moves through time and months form belts |
| > 120 | One node per month | Days never shrink below a fingertip. Tap a month to open its days |

Threads removed entirely. **The structure is the time, not a graph.**

Interaction: drag to turn (right turns right), flick for weighted momentum,
pinch 0.9–1.8×, double-tap to recentre, and a slow idle drift so it feels held
rather than parked. On arrival the orbs gather in from beyond the sphere,
staggered along the spiral over 1.6s.

---

## Home: one job

**Before:** date, heading, an unlabelled quote, a large globe, an empty orb, two
actions, a monthly count, navigation. The eye had nowhere to land.

**After, in order:**

1. Date and a contextual greeting
2. **Today's orb — the largest object on the screen**
3. *How did today feel?*
4. **Colour today** (primary) · *Write instead* (subordinate)
5. The globe below, as context and reward — `76 days kept`
6. At most one memory card, labelled

"Shape today's orb" became **Colour today**: the metaphor now gets taught in
onboarding, so the abstract phrase does not have to carry it. The floating quote
is now labelled *FROM YESTERDAY* or *FROM THIS DAY LAST YEAR* — never an
unattributed sentence that reads as a fortune cookie.

Removed from home: streaks, completion rates, monthly counts as a focal point.

---

## Journal and entry detail

Journal: three icons — search, calendar, filter. Filters open in a sheet
(feeling, contains photos, contains voice). The chip carousel is gone. Calendar
cells render **real mixed orbs**, not flat dots. Only named feelings appear;
"Unnamed" never does.

Entry detail reads as a finished page: date **once**, optional title, orb,
the composition in a sentence, the reflection, then *A quiet light* and *What
weighed on me* if they exist. Editing is a quiet **Edit this day**; delete and
keepsake live in an overflow menu.

---

## Onboarding

Three screens, no account, no questionnaire. Each demonstrates rather than
explains — screen one animates a flat orb becoming layered, which *is* the
product thesis. Then the user makes their first orb immediately.

---

## Retention without guilt

No streaks. Nothing punishes a gap; empty days stay part of the record and any
past day can be coloured. Return value comes from resurfacing — this day last
year, a moment from a past month, a bright moment from a few weeks back — and
`resurface()` returns **null** rather than inventing something to fill the slot.

Insights stay hedged ("It looks like…", "You may have…"), need 14 days before
appearing at all, and can be switched off.

---

## Keepsakes

The orb is the shareable object, so the card is mostly orb.

- **This day** — orb, date, optional composition sentence, optional words
- **This week** — seven orbs with day initials
- Discreet serif wordmark

Privacy is explicit and defaults quiet: *Orb only* / *With feelings* / *With my
words*. **Nothing written is included unless the user picks "With my words".**
Export is a real PNG via `react-native-view-shot` into the iOS share sheet.
No feed, no broadcast, no forced share after saving.

---

## Accessibility

- Every text colour clears **WCAG AA (4.5:1)** on both papers, verified numerically
- Colour is never the only signal — feelings are always named in text
- 44pt minimum targets (`MIN_TARGET` is a token)
- Reduce Motion: static grid instead of the globe, no breathing, no assembly, no press-scale
- Dynamic Type read live and clamped at 1.55×
- The orb's spoken label is its plain-English composition
- Language is never diagnostic; observations are possibilities, and can be disabled

---

## Performance

- **Two orb renderers.** SVG with layered gradients where orbs are large and
  few; plain Views on the globe. A hundred gradient stacks will not hold frame
  rate. `detail="simple"` skips flecks, marbling and haze for small instances.
- **110 node ceiling**, then month aggregation — measured, not guessed.
- **Shared projection worklet.** `globeMath.project` carries `'worklet'` and is
  verified in the built bundle to compile as `_worklet_..._init_data`.
- Paper grain is 110 static specks drawn once at the root.

---

## Not built

Named honestly rather than implied:

- Scheduled notifications, biometric lock
- Deep links, invite-to-colour, shared constellations
- Animated video export (the still keepsakes are real; the Reel is not)
- Analytics instrumentation
- Cloud backup — everything is local-only today

---

## Verification

- `tsc --noEmit` clean
- 33 assertions: composition and placement weighting, the spoken sentence,
  migration from **both** earlier data shapes, every layout size, spiral
  direction, projection sign convention, and resurfacing honesty
- Contrast checked numerically across both themes
- Production export and dev bundle both build; bundle checked for new modules
  present and removed ones absent
