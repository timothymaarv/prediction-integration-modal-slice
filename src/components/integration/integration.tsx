import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialKit } from 'dialkit';
import styles from './integration.module.css';
import AcmeLogo from '../../assets/custom/acme.svg?react'
import SlackLogo from '../../assets/custom/slack.svg?react'
import { GRID_RESEARCH_TWO } from '../grid/grid-states';
import type { DotState } from '../grid/grid';

const DOT_SIZE = 2;
const DOT_GAP = 2;
const GRID_COLS = 5;
const GRID_ROWS = 5;
const STEP = DOT_SIZE + DOT_GAP;
const GRID_SIZE = GRID_COLS * DOT_SIZE + (GRID_COLS - 1) * DOT_GAP;
const DOT_RADIUS = DOT_SIZE / 2;
const BULB_SIZE = 68;
const BULB_RADIUS = BULB_SIZE / 2;
const BULB_GAP = 12;
const MERGE_VIEWBOX_WIDTH = BULB_SIZE * 2 + GRID_SIZE + BULB_GAP * 2;
const MERGE_VIEWBOX_HEIGHT = BULB_SIZE;
const LEFT_BULB_CENTER_X = BULB_RADIUS;
const RIGHT_BULB_CENTER_X = MERGE_VIEWBOX_WIDTH - BULB_RADIUS;
const MERGE_CENTER_X = MERGE_VIEWBOX_WIDTH / 2;
const MERGE_CENTER_Y = MERGE_VIEWBOX_HEIGHT / 2;
const CONTACT_PROGRESS = 0.45;
const SINGLE_SHAPE_PROGRESS = 0.78;

const DEFAULT_DOT_COLOR = 'rgba(255, 255, 255, 0.075)';

const EASING_FUNCTIONS: Record<string, (value: number) => number> = {
    easeInOut: (value) => {
        const t = clamp01(value);
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    smooth: (value) => smoothstep(value),
    snap: (value) => 1 - Math.pow(1 - clamp01(value), 4),
    back: (value) => easeOutBack(value),
    spring: (value) => {
        const t = clamp01(value);
        return 1 - Math.exp(-7 * t) * Math.cos(t * Math.PI * 3.2);
    },
    expo: (value) => value === 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(value)),
};

type Rgba = [number, number, number, number];

function isShapeCell(dot: DotState[number][number] | undefined): boolean {
    return typeof dot === 'string' && dot !== DEFAULT_DOT_COLOR;
}

function parseColor(c: string): Rgba {
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map((x) => x + x).join('');
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return [r, g, b, a];
    }
    const nums = c.match(/[\d.]+/g)?.map(Number);
    if (nums && nums.length >= 3) {
        return [nums[0], nums[1], nums[2], nums[3] ?? 1];
    }
    return [0, 0, 0, 1];
}

function lerpRgba(a: Rgba, b: Rgba, t: number): string {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    const al = a[3] + (b[3] - a[3]) * t;
    return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}

interface SweepFolder {
    durationMs: number;
    sigma: number;
    overshoot: number;
    shapeDim: string;
    shapeHead: string;
    neutralDim: string;
    neutralHead: string;
}

interface MergeFolder {
    durationMs: number;
    easing: string;
    squash: number;
    stageBg: string;
    containerBg: string;
    defaultBulbColor: string;
    mergedBulbColor: string;
    acmeInnerShadow: string;
    slackInnerShadow: string;
    checkDelayMs: number;
    checkDurationMs: number;
}

type Phase = 'idle' | 'merging' | 'merged';

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

function smoothstep(value: number): number {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
}

function easeOutBack(value: number): number {
    const t = clamp01(value) - 1;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * t * t * t + c1 * t * t;
}

function drawEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

function smoothUnionDistance(d1: number, d2: number, k: number): number {
    const h = clamp01(0.5 + 0.5 * (d2 - d1) / k);
    return d2 * (1 - h) + d1 * h - k * h * (1 - h);
}

