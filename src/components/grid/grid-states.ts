import type { DotState } from "./grid";

const d = "rgba(255, 255, 255, 0.075)"; // default color
const w = "rgba(140, 77, 255, 1)"; // color
const l = "rgba(140, 77, 255, 0.5)"; // light color

/** All dots visible at default color */
export const GRID_DEFAULT: DotState = [
  [d, d, d, d, d],
  [d, d, d, d, d],
  [d, d, d, d, d],
  [d, d, d, d, d],
  [d, d, d, d, d],
];

/** Smile face */
export const GRID_SMILE: DotState = [
  [d, d, d, d, d],
  [d, w, d, w, d],
  [d, d, d, d, d],
  [w, d, d, d, w],
  [d, w, w, w, d],
];

/** thinking */
export const GRID_THINKING: DotState = [
  [d, w, w, w, d],
  [w, d, d, d, w],
  [w, d, d, d, w],
  [d, w, w, w, d],
  [d, d, l, d, d],
];

/** Research one */
export const GRID_RESEARCH_ONE: DotState = [
  [d, d, w, d, d],
  [d, d, d, w, d],
  [w, w, w, w, w],
  [d, d, d, w, d],
  [d, d, w, d, d],
];

/** Research two */
export const GRID_RESEARCH_TWO: DotState = [
  [d, w, w, d, d],
  [d, d, w, w, d],
  [d, d, d, w, w],
  [d, d, w, w, d],
  [d, w, w, d, d],
];

/** cooking */
export const GRID_COOKING: DotState = [
  [d, l, l, l, d],
  [w, w, w, w, w],
  [w, d, d, d, w],
  [w, d, d, d, w],
  [d, w, w, w, d],
];

/** assigning */
export const GRID_ASSIGNING: DotState = [
  [d, d, w, d, d],
  [d, w, d, w, d],
  [w, d, l, d, w],
  [d, w, d, w, d],
  [d, d, w, d, d],
];

/** frown */
export const GRID_FROWN: DotState = [
  [d, d, d, d, d],
  [d, w, d, w, d],
  [d, d, d, d, d],
  [d, w, w, w, d],
  [w, d, d, d, w],
];

/** cancelled */
export const GRID_CANCELLED: DotState = [
  [l, d, d, d, l],
  [d, w, d, w, d],
  [d, d, w, d, d],
  [d, w, d, w, d],
  [l, d, d, d, l],
];

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

export type GridAnimation = { frames: DotState[]; interval: number };

export interface ChaseParams {
  pulseColor: string;
  trailColor: string;
  bgColor: string;
  interval: number;
  trailLength: number;
}

/**
 * Parse any CSS color (hex 3/4/6/8 or rgba()) into [r, g, b, a].
 */
function parseColor(c: string): [number, number, number, number] {
  // hex
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    // expand shorthand: #RGB → RRGGBB, #RGBA → RRGGBBAA
    if (hex.length <= 4) {
      hex = hex.split("").map((h) => h + h).join("");
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }
  // rgba() or rgb()
  const nums = c.match(/[\d.]+/g)?.map(Number);
  if (nums && nums.length >= 3) {
    return [nums[0], nums[1], nums[2], nums[3] ?? 1];
  }
  return [0, 0, 0, 1];
}

/**
 * Interpolate between two colors based on a 0–1 factor.
 */
function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1, a1] = parseColor(a);
  const [r2, g2, b2, a2] = parseColor(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const ma = a1 + (a2 - a1) * t;
  return `rgba(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)}, ${+ma.toFixed(3)})`;
}

/**
 * Generate a neon-chase sequence by sweeping a bright pulse across columns.
 * trailLength controls how many columns stay lit behind the pulse (1 = just pulse, no trail).
 */
export function columnChase(
  shape: DotState,
  params: ChaseParams,
  cols = 5,
): GridAnimation {
  const { pulseColor, trailColor, bgColor, interval, trailLength } = params;
  const trail = Math.max(1, Math.round(trailLength));
  const frames: DotState[] = [];

  for (let pulse = 0; pulse < cols; pulse++) {
    const frame = shape.map((row) =>
      row.map((dot, c) => {
        if (dot === d) return bgColor;

        // distance behind the pulse head (wrapping)
        const dist = (pulse - c + cols) % cols;

        if (dist === 0) return pulseColor;
        if (dist < trail) {
          // fade from trailColor → bgColor as dist increases
          const t = dist / trail;
          return lerpColor(trailColor, bgColor, t);
        }
        return bgColor;
      }),
    );
    frames.push(frame);
  }

  return { frames, interval };
}

// ---------------------------------------------------------------------------
// Cooking – steam wisps cycling across the three top dots
// ---------------------------------------------------------------------------

export interface SteamParams {
  brightColor: string;
  medColor: string;
  dimColor: string;
  interval: number;
}

