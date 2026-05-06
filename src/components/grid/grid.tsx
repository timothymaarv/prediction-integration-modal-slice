import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './grid.module.css'
import { useGrid } from './grid-context'
import { GRID_STATES, GRID_SMILE, GRID_FROWN } from './grid-states'

const COLS = 5
const ROWS = 5
const DOT = 2
const GAP = 1
const STEP = DOT + GAP
const SIZE = COLS * DOT + (COLS - 1) * GAP // 14
const R = DOT / 2

export type DotObject = { color: string; scale?: number }
export type DotValue = string | null | undefined | DotObject
export type DotState = DotValue[][]

function isDotObject(v: DotValue): v is DotObject {
    return typeof v === 'object' && v !== null && 'color' in v
}

const DEFAULT_COLOR = 'currentColor'

// Canonical smile colors
const EYE_COLOR = GRID_SMILE[1][1] as string
const EYE_BG = GRID_SMILE[1][0] as string
const EYE_CY = 1 * STEP + R // row 1 center y

// Eye target cx for each zone
const EYE_TARGETS = {
    left:   { l: 0 * STEP + R, r: 2 * STEP + R },  // col 0, col 2
    center: { l: 1 * STEP + R, r: 3 * STEP + R },  // col 1, col 3
    right:  { l: 2 * STEP + R, r: 4 * STEP + R },  // col 2, col 4
} as const

// Lerp speed: 0–1, higher = faster. ~0.15 gives a soft ease.
const LERP_SPEED = 0.15
const LERP_THRESHOLD = 0.01

// States with eyes blanked (they'll be rendered separately during hover)
const blankEyeRow = (state: DotState): DotState =>
    state.map((row, r) => r !== 1 ? row : row.map(() => EYE_BG))

const SMILE_NO_EYES = blankEyeRow(GRID_SMILE)
const FROWN_NO_EYES = blankEyeRow(GRID_FROWN)

const FACE_STATES = new Set(['smile', 'frown'])