function drawSmoothUnion(ctx: CanvasRenderingContext2D, leftX: number, rightX: number, blend: number) {
    const samples = 192;
    const points: Array<{ x: number; y: number }> = [];
    const maxRadius = MERGE_VIEWBOX_WIDTH;
    const k = 10 + blend * 22;

    for (let index = 0; index < samples; index += 1) {
        const angle = (index / samples) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let low = 0;
        let high = maxRadius;

        for (let step = 0; step < 18; step += 1) {
            const mid = (low + high) / 2;
            const x = MERGE_CENTER_X + dx * mid;
            const y = MERGE_CENTER_Y + dy * mid;
            const leftDistance = Math.hypot(x - leftX, y - MERGE_CENTER_Y) - BULB_RADIUS;
            const rightDistance = Math.hypot(x - rightX, y - MERGE_CENTER_Y) - BULB_RADIUS;
            const distance = smoothUnionDistance(leftDistance, rightDistance, k);

            if (distance <= 0) {
                low = mid;
            } else {
                high = mid;
            }
        }

        points.push({
            x: MERGE_CENTER_X + dx * low,
            y: MERGE_CENTER_Y + dy * low,
        });
    }

    ctx.beginPath();
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;

        if (index === 0) {
            ctx.moveTo(midX, midY);
            continue;
        }

        ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
    const first = points[0];
    const second = points[1];
    ctx.quadraticCurveTo(first.x, first.y, (first.x + second.x) / 2, (first.y + second.y) / 2);
    ctx.closePath();
    ctx.fill();
}

function drawMergeShape(
    canvas: HTMLCanvasElement,
    progress: number,
    squash: number,
    defaultBulbColor: string,
    mergedBulbColor: string,
) {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = MERGE_VIEWBOX_WIDTH * ratio;
    canvas.height = MERGE_VIEWBOX_HEIGHT * ratio;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = progress >= CONTACT_PROGRESS ? mergedBulbColor : defaultBulbColor;

    const move = BULB_RADIUS * smoothstep(progress / SINGLE_SHAPE_PROGRESS);
    const leftX = LEFT_BULB_CENTER_X + move;
    const rightX = RIGHT_BULB_CENTER_X - move;
    const settle = smoothstep((progress - SINGLE_SHAPE_PROGRESS) / (1 - SINGLE_SHAPE_PROGRESS));
    const squashAmount = Math.sin(clamp01(progress / 0.32) * Math.PI) * squash;

    if (progress >= SINGLE_SHAPE_PROGRESS) {
        const spring = easeOutBack(settle);
        const overshoot = Math.sin((1 - settle) * Math.PI) * (1 - settle) * 0.06;
        const rx = BULB_RADIUS * (1 + overshoot + (1 - spring) * 0.62);
        const ry = BULB_RADIUS * (1 - overshoot * 0.45);
        drawEllipse(ctx, MERGE_CENTER_X, MERGE_CENTER_Y, rx, ry);
        return;
    }

    if (progress < CONTACT_PROGRESS) {
        const rx = BULB_RADIUS * (1 + squashAmount);
        const ry = BULB_RADIUS * (1 - squashAmount * 0.8);
        drawEllipse(ctx, leftX, MERGE_CENTER_Y, rx, ry);
        drawEllipse(ctx, rightX, MERGE_CENTER_Y, rx, ry);
        return;
    }

    const blend = smoothstep((progress - CONTACT_PROGRESS) / (SINGLE_SHAPE_PROGRESS - CONTACT_PROGRESS));
    drawSmoothUnion(ctx, leftX, rightX, blend);
}

