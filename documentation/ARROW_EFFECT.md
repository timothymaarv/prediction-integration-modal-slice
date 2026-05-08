# ARROW_EFFECT Build Guide

This is a practical step-by-step guide to build the velocity-influenced arrow effect from scratch.

## Goal

Build an arrow button where:

- long press holds the arrow stretched
- release snaps back with overshoot
- fast click stretches more than slow click
- shaft (bow) and arrow head animate independently

---

## 1) Build the SVG asset first

File: `src/assets/custom/arrow-right.svg`

You need two separate paths:

1. first path = shaft (horizontal line)
2. second path = arrow head (tip)

If your SVG is a single path, split it before doing anything else.

---

## 2) Add arrow component in your button

In your button markup, render the arrow SVG with a dedicated class:

- example class: `emailInputButtonIcon` or `optionButtonIcon`

Also add a conditional pressed class on the button:

- example: `emailInputButtonPressed`
- this class is what drives the hold-stretch state

---

## 3) Track pointer down/up in React

Add local state:

- `pressed` boolean
- `intensity` number (0..1)
- `pressStartRef` timestamp

Pointer handlers needed:

- `onPointerDown`:
  - save `performance.now()` to `pressStartRef`
  - set `pressed = true`
- `onPointerUp` and `onPointerCancel`:
  - compute elapsed ms
  - convert elapsed -> intensity
  - optional pressure boost from `event.pressure`
  - set `pressed = false`
- `onPointerLeave`:
  - set `pressed = false` (safety)

---

## 4) Map runtime intensity to CSS variables

Create an inline style object on the button:

- `--...-arrow-stretch` (shaft scaleX)
- `--...-arrow-head-shift` (head translateX)
- `--...-arrow-release-ms` (snap-back duration)
- `--...-arrow-overshoot` (cubic-bezier overshoot)

Example mapping shape:

- stretch base + intensity delta
- head shift base + intensity delta
- release ms base + intensity delta
- overshoot base + intensity delta

Tip: calibrate normal click to around `0.5` intensity.

---

## 5) Write CSS for shaft/head separately

For the shaft (`path:first-of-type`):

- set `transform-origin: left center`
- animate `scaleX(...)`

For the head (`path:last-of-type`):

- set `transform-origin: center`
- animate `translateX(...)`

Release transition:

- use CSS vars for duration and overshoot curve

Pressed state:

- use fast press-in transition (around `75-90ms`)
- apply transform from CSS vars

---

## 6) Make long press hold correctly

Do not rely only on `:active`.

Use a React class toggle (`pressed` class) so the effect remains stretched while held, and releases cleanly on pointer up/cancel.

---

## 7) Optional hover shaft reveal pattern

If you want shaft hidden by default (used in `select-view`):

- default shaft: `opacity: 0`
- hover shaft: `opacity: 1`
- add `opacity 100ms ease` transition

Do not animate shaft direction from hidden state; keep transform direction stable and only use opacity for reveal.

---

## 8) Fix tiny shaft/head gaps

If a micro-gap appears during stretch:

1. add tiny shaft nudge in pressed state:
   - `translateX(0.1px - 0.3px) scaleX(...)`
2. adjust head shift slightly
3. adjust stretch slightly

Tune in that order for fastest alignment.

---

## 9) Add reduced-motion fallback

Inside `@media (prefers-reduced-motion: reduce)`:

- shorten transition durations to near-zero
- disable pressed transforms

Keep behavior functional, just remove decorative motion.

---

## 10) Reuse checklist

When copying this effect to another button:

1. Use the two-path arrow SVG.
2. Add `pressed` state + pointer handlers.
3. Compute `intensity` from press duration (+ optional pressure).
4. Feed CSS variables from intensity.
5. Animate shaft/head independently.
6. Add reduced-motion rules.