export default function Grid({ state: stateProp }: { state?: DotState }) {
    const ctx = useGridSafe()

    const isHovered = ctx?.isHovered ?? false
    const stateName = ctx?.stateName
    const smileConfig = ctx?.smileConfig ?? { hitArea: 40, debug: false }
    const isFace = !!stateName && FACE_STATES.has(stateName)

    // Refs for the two eye circles
    const leftEyeRef = useRef<SVGCircleElement>(null)
    const rightEyeRef = useRef<SVGCircleElement>(null)

    // Current animated cx positions
    const leftCx = useRef(EYE_TARGETS.center.l)
    const rightCx = useRef(EYE_TARGETS.center.r)
    const targetZone = useRef<keyof typeof EYE_TARGETS>('center')
    const rafId = useRef(0)

    const handleMouseEnter = useCallback(() => {
        ctx?.setHovered(true)
        targetZone.current = 'center'
    }, [ctx])

    const handleMouseLeave = useCallback(() => {
        targetZone.current = 'center'
        ctx?.setHovered(false)
    }, [ctx])

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        if (x < 0.33) targetZone.current = 'left'
        else if (x > 0.66) targetZone.current = 'right'
        else targetZone.current = 'center'
    }, [])

    // rAF loop: lerp eye cx toward target — runs whenever a face is shown
    useEffect(() => {
        if (!isFace) {
            cancelAnimationFrame(rafId.current)
            leftCx.current = EYE_TARGETS.center.l
            rightCx.current = EYE_TARGETS.center.r
            return
        }

        const tick = () => {
            const target = EYE_TARGETS[targetZone.current]

            const dlx = target.l - leftCx.current
            const drx = target.r - rightCx.current

            if (Math.abs(dlx) > LERP_THRESHOLD) {
                leftCx.current += dlx * LERP_SPEED
            } else {
                leftCx.current = target.l
            }

            if (Math.abs(drx) > LERP_THRESHOLD) {
                rightCx.current += drx * LERP_SPEED
            } else {
                rightCx.current = target.r
            }

            leftEyeRef.current?.setAttribute('cx', String(leftCx.current))
            rightEyeRef.current?.setAttribute('cx', String(rightCx.current))

            rafId.current = requestAnimationFrame(tick)
        }

        rafId.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafId.current)
    }, [isFace])

    // Idle expression machine: while not hovered, fire a random expression
    // every ~5 seconds. Each expression is a tiny timeline of steps so we
    // can sequence things like "blink THEN look left" or "look left THEN
    // look right" with proper timing. Feels alive.
    useEffect(() => {
        if (!isFace || isHovered) return

        const BLINK_MS = 110         // single eyelid close duration
        const BLINK_GAP_MS = 120     // pause between the two blinks in a double-blink
        const LOOK_HOLD_MS = 700     // how long a glance lingers before returning

        // Total time for a double-blink sequence
        const DOUBLE_BLINK_MS = BLINK_MS + BLINK_GAP_MS + BLINK_MS

        // All pending timers so cleanup can cancel everything.
        const timers: number[] = []
        const delay = (fn: () => void, ms: number) => {
            timers.push(window.setTimeout(fn, ms))
        }

        const setEyesOpen = (open: boolean) => {
            const op = open ? '1' : '0'
            leftEyeRef.current?.setAttribute('opacity', op)
            rightEyeRef.current?.setAttribute('opacity', op)
        }

        // Double-blink starting at `offset` ms from now.
        const blink = (offset = 0) => {
            delay(() => setEyesOpen(false), offset)
            delay(() => setEyesOpen(true), offset + BLINK_MS)
            delay(() => setEyesOpen(false), offset + BLINK_MS + BLINK_GAP_MS)
            delay(() => setEyesOpen(true), offset + DOUBLE_BLINK_MS)
        }

        // Look in a direction at `offset`, hold, then return to center.
        const look = (zone: 'left' | 'right', offset = 0) => {
            delay(() => { targetZone.current = zone }, offset)
            delay(() => { targetZone.current = 'center' }, offset + LOOK_HOLD_MS)
        }

        // ── Expression library ────────────────────────────────────────
        // Each returns its total duration so the scheduler knows when
        // it's safe to queue the next one.

        const expressions = [
            // Just a double-blink
            () => { blink(); return DOUBLE_BLINK_MS },
            // Look left (no blink)
            () => { look('left'); return LOOK_HOLD_MS },
            // Look right (no blink)
            () => { look('right'); return LOOK_HOLD_MS },
            // Blink THEN look left
            () => {
                blink()
                look('left', DOUBLE_BLINK_MS + 60)
                return DOUBLE_BLINK_MS + 60 + LOOK_HOLD_MS
            },
            // Blink THEN look right
            () => {
                blink()
                look('right', DOUBLE_BLINK_MS + 60)
                return DOUBLE_BLINK_MS + 60 + LOOK_HOLD_MS
            },
            // Look left THEN look right
            () => {
                look('left')
                look('right', LOOK_HOLD_MS + 100)
                return LOOK_HOLD_MS + 100 + LOOK_HOLD_MS
            },
            // Look right THEN look left
            () => {
                look('right')
                look('left', LOOK_HOLD_MS + 100)
                return LOOK_HOLD_MS + 100 + LOOK_HOLD_MS
            },
            // Blink THEN look left THEN look right
            () => {
                blink()
                const t1 = DOUBLE_BLINK_MS + 60
                look('left', t1)
                look('right', t1 + LOOK_HOLD_MS + 100)
                return t1 + LOOK_HOLD_MS + 100 + LOOK_HOLD_MS
            },
            // Blink THEN look right THEN look left
            () => {
                blink()
                const t1 = DOUBLE_BLINK_MS + 60
                look('right', t1)
                look('left', t1 + LOOK_HOLD_MS + 100)
                return t1 + LOOK_HOLD_MS + 100 + LOOK_HOLD_MS
            },
        ]

        // Never pick the same expression index twice in a row.
        let lastIdx = -1
        const pick = (): number => {
            let idx: number
            do {
                idx = Math.floor(Math.random() * expressions.length)
            } while (idx === lastIdx && expressions.length > 1)
            lastIdx = idx
            return idx
        }

        const schedule = () => {
            const wait = 4500 + Math.random() * 1000 // 4.5–5.5s
            delay(() => {
                const duration = expressions[pick()]()
                // Wait for the expression to finish + the idle gap.
                delay(schedule, duration + 200)
            }, wait)
        }

        schedule()

        return () => {
            timers.forEach(clearTimeout)
            setEyesOpen(true)
            targetZone.current = 'center'
        }
    }, [isFace, isHovered])

    // Determine display state — blank static eyes whenever a face is shown,
    // since the animated eye circles always take over
    let displayState = stateProp ?? ctx?.state
    if (!stateProp && stateName && stateName in GRID_STATES && isFace) {
        displayState = stateName === 'frown' ? FROWN_NO_EYES : SMILE_NO_EYES
    }

    const hitPad = smileConfig.hitArea
    const wrapRef = useRef<HTMLDivElement>(null)
    const [hitRect, setHitRect] = useState({ top: 0, left: 0 })

    // Track grid position for fixed-positioned hit area
    useLayoutEffect(() => {
        const el = wrapRef.current
        if (!el) return
        const update = () => {
            const r = el.getBoundingClientRect()
            const centerX = r.left + r.width / 2
            const centerY = r.top + r.height / 2
            setHitRect({ top: centerY - hitPad, left: centerX - hitPad })
        }
        update()
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
    }, [hitPad])

    const hitSize = hitPad * 2

    return (
        <div ref={wrapRef} className={styles.gridWrap}>
            {/* Debug: orange circle showing hit area */}
            {smileConfig.debug && (
                <div
                    className={styles.debugHitArea}
                    style={{
                        position: 'fixed',
                        width: hitSize,
                        height: hitSize,
                        top: hitRect.top,
                        left: hitRect.left,
                    }}
                />
            )}
            <div
                className={styles.hitArea}
                style={{
                    position: 'fixed',
                    width: hitSize,
                    height: hitSize,
                    top: hitRect.top,
                    left: hitRect.left,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
            />
            <svg
                className={styles.grid}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE + 0.8}`}
                role="img"
                aria-label="5 by 5 grid of dots"
                xmlns="http://www.w3.org/2000/svg"
            >
                {Array.from({ length: ROWS }, (_, r) =>
                    Array.from({ length: COLS }, (_, c) => {
                        const dot = displayState?.[r]?.[c]
                        const isHidden = dot === null
                        const obj = isDotObject(dot)
                        const fill = obj ? dot.color : (dot || DEFAULT_COLOR)
                        const scale = obj ? (dot.scale ?? 1) : 1
                        const cx = c * STEP + R
                        const cy = r * STEP + R

                        const isEye = isFace && r === 1 && (c === 1 || c === 3)
                        return (
                            <circle
                                key={`${r}-${c}`}
                                className={isEye ? `${styles.dot} ${styles.eye}` : styles.dot}
                                cx={cx}
                                cy={cy}
                                r={R}
                                fill={fill}
                                opacity={isHidden ? 0 : 1}
                                style={scale !== 1 ? {
                                    transform: `scale(${scale})`,
                                    transformOrigin: `${cx}px ${cy}px`,
                                } : undefined}
                            />
                        )
                    })
                )}

                {/* Animated eye circles — rendered on top, driven by rAF */}
                {isFace && (
                    <>
                        <circle
                            ref={leftEyeRef}
                            className={styles.eye}
                            cx={leftCx.current}
                            cy={EYE_CY}
                            r={R}
                            fill={EYE_COLOR}
                        />
                        <circle
                            ref={rightEyeRef}
                            className={styles.eye}
                            cx={rightCx.current}
                            cy={EYE_CY}
                            r={R}
                            fill={EYE_COLOR}
                        />
                    </>
                )}
            </svg>
        </div>
    )
}

function useGridSafe() {
    try {
        return useGrid()
    } catch {
        return null
    }
}
