# Bulb Merge Breakdown (`integration.tsx`)

This is a code-level breakdown of how the **bulb fusion** works in `src/components/integration/integration.tsx`.
It focuses on the merge system itself (not generic styling notes).

## 1) Merge System Overview

The fusion is a small state machine + canvas renderer:

- `phase`: `'idle' | 'merging' | 'merged'`
- `mergeProgress`: normalized progress from `0 -> 1`
- a `canvas` (`mergeCanvasRef`) drawn every frame from `mergeProgress`

During merge:

1. Two circles move toward center
2. They squash slightly as they travel
3. They blend into one smooth shape
4. They settle into a single merged bulb with a slight overshoot feel

## 2) Constants That Define The Geometry

These constants establish the merge stage and where each bulb starts:

- `BULB_SIZE`, `BULB_RADIUS`
- `BULB_GAP`
- `MERGE_VIEWBOX_WIDTH`, `MERGE_VIEWBOX_HEIGHT`
- `LEFT_BULB_CENTER_X`, `RIGHT_BULB_CENTER_X`
- `MERGE_CENTER_X`, `MERGE_CENTER_Y`
- phase thresholds:
  - `CONTACT_PROGRESS = 0.45`
  - `SINGLE_SHAPE_PROGRESS = 0.78`

Interpretation:

- `0.00 -> 0.45`: two separate circles approach
- `0.45 -> 0.78`: circles are fused with smooth-union blending
- `0.78 -> 1.00`: final single merged circle settles

## 3) Trigger + State Flow

The merge is started from the button via `handleContinue()`.

### `handleContinue()`

- if `phase === 'merging'`: ignore clicks
- if `phase === 'merged'`: reset to idle, then auto-restart merge after 460ms
- otherwise: call `fireMerge()`

### `fireMerge()`

- cancels previous timers/RAF
- sets `phase = 'merging'`
- sets `mergeProgress = 0` (or `1` if reduced motion)
- runs an RAF loop until complete:
  - `rawProgress = (now - startedAt) / merge.durationMs`
  - eased progress = `EASING_FUNCTIONS[merge.easing](rawProgress)`
  - `setMergeProgress(eased)`
- when finished: `phase = 'merged'`

This is why merge timing and feel are controlled by `merge.durationMs` and `merge.easing`.

## 4) Easing Layer

`EASING_FUNCTIONS` maps dialkit options to functions:

- `easeInOut`, `smooth`, `snap`, `back`, `spring`, `expo`

The selected easing transforms linear time into motion feel, so geometry logic stays the same while animation personality changes.

## 5) Canvas Draw Pipeline

The renderer is called from this effect:

- `useEffect(() => drawMergeShape(...), [mergeProgress, merge.squash, merge.defaultBulbColor, merge.mergedBulbColor])`

### `drawMergeShape(canvas, progress, squash, defaultBulbColor, mergedBulbColor)`

Responsibilities:

1. Setup hi-DPI canvas
   - scales by `window.devicePixelRatio`
2. Select fill color
   - before contact uses `defaultBulbColor`
   - after contact uses `mergedBulbColor`
3. Compute moving centers
   - `move = BULB_RADIUS * smoothstep(progress / SINGLE_SHAPE_PROGRESS)`
   - `leftX` moves right, `rightX` moves left
4. Branch by stage:
   - **Pre-contact (`progress < CONTACT_PROGRESS`)**
     - draw 2 ellipses with squash
   - **Fusion (`CONTACT_PROGRESS <= progress < SINGLE_SHAPE_PROGRESS`)**
     - draw smooth union blob
   - **Single shape (`progress >= SINGLE_SHAPE_PROGRESS`)**
     - draw final single ellipse with settle/overshoot

## 6) How The Smooth Union Works

Fusion stage uses signed-distance blending:

- per sample ray around the center, binary-search boundary point
- distance to left circle and right circle:
  - `leftDistance = hypot(...) - BULB_RADIUS`
  - `rightDistance = hypot(...) - BULB_RADIUS`
- blend distances with `smoothUnionDistance(d1, d2, k)`
- collect boundary points, then draw closed curve with quadratic segments

Key functions:

- `smoothUnionDistance(d1, d2, k)`
- `drawSmoothUnion(ctx, leftX, rightX, blend)`

`blend` increases as progress advances through fusion stage, making the bridge visually smoother and thicker.

## 7) Squash + Settle Details

### Squash while approaching

- `squashAmount = sin(clamp01(progress / 0.32) * PI) * squash`
- x-radius slightly increases, y-radius slightly decreases

This gives the bulbs a soft "compression" feel as they move.

### Final settle

In single-shape stage:

- `spring = easeOutBack(settle)`
- `overshoot = sin((1 - settle) * PI) * (1 - settle) * 0.06`
- final `rx`, `ry` are derived from these values

This prevents the final shape from feeling abrupt or dead-flat.

## 8) How It Connects To DOM Layout

In JSX:

- `<canvas className={styles.mergeCanvas} ... />` sits in the bulbs row
- left bulb, center grid, right bulb are still present as DOM nodes
- container has data attributes (`data-phase`, `data-merging`) for CSS phase styling

So the merge canvas is the animated morph layer, while bulbs/logos/grid remain the structural UI.

## 9) DialKit Controls That Matter For Fusion

Under `merge` in `useDialKit('Integration', ...)`:

- `durationMs`: total merge time
- `easing`: motion personality
- `squash`: pre-contact deformation amount
- `defaultBulbColor`: color before contact
- `mergedBulbColor`: color during/after fusion
- `checkDelayMs`, `checkDurationMs`: timing for success check styling

Live tuning these values is the fastest way to adjust the fusion feel without changing math.

## 10) Reduced Motion Handling

If user prefers reduced motion:

- `prefers-reduced-motion` is observed
- `fireMerge()` jumps directly to merged state (`mergeProgress = 1`, `phase = 'merged'`)

This keeps behavior accessible while preserving state consistency.

## Quick Sequence (Simple)

Use this as the mental model for one merge run:

| Time         | Progress                        | Visual                                 |
| ------------ | ------------------------------- | -------------------------------------- |
| Start        | `0%`                            | Two separate bulbs, resting positions  |
| Contact      | `45%` (`CONTACT_PROGRESS`)      | Bulbs touch; merge color starts        |
| Fusion       | `45% -> 78%`                    | Smooth blob bridge forms (union stage) |
| Single Shape | `78%` (`SINGLE_SHAPE_PROGRESS`) | One merged bulb shape appears          |
| End          | `100%`                          | Merged bulb settles and holds          |

### Super short version

- `0 -> 45`: approach
- `45 -> 78`: fuse
- `78 -> 100`: settle as one