export default function Integration() {
    const params = useDialKit('Integration', {
        sweep: {
            _collapsed: true,
            durationMs: [1100, 200, 4000, 25],
            sigma: [1.1, 0.3, 3, 0.05],
            overshoot: [3, 0, 6, 0.25],
            shapeDim: '#8C4DFF38',
            shapeHead: '#9D82FE',
            neutralDim: '#232323',
            neutralHead: '#2E2E2E',
        },
        merge: {
            _collapsed: false,
            durationMs: [900, 200, 2000, 25],
            easing: { type: 'select' as const, options: ['easeInOut', 'smooth', 'snap', 'back', 'spring', 'expo'], default: 'easeInOut' },
            squash: [0.025, 0, 0.25, 0.005],
            stageBg: '#303031',
            containerBg: '#171717',
            defaultBulbColor: '#232323',
            mergedBulbColor: '#232323',
            acmeInnerShadow: 'rgba(133, 91, 251, 0.12)',
            slackInnerShadow: 'rgba(44, 93, 254, 0.12)',
            checkDelayMs: [180, 0, 1500, 25],
            checkDurationMs: [420, 100, 1500, 25],
        },
    }) as { sweep: SweepFolder; merge: MergeFolder };

    const sweep = params.sweep;
    const merge = params.merge;

    const shapeMask = useMemo(
        () => GRID_RESEARCH_TWO.map((row) => row.map(isShapeCell)),
        [],
    );

    const colors = useMemo(() => ({
        shapeDim: parseColor(sweep.shapeDim),
        shapeHead: parseColor(sweep.shapeHead),
        neutralDim: parseColor(sweep.neutralDim),
        neutralHead: parseColor(sweep.neutralHead),
    }), [sweep.shapeDim, sweep.shapeHead, sweep.neutralDim, sweep.neutralHead]);

    const [headPosition, setHeadPosition] = useState(-sweep.overshoot);
    const tunablesRef = useRef({ durationMs: sweep.durationMs, overshoot: sweep.overshoot });
    const headRef = useRef(-sweep.overshoot);

    useEffect(() => {
        tunablesRef.current = { durationMs: sweep.durationMs, overshoot: sweep.overshoot };
    }, [sweep.durationMs, sweep.overshoot]);

    useEffect(() => {
        let frameId = 0;
        let lastTime = performance.now();

        const tick = (now: number) => {
            const dt = now - lastTime;
            lastTime = now;
            const { durationMs, overshoot } = tunablesRef.current;
            const span = GRID_COLS - 1 + overshoot * 2;
            const speed = span / Math.max(durationMs, 1);

            let next = headRef.current + speed * dt;
            const end = GRID_COLS - 1 + overshoot;
            const start = -overshoot;
            if (next > end) {
                const wrap = (next - start) % span;
                next = start + (wrap < 0 ? wrap + span : wrap);
            } else if (next < start) {
                next = start;
            }
            headRef.current = next;
            setHeadPosition(next);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--show-background', merge.stageBg);
        root.style.setProperty('--integration-bg', merge.containerBg);
        root.style.setProperty('--acme-inner-shadow', merge.acmeInnerShadow);
        root.style.setProperty('--slack-inner-shadow', merge.slackInnerShadow);
        root.style.setProperty('--merge-check-delay', `${merge.checkDelayMs}ms`);
        root.style.setProperty('--merge-check-duration', `${merge.checkDurationMs}ms`);
    }, [
        merge.stageBg,
        merge.containerBg,
        merge.acmeInnerShadow,
        merge.slackInnerShadow,
        merge.checkDelayMs,
        merge.checkDurationMs,
    ]);

    const sigma = sweep.sigma;
    const twoSigmaSq = 2 * sigma * sigma;

    const [phase, setPhase] = useState<Phase>('idle');
    const [mergeProgress, setMergeProgress] = useState(0);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const mergeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const mergeTimerRef = useRef<number | null>(null);
    const mergeFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updatePreference = () => setPrefersReducedMotion(media.matches);
        updatePreference();
        media.addEventListener('change', updatePreference);
        return () => media.removeEventListener('change', updatePreference);
    }, []);

    useEffect(() => () => {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        if (mergeFrameRef.current) cancelAnimationFrame(mergeFrameRef.current);
    }, []);

    const fireMerge = () => {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        if (mergeFrameRef.current) cancelAnimationFrame(mergeFrameRef.current);

        setPhase('merging');
        setMergeProgress(prefersReducedMotion ? 1 : 0);

        if (prefersReducedMotion) {
            setPhase('merged');
            return;
        }

        const startedAt = performance.now();
        const tick = (now: number) => {
            const rawProgress = clamp01((now - startedAt) / Math.max(merge.durationMs, 1));
            const easing = EASING_FUNCTIONS[merge.easing] ?? EASING_FUNCTIONS.easeInOut;
            setMergeProgress(clamp01(easing(rawProgress)));

            if (rawProgress < 1) {
                mergeFrameRef.current = requestAnimationFrame(tick);
                return;
            }

            setPhase('merged');
            mergeFrameRef.current = null;
        };

        mergeFrameRef.current = requestAnimationFrame(tick);
    };

    const handleContinue = () => {
        if (phase === 'merging') return;
        if (phase === 'merged') {
            if (mergeTimerRef.current) {
                clearTimeout(mergeTimerRef.current);
                mergeTimerRef.current = null;
            }
            setPhase('idle');
            setMergeProgress(0);
            mergeTimerRef.current = window.setTimeout(fireMerge, 460);
            return;
        }
        fireMerge();
    };

    const buttonLabel = phase === 'merged' ? 'Replay' : 'Continue';

    useEffect(() => {
        if (!mergeCanvasRef.current) return;
        drawMergeShape(
            mergeCanvasRef.current,
            mergeProgress,
            merge.squash,
            merge.defaultBulbColor,
            merge.mergedBulbColor,
        );
    }, [mergeProgress, merge.squash, merge.defaultBulbColor, merge.mergedBulbColor]);

    return <div className={styles.integrationContainer}>
        <div className={styles.top}>
            <div
                className={styles.bulbs}
                data-phase={phase}
                data-merging={phase !== 'idle' ? 'true' : undefined}
            >
                <div className={styles.bulbsRow}>
                    <canvas
                        ref={mergeCanvasRef}
                        className={styles.mergeCanvas}
                        width={MERGE_VIEWBOX_WIDTH}
                        height={MERGE_VIEWBOX_HEIGHT}
                        aria-hidden="true"
                    />

                    {/* bulbs */}
                    <div className={styles.bulb} bulb-type="acme">
                        <AcmeLogo className={styles.bulbIcon} />
                    </div>

                    <svg
                        className={styles.researchingGrid}
                        width={GRID_SIZE}
                        height={GRID_SIZE}
                        viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
                        role="img"
                        aria-label="Researching state grid"
                    >
                        {Array.from({ length: GRID_ROWS }, (_, rowIndex) =>
                            Array.from({ length: GRID_COLS }, (_, colIndex) => {
                                const dx = colIndex - headPosition;
                                const intensity = Math.exp(-(dx * dx) / twoSigmaSq);
                                const isShape = shapeMask[rowIndex][colIndex];
                                const fill = isShape
                                    ? lerpRgba(colors.shapeDim, colors.shapeHead, intensity)
                                    : lerpRgba(colors.neutralDim, colors.neutralHead, intensity);
                                const cx = colIndex * STEP + DOT_RADIUS;
                                const cy = rowIndex * STEP + DOT_RADIUS;

                                return (
                                    <circle
                                        key={`${rowIndex}-${colIndex}`}
                                        className={styles.researchingDot}
                                        cx={cx}
                                        cy={cy}
                                        r={DOT_RADIUS}
                                        fill={fill}
                                    />
                                );
                            })
                        )}
                    </svg>

                    <div className={styles.bulb} bulb-type="slack">
                        <SlackLogo className={styles.bulbIcon} />
                    </div>
                </div>

                <svg className={styles.checkmark} viewBox="0 0 28 28" aria-hidden="true">
                    <path d="M7 14.5l4.2 4.2 9.8-9.8" />
                </svg>
            </div>
            {/* title */}

            <div className={styles.titles}>
                <span className={styles.title}>Connect your wallet</span>

                <p className={styles.subtitle}>Choose how you’d like to connect your Slack
                    workspace to Acme and get started today.</p>
            </div>
        </div>


        <div className={styles.bottom}>

            <button
                className={styles.continueButton}
                onClick={handleContinue}
                disabled={phase === 'merging'}
            >
                <p className={styles.continueButtonText}>{buttonLabel}</p>
            </button>

            <p className={styles.disclaimer}>By clicking Continue, you agree to the Privacy Policy</p>

        </div>
    </div>
}