export function steamAnimation(params: SteamParams): GridAnimation {
  const { brightColor, medColor, dimColor, interval } = params;

  // Build a base frame from GRID_COOKING with static pot colors
  const makeFrame = (s1: string, s2: string, s3: string): DotState => [
    [d, s1, s2, s3, d],
    [w, w, w, w, w],
    [w, d, d, d, w],
    [w, d, d, d, w],
    [d, w, w, w, d],
  ];

  return {
    frames: [
      makeFrame(brightColor, medColor, dimColor),
      makeFrame(dimColor, brightColor, medColor),
      makeFrame(medColor, dimColor, brightColor),
    ],
    interval,
  };
}

// ---------------------------------------------------------------------------
// Smile – Agents-style column sweep across full grid
// ---------------------------------------------------------------------------

export interface SmileParams {
  pulseColor: string;
  trailColor: string;
  bgColor: string;
  dimColor: string;
  interval: number;
  trailLength: number;
}

// Shape dots for face animations
const SMILE_SHAPE = new Set([
  "1,1", "1,3", "3,0", "3,4", "4,1", "4,2", "4,3",
]);
const FROWN_SHAPE = new Set([
  "1,1", "1,3", "3,1", "3,2", "3,3", "4,0", "4,4",
]);

function faceAnimation(
  shape: Set<string>,
  params: SmileParams,
): GridAnimation {
  const { pulseColor, trailColor, bgColor, dimColor, interval, trailLength } = params;
  const cols = 5;
  const trail = Math.max(1, Math.round(trailLength));
  const frames: DotState[] = [];

  for (let pulse = 0; pulse < cols; pulse++) {
    const frame: DotState = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => {
        const isShape = shape.has(`${r},${c}`);
        const dist = (pulse - c + cols) % cols;

        if (dist === 0) {
          return isShape ? pulseColor : lerpColor(bgColor, dimColor, 0.6);
        }
        if (dist < trail) {
          const t = dist / trail;
          if (isShape) return lerpColor(trailColor, bgColor, t);
          return lerpColor(dimColor, bgColor, t);
        }
        return bgColor;
      }),
    );
    frames.push(frame);
  }

  // Final frame: full shape visible so it lands readable
  const finalFrame: DotState = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) =>
      shape.has(`${r},${c}`) ? pulseColor : bgColor,
    ),
  );
  frames.push(finalFrame);

  return { frames, interval };
}

export function smileAnimation(params: SmileParams): GridAnimation {
  return faceAnimation(SMILE_SHAPE, params);
}

export function frownAnimation(params: SmileParams): GridAnimation {
  return faceAnimation(FROWN_SHAPE, params);
}

// ---------------------------------------------------------------------------
// Thinking – light bulb breathing glow
// ---------------------------------------------------------------------------

export interface BulbParams {
  glowColor: string;
  dimColor: string;
  rayColor: string;
  bgColor: string;
  interval: number;
}

// Bulb outline grouped by ring (top → bottom) for staggered delay
const BULB_RINGS: [number, number][][] = [
  [[0, 1], [0, 2], [0, 3]],       // ring 0 – top cap
  [[1, 0], [1, 4]],               // ring 1 – upper sides
  [[2, 0], [2, 4]],               // ring 2 – lower sides
  [[3, 1], [3, 2], [3, 3]],       // ring 3 – base
];
// Interior grouped by ring
const BULB_INTERIOR_RINGS: [number, number][][] = [
  [[1, 1], [1, 2], [1, 3]],       // inner ring 0
  [[2, 1], [2, 2], [2, 3]],       // inner ring 1
];

export function bulbAnimation(params: BulbParams): GridAnimation {
  const { glowColor, dimColor, rayColor, bgColor, interval } = params;
  const frames: DotState[] = [];

  // 10-step breathing curve
  const curve = [0, 0.2, 0.5, 0.8, 1, 1, 0.8, 0.5, 0.2, 0];
  const steps = curve.length;

  // Each ring is offset by 1 step for a cascading wave
  for (let step = 0; step < steps; step++) {
    const frame: DotState = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => bgColor),
    );

    // Outline rings with staggered delay
    for (let ring = 0; ring < BULB_RINGS.length; ring++) {
      const t = curve[(step - ring + steps) % steps];
      const color = lerpColor(dimColor, glowColor, t);
      for (const [r, c] of BULB_RINGS[ring]) frame[r][c] = color;
    }

    // Interior rings with deeper stagger (offset 1 from their outline ring)
    for (let ring = 0; ring < BULB_INTERIOR_RINGS.length; ring++) {
      const ringOffset = ring + 1; // interior follows its surrounding outline ring
      const t = curve[(step - ringOffset + steps) % steps];
      const interiorT = Math.max(0, (t - 0.3) / 0.7);
      const color = lerpColor(bgColor, rayColor, interiorT);
      for (const [r, c] of BULB_INTERIOR_RINGS[ring]) frame[r][c] = color;
    }

    // Filament (4,2): blink on/off every other frame
    const blinkOn = step % 2 === 0;
    frame[4][2] = blinkOn ? lerpColor(dimColor, glowColor, 0.6) : dimColor;

    frames.push(frame);
  }

  return { frames, interval };
}

