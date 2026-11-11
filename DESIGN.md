---
name: Hotseat
description: Timed interview practice drawn as a speech timing-card set on cool cardstock.
colors:
  ground: "oklch(96.5% 0.008 250)"
  sheet: "oklch(99.4% 0.003 250)"
  ink: "oklch(22% 0.035 258)"
  ink-soft: "oklch(42% 0.03 258)"
  rule: "oklch(84% 0.012 255)"
  tint: "oklch(92.5% 0.014 255)"
  go: "oklch(76% 0.17 150)"
  warn: "oklch(84% 0.16 86)"
  stop: "oklch(55% 0.21 27)"
  focus: "oklch(52% 0.2 262)"
typography:
  title:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  heading:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.55
  wordmark:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  numeral:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.55
  note:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  tag:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
rounded:
  tag: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-disabled:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  banner:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  choice-row:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  answer-box:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1rem"
  timing-card-on-time:
    backgroundColor: "{colors.go}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.lg}"
    padding: "0.875rem 1rem"
  timing-card-wrap-up:
    backgroundColor: "{colors.warn}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.lg}"
    padding: "0.875rem 1rem"
  timing-card-over:
    backgroundColor: "{colors.stop}"
    textColor: "{colors.sheet}"
    typography: "{typography.numeral}"
    rounded: "{rounded.lg}"
    padding: "0.875rem 1rem"
---

# Design System: Hotseat

## Overview

**Creative North Star: "The Timing Card"**

Hotseat looks like a speech coach's timing-card set laid on cool cardstock. The ground is a pale blue-grey, the type is deep ink navy, and content sits on near-white sheets outlined in ink. Timing is the one live signal of a practice answer, so it is the only thing allowed to carry colour: a single card that changes ground from green to amber to red as the answer budget runs out and passes. Everything else is ink, paper and rule.

The mode is Operate: a candidate at a desk typing paragraph-length answers under a clock. The system stays quiet, keeps the answer box the largest control on the screen, and never decorates. It is a light-theme system only; no dark theme exists in the build.

**Key Characteristics:**
- Cool cardstock ground, white sheets, 1.5px ink outlines; no gradients.
- One humanist sans (Atkinson Hyperlegible) in two weights, bold tabular numerals for every clock.
- Three signal grounds (green, amber, red), used only on the timing card.
- State is always stated in words and numerals beside colour.
- Single 46rem column; on wide screens the timing card pins to a right rail.
- Strings are inline English; no i18n catalogue exists yet.

## Colors

A cool, near-monochrome ink-and-paper palette with one signal trio held in reserve.

### Primary
- **Deep Ink Navy** (`ink`, oklch(22% 0.035 258)): body text, header rule, primary button ground, outlines of sheets and inputs, selected-choice border. Also the on-colour text for the green and amber cards.

### Secondary
- **Signal Green** (`go`, oklch(76% 0.17 150)): timing card, on-time state only.
- **Signal Amber** (`warn`, oklch(84% 0.16 86)): timing card, wrap-up state (last 30 seconds of the answer budget).
- **Signal Red** (`stop`, oklch(55% 0.21 27)): timing card, over-time state only. Text on it flips to Sheet White.

### Tertiary
- **Focus Blue** (`focus`, oklch(52% 0.2 262)): 3px focus-visible outline (2px offset) and the text caret. Functional, not decorative.

### Neutral
- **Cardstock** (`ground`, oklch(96.5% 0.008 250)): page background.
- **Sheet White** (`sheet`, oklch(99.4% 0.003 250)): panels, answer box, choice rows, candidate turns, secondary buttons, resting timing card.
- **Soft Ink** (`ink-soft`, oklch(42% 0.03 258)): speaker names, notes, placeholders, waiting text, disabled text.
- **Hairline** (`rule`, oklch(84% 0.012 255)): transcript dividers, choice-row and candidate-turn borders, disabled borders.
- **Tint** (`tint`, oklch(92.5% 0.014 255)): banner, alert, disabled fills, hover on secondary buttons.

The scoring-bands scale additionally steps four blue-grey grounds (94%, 86%, 74%, 62% lightness at hue 255, chroma 0.012 to 0.06) from strong no hire to strong hire. They are a one-off ramp local to that component and are not tokens.

### Named Rules
**The Reserved Signal Rule.** Green, amber and red appear only on the timing card. Red is the over-time state and nothing else: not errors, not destructive buttons, not validation.

**The Words Beside Colour Rule.** Colour never carries state alone. The timing card always shows numerals and a text label (On time, Wrap up, Over time, Waiting) next to its ground; over-time numerals are prefixed with `+`.

## Typography

**Display Font:** none; there is no separate display face.
**Body Font:** Atkinson Hyperlegible (weights 400 and 700, Latin subset, loaded through next/font as `--font-body`, falling back to system-ui, sans-serif).

**Character:** A humanist, high-legibility sans chosen for sustained reading and typing under pressure. Hierarchy comes from weight and size, not from a second family.

### Hierarchy
- **Numeral** (700, 2.5rem, 1.1, tabular): the timing card clock; 1.75rem on narrow screens. The header session clock is 700 tabular at body size.
- **Title** (700, 1.75rem, 1.2): start form heading.
- **Wordmark** (700, 1.375rem, -0.01em): "Hotseat" in the header.
- **Heading** (700, 1.25rem): panel headings.
- **Body** (400, 1.0625rem, 1.55): transcript, answer text, form copy. Answer box uses line-height 1.6.
- **Label** (700, 1.0625rem): buttons, field labels, legends, speaker names, choice names, timing label.
- **Note** (400, 0.9375rem): privacy text (max 65ch), choice descriptions, band names and thresholds.
- **Tag** (700, 0.8125rem): small outlined turn tags.