// ---------------------------------------------------------------------------
// Assigning – Inference-style scattered dot pulse
// ---------------------------------------------------------------------------

export interface AssigningParams {
  pulseColor: string;
  trailColor: string;
  dimColor: string;
  bgColor: string;
  interval: number;
  trailLength: number;
}

// Outer ring of diamond in clockwise order (the "seeking" dots)
const ASSIGNING_RING: [number, number][] = [
  [0, 2], // top
  [1, 3], // top-right
  [2, 4], // right
  [3, 3], // bottom-right
  [4, 2], // bottom
  [3, 1], // bottom-left
  [2, 0], // left
  [1, 1], // top-left
];

export function assigningAnimation(params: AssigningParams): GridAnimation {
  const { pulseColor, trailColor, dimColor, bgColor, interval, trailLength } = params;
  const ringCount = ASSIGNING_RING.length;
  const trail = Math.max(1, Math.round(trailLength));
  const frames: DotState[] = [];

  // Center pulse: gentle breathing over the ring cycle
  const centerCurve = Array.from({ length: ringCount }, (_, i) => {
    const t = Math.sin((i / ringCount) * Math.PI * 2) * 0.5 + 0.5;
    return t;
  });

  for (let step = 0; step < ringCount; step++) {
    const frame: DotState = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => bgColor),
    );

    // Center dot (2,2): gentle pulse
    const ct = centerCurve[step];
    frame[2][2] = lerpColor(dimColor, pulseColor, ct);

    // Outer ring: one dot leads, trail follows clockwise
    for (let i = 0; i < ringCount; i++) {
      const [r, c] = ASSIGNING_RING[i];
      const dist = (step - i + ringCount) % ringCount;

      if (dist === 0) {
        frame[r][c] = pulseColor;
      } else if (dist < trail) {
        const t = dist / trail;
        frame[r][c] = lerpColor(trailColor, dimColor, t);
      } else {
        frame[r][c] = dimColor;
      }
    }

    frames.push(frame);
  }

  return { frames, interval };
}

// ---------------------------------------------------------------------------
// Cancelled – X cross-fade between l and w dots
// ---------------------------------------------------------------------------

export interface CancelledParams {
  brightColor: string;
  dimColor: string;
  bgColor: string;
  interval: number;
}

/*
  Cancelled shape:
  [l, d, d, d, l],   ← corners (l)
  [d, w, d, w, d],   ← inner cross (w)
  [d, d, w, d, d],   ← center (w)
  [d, w, d, w, d],   ← inner cross (w)
  [l, d, d, d, l],   ← corners (l)

  Animation: the w dots and l dots alternate opacity.
  When w dots are bright, l dots are dim and vice versa.
  Creates a breathing cross-fade like the X is "flickering".
*/

// Inner X arms (without center)
const CANCELLED_ARMS: [number, number][] = [
  [1, 1], [1, 3], [3, 1], [3, 3],
];
const CANCELLED_CORNERS: [number, number][] = [
  [0, 0], [0, 4], [4, 0], [4, 4],
];

export function cancelledAnimation(params: CancelledParams): GridAnimation {
  const { brightColor, dimColor, bgColor, interval } = params;
  const frames: DotState[] = [];

  // 8-step breathing: arms and corners alternate, center pulses independently
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t = Math.sin((i / steps) * Math.PI * 2) * 0.5 + 0.5;

    const frame: DotState = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => bgColor),
    );

    // Arms: bright when t is high
    const armColor = lerpColor(dimColor, brightColor, t);
    for (const [r, c] of CANCELLED_ARMS) frame[r][c] = armColor;

    // Corners: opposite phase
    const cornerColor = lerpColor(dimColor, brightColor, 1 - t);
    for (const [r, c] of CANCELLED_CORNERS) frame[r][c] = cornerColor;

    // Center (2,2): independent pulse at double speed
    const ct = Math.sin((i / steps) * Math.PI * 4) * 0.5 + 0.5;
    frame[2][2] = lerpColor(dimColor, brightColor, ct);

    frames.push(frame);
  }

  return { frames, interval };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All named states for dialkit / programmatic access */
export const GRID_STATES = {
  default: GRID_DEFAULT,
  smile: GRID_SMILE,
  thinking: GRID_THINKING,
  "research-1": GRID_RESEARCH_ONE,
  "research-2": GRID_RESEARCH_TWO,
  cooking: GRID_COOKING,
  assigning: GRID_ASSIGNING,
  frown: GRID_FROWN,
  cancelled: GRID_CANCELLED,
} as const satisfies Record<string, DotState>;

export type GridStateName = keyof typeof GRID_STATES;