### Named Rules
**The Tabular Clock Rule.** Every running time uses bold tabular numerals so digits do not jitter as they change.

## Layout

A single centred column, max 46rem, with 1rem side padding and 4rem bottom padding. The header is a baseline-aligned flex row (wordmark left, session time left on the right) closed by a 2px ink rule. During a session the body is a two-column grid: transcript and answer form fill the left (minmax(0, 1fr)), and the timing card sits in a fixed 10.5rem right rail, sticky at top 1rem. At 36rem and below, the grid collapses to one column: the timing card becomes a full-width horizontal strip (time left, label right, 1.75rem numerals) sticky at top 0.5rem above the content, transcript rows stack speaker over body, and the bands scale turns vertical.

Spacing rhythm is 0.5, 0.75, 1, 1.25 and 1.5rem; section gaps are 1.5rem and the privacy footer sits 2.5rem below content. Transcript turns use a 5.5rem speaker column with 1rem gap and hairline dividers. The answer box is the largest control (min-height 14rem, full width, vertical resize).

## Elevation & Depth

Flat by default. Depth is conveyed by ink outlines and the sheet-on-cardstock tonal step, not by shadow. The one exception is the timing card.

### Shadow Vocabulary
- **Card Lift** (`box-shadow: 0 4px 10px oklch(22% 0.035 258 / 0.16)`): timing card only, so it reads as a physical card pinned above the transcript.
- **Band Bar** (`inset 0 -4px 0 var(--ink)`, inset left 4px on narrow screens): marks the hiring-bar band in the scoring scale; a structural mark, not elevation.
- **Choice Ring** (`inset 0 0 0 1px var(--ink)`): doubles the border of a selected style row.

### Named Rules
**The One Lift Rule.** Only the timing card casts a shadow. Panels, banners, buttons and inputs stay flat.

## Shapes

Softly squared forms with firm outlines. Standard radius 0.5rem for buttons, inputs, banners, choice rows, the answer box and the bands scale. Larger 0.75rem for panels and the timing card. Tags use 0.25rem. Borders are 1.5px ink for interactive and structural elements, 1.5px rule for passive containers (banner, choice rows), 1px rule for transcript dividers and candidate turns. The header rule and alert border are 2px ink. No pills, no circles.

## Components

### Buttons
- **Shape:** gently squared (0.5rem), 2.75rem minimum height, bold label.
- **Primary:** Deep Ink Navy ground, Sheet White text, 1.5px ink border, 0 1.25rem padding.
- **Secondary:** Sheet White ground, ink text and border; hover fills Tint.
- **Hover / Focus:** primary hover shifts to a slightly lighter navy (oklch(32% 0.04 258)) over 120ms ease-out (cubic-bezier(0.22, 1, 0.36, 1)); focus is the 3px Focus Blue outline.
- **Disabled:** Tint ground, Soft Ink text, Hairline border, not-allowed cursor.

### Cards / Containers
- **Panel:** Sheet White, 1.5px ink border, 0.75rem radius, 1.25rem padding, flat. Holds resume-or-discard and the sample debrief.
- **Banner:** Tint, 1.5px Hairline border, 0.5rem radius; announces the phase via role status.
- **Alert:** Tint, 2px ink border; role alert. Not red.

### Inputs / Fields
- **Answer box:** Sheet White, 1.5px ink border, 0.5rem radius, 1rem padding, 14rem minimum height. Disabled: Tint ground, Hairline border, Soft Ink text, no resize.
- **Level options:** four side-by-side radio segments (two by two at 36rem and below), each with the level name and its years of experience. Same selected treatment as the style rows (ink border plus inset ring). The input is visually hidden and the segment shows the focus ring.
- **Style choice rows:** radio with bold capitalised name and a Soft Ink note; Hairline border at rest, ink border plus Choice Ring when checked.
- **Focus:** global 3px Focus Blue outline, 2px offset.

### Timing Card (signature)
A sticky card with a bold tabular clock over a bold text label. Resting (not answering) it is Sheet White reading "–:––" and "Waiting". While answering: on time (green ground), wrap up (amber, last 30 seconds), over time (red ground, white text, clock counts up with a `+` prefix). The clock has role timer with a visually hidden "Answer time left" prefix; the label has role status. Ground and text colour transition over 300ms ease-out, and transitions are disabled under `prefers-reduced-motion: reduce` (buttons too).

### Scoring Bands
A segmented horizontal scale with 1.5px ink outline and dividers, segment widths proportional to score span, each cell stacking a bold band name over a tabular threshold. Blue-grey grounds darken toward strong hire; the hiring-bar cell has a 4px ink underline. Vertical rows on narrow screens.

### Transcript
Ordered log. Interviewer turns are plain text; candidate turns sit in a Sheet White bubble with Hairline border. Turn tags are small bold ink-outlined labels.

## Do's and Don'ts

### Do:
- **Do** keep green, amber and red exclusively on the timing card, with red meaning over time only.
- **Do** pair every state colour with text and numerals.
- **Do** use Atkinson Hyperlegible at 400 and 700 only, with tabular numerals for clocks.
- **Do** outline sheets and controls in 1.5px ink; use Hairline for passive dividers.
- **Do** keep the answer box the largest control and keep tap targets at 2.75rem or more.
- **Do** guard any new transition with `prefers-reduced-motion`.
- **Do** keep layouts tolerant of longer German strings (flexible columns, wrapping button rows).

### Don't:
- **Don't** use red for errors, alerts or destructive actions; alerts are Tint with a 2px ink border.
- **Don't** add gradients, or shadows on anything other than the timing card.
- **Don't** introduce a second typeface or additional weights.
- **Don't** rely on colour alone to show a state.
- **Don't** assume a dark theme; none is built.
