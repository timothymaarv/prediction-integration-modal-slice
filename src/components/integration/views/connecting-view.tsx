import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { useWebHaptics } from 'web-haptics/react';
import NumberFlow from '@number-flow/react';
import AcmeLogo from '../../../assets/custom/acme.svg?react';
import IntegrationConnectionButton, { type ConnectionButtonState } from '../integration-connection-button';
import IntegrationResearchGrid, { GRID_SIZE, type Rgba } from '../integration-research-grid';
import { useIntegrationContext } from '../integration-context';
import { getWalletLabel } from '../wallets';
import { WalletIcon } from '../wallet-icon';
import styles from '../integration.module.css';
import Header from './header';
import type { IntegrationConnectionOutcome } from '../integration';

const GRID_COLS = 5;
const BULB_SIZE = 68;
const BULB_RADIUS = BULB_SIZE / 2;
const BULB_GAP = 12;
const LEFT_BULB_GLOW_PEAK = -1;
const RIGHT_BULB_GLOW_PEAK = 5;
const BULB_GLOW_SIGMA = 1;
const BULB_GLOW_TWO_SIGMA_SQ = 2 * BULB_GLOW_SIGMA * BULB_GLOW_SIGMA;
const BULB_GLOW_BASELINE = 0.3;
const MERGE_VIEWBOX_PADDING = 12;
const MERGE_VIEWBOX_WIDTH = BULB_SIZE * 2 + GRID_SIZE + BULB_GAP * 2 + MERGE_VIEWBOX_PADDING * 2;
const MERGE_VIEWBOX_HEIGHT = BULB_SIZE + MERGE_VIEWBOX_PADDING * 2;
const LEFT_BULB_CENTER_X = BULB_RADIUS + MERGE_VIEWBOX_PADDING;
const RIGHT_BULB_CENTER_X = MERGE_VIEWBOX_WIDTH - BULB_RADIUS - MERGE_VIEWBOX_PADDING;
const MERGE_CENTER_X = MERGE_VIEWBOX_WIDTH / 2;
const MERGE_CENTER_Y = MERGE_VIEWBOX_HEIGHT / 2;
const CONTACT_PROGRESS = 0.45;
const SINGLE_SHAPE_PROGRESS = 0.78;

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

type Phase = 'idle' | 'merging' | 'reversing' | 'merged-success' | 'merged-fail';
type MergeOverlay = 'none' | 'check' | 'cross';
type MergeCue = 'none' | 'nod' | 'wiggle';

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
    if (nums && nums.length >= 3) return [nums[0], nums[1], nums[2], nums[3] ?? 1];
    return [0, 0, 0, 1];
}

function lerpRgba(a: Rgba, b: Rgba, t: number): string {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    const al = a[3] + (b[3] - a[3]) * t;
    return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}

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

function buildWiggleFrames(amplitude: number, shakes: number): number[] {
    const steps = Math.max(1, Math.round(shakes));
    const frames: number[] = [0];
    for (let index = 0; index < steps; index += 1) {
        const t = 1 - index / Math.max(steps, 1);
        const direction = index % 2 === 0 ? -1 : 1;
        frames.push(direction * amplitude * t);
    }
    frames.push(0);
    return frames;
}

function buildWiggleTimes(length: number): number[] {
    if (length <= 1) return [0];
    return Array.from({ length }, (_, index) => index / (length - 1));
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

function drawSmoothUnion(ctx: CanvasRenderingContext2D, leftX: number, rightX: number, blend: number, gooK: number, gooKBlend: number) {
    const samples = 192;
    const points: Array<{ x: number; y: number }> = [];
    const maxRadius = MERGE_VIEWBOX_WIDTH;
    const k = gooK + blend * gooKBlend;

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
            if (distance <= 0) low = mid;
            else high = mid;
        }

        points.push({ x: MERGE_CENTER_X + dx * low, y: MERGE_CENTER_Y + dy * low });
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
    gooK: number,
    gooKBlend: number,
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
    drawSmoothUnion(ctx, leftX, rightX, blend, gooK, gooKBlend);
}

type ConnectingViewProps = {
    outcome: IntegrationConnectionOutcome;
    onSuccessCountdownFinished: () => void;
};

export default function ConnectingView({ outcome, onSuccessCountdownFinished }: ConnectingViewProps) {
    const { setView, selectedWallet } = useIntegrationContext();
    const activeWallet = selectedWallet ?? 'metamask';
    const walletLabel = getWalletLabel(activeWallet);
    const params = {
        sweep: {
            durationMs: 1700,
            sigma: 1.1,
            overshoot: 3,
            shapeDim: '#8C4DFF38',
            shapeHead: '#9D82FE',
            neutralDim: '#232323',
            neutralHead: '#2E2E2E',
        },
        merge: {
            durationMs: 350,
            nodDurationMs: 120,
            nodDistance: 10,
            nodStiffness: 320,
            nodDamping: 14,
            nodMass: 0.9,
            easing: 'easeInOut',
            squash: 0.166666,
            gooK: 20,
            gooKBlend: 40,
            outcome,
            wiggleDistance: 6,
            wiggleRotate: 1,
            wiggleShakes: 4,
            wiggleDurationMs: 180,
            stageBg: '#4b4b4b',
            containerBg: '#171717',
            defaultBulbColor: '#1e1e1e',
            successMergedBulbColor: '#16A678',
            errorMergedBulbColor: '#FF4653',
            acmeInnerShadow: 'rgba(22, 166, 120, 0.24)',
            slackInnerShadow: 'rgba(22, 166, 120, 0.24)',
            checkDelayMs: 100,
            checkDurationMs: 400,
            colorTransitionMs: 700,
            failRevertDelayMs: 380,
            failRevertDurationMs: 320,
        },
    };

    const sweep = params.sweep;
    const merge = params.merge;

    const colors = useMemo(
        () => ({
            shapeDim: parseColor(sweep.shapeDim),
            shapeHead: parseColor(sweep.shapeHead),
            neutralDim: parseColor(sweep.neutralDim),
            neutralHead: parseColor(sweep.neutralHead),
        }),
        [sweep.shapeDim, sweep.shapeHead, sweep.neutralDim, sweep.neutralHead],
    );

    const [headPosition, setHeadPosition] = useState(-sweep.overshoot);
    const tunablesRef = useRef({ durationMs: sweep.durationMs, overshoot: sweep.overshoot });
    const headRef = useRef(-sweep.overshoot);

    useEffect(() => {
        tunablesRef.current = { durationMs: sweep.durationMs, overshoot: sweep.overshoot };
    }, [sweep.durationMs, sweep.overshoot]);

    useEffect(() => {
        let frameId = 0;
        const startTime = performance.now();
        const tick = (now: number) => {
            const { durationMs, overshoot } = tunablesRef.current;
            const cycle = Math.max(durationMs, 1);
            const t = ((now - startTime) % cycle) / cycle;
            const eased = (1 - Math.cos(t * Math.PI)) / 2;
            const span = GRID_COLS - 1 + overshoot * 2;
            const start = -overshoot;
            const next = start + eased * span;
            headRef.current = next;
            setHeadPosition(next);
            frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--integration-bg', merge.containerBg);
        root.style.setProperty('--acme-inner-shadow', merge.acmeInnerShadow);
        root.style.setProperty('--slack-inner-shadow', merge.slackInnerShadow);
        root.style.setProperty('--merge-check-delay', `${merge.checkDelayMs}ms`);
        root.style.setProperty('--merge-check-duration', `${merge.checkDurationMs}ms`);
    }, [merge.stageBg, merge.containerBg, merge.acmeInnerShadow, merge.slackInnerShadow, merge.checkDelayMs, merge.checkDurationMs]);

    const sigma = sweep.sigma;
    const twoSigmaSq = 2 * sigma * sigma;
    const leftBulbGlow = Math.exp(-Math.pow(headPosition - LEFT_BULB_GLOW_PEAK, 2) / BULB_GLOW_TWO_SIGMA_SQ);
    const rightBulbGlow = Math.exp(-Math.pow(headPosition - RIGHT_BULB_GLOW_PEAK, 2) / BULB_GLOW_TWO_SIGMA_SQ);
    const leftBulbOpacity = BULB_GLOW_BASELINE + leftBulbGlow * (1 - BULB_GLOW_BASELINE);
    const rightBulbOpacity = BULB_GLOW_BASELINE + rightBulbGlow * (1 - BULB_GLOW_BASELINE);
    const wiggleXFrames = useMemo(() => buildWiggleFrames(merge.wiggleDistance, merge.wiggleShakes), [merge.wiggleDistance, merge.wiggleShakes]);
    const wiggleRotateFrames = useMemo(() => buildWiggleFrames(merge.wiggleRotate, merge.wiggleShakes), [merge.wiggleRotate, merge.wiggleShakes]);
    const wiggleTimes = useMemo(() => buildWiggleTimes(wiggleXFrames.length), [wiggleXFrames.length]);

    const [phase, setPhase] = useState<Phase>('idle');
    const [mergeProgress, setMergeProgress] = useState(0);
    const [overlay, setOverlay] = useState<MergeOverlay>('none');
    const [mergeCue, setMergeCue] = useState<MergeCue>('none');
    const [mergedFill, setMergedFill] = useState(merge.successMergedBulbColor);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const mergeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const mergeTimerRef = useRef<number | null>(null);
    const mergeFrameRef = useRef<number | null>(null);
    const nodTimerRef = useRef<number | null>(null);
    const overlayTimerRef = useRef<number | null>(null);
    const colorFrameRef = useRef<number | null>(null);
    const mergedFillRef = useRef(merge.successMergedBulbColor);
    const outcomeRef = useRef<IntegrationConnectionOutcome>(outcome);

    useEffect(() => {
        outcomeRef.current = outcome;
    }, [outcome]);

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
        if (nodTimerRef.current) clearTimeout(nodTimerRef.current);
        if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
        if (colorFrameRef.current) cancelAnimationFrame(colorFrameRef.current);
    }, []);

    const clearMergeTimers = () => {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        if (mergeFrameRef.current) cancelAnimationFrame(mergeFrameRef.current);
        if (nodTimerRef.current) clearTimeout(nodTimerRef.current);
        if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
        if (colorFrameRef.current) cancelAnimationFrame(colorFrameRef.current);
    };

    useEffect(() => {
        mergedFillRef.current = mergedFill;
    }, [mergedFill]);

    useEffect(() => {
        if (phase === 'idle') setMergedFill(merge.defaultBulbColor);
    }, [merge.defaultBulbColor, phase]);

    const animateMergeFill = (toColor: string, durationMs: number) => {
        if (colorFrameRef.current) cancelAnimationFrame(colorFrameRef.current);
        if (prefersReducedMotion || durationMs <= 0) {
            setMergedFill(toColor);
            return;
        }
        const startAt = performance.now();
        const fromColor = parseColor(mergedFillRef.current);
        const target = parseColor(toColor);
        const tick = (now: number) => {
            const t = clamp01((now - startAt) / durationMs);
            const eased = smoothstep(t);
            setMergedFill(lerpRgba(fromColor, target, eased));
            if (t < 1) colorFrameRef.current = requestAnimationFrame(tick);
            else colorFrameRef.current = null;
        };
        colorFrameRef.current = requestAnimationFrame(tick);
    };

    const fireMerge = () => {
        clearMergeTimers();
        const currentOutcome = outcomeRef.current;
        setPhase('merging');
        setMergeProgress(prefersReducedMotion ? 1 : 0);
        setOverlay('none');
        setMergeCue('none');
        setMergedFill(merge.defaultBulbColor);

        if (prefersReducedMotion) {
            setMergeCue(currentOutcome === 'failed' ? 'wiggle' : 'nod');
            setOverlay(currentOutcome === 'failed' ? 'cross' : 'check');
            animateMergeFill(
                currentOutcome === 'failed' ? merge.errorMergedBulbColor : merge.successMergedBulbColor,
                currentOutcome === 'failed' ? merge.failRevertDurationMs : merge.colorTransitionMs,
            );
            nodTimerRef.current = window.setTimeout(() => setMergeCue('none'), merge.nodDurationMs);
            setPhase(currentOutcome === 'failed' ? 'merged-fail' : 'merged-success');
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
            setMergeCue(currentOutcome === 'failed' ? 'wiggle' : 'nod');
            setOverlay(currentOutcome === 'failed' ? 'cross' : 'check');
            animateMergeFill(
                currentOutcome === 'failed' ? merge.errorMergedBulbColor : merge.successMergedBulbColor,
                currentOutcome === 'failed' ? merge.failRevertDurationMs : merge.colorTransitionMs,
            );
            nodTimerRef.current = window.setTimeout(() => setMergeCue('none'), merge.nodDurationMs);
            setPhase(currentOutcome === 'failed' ? 'merged-fail' : 'merged-success');
            mergeFrameRef.current = null;
        };
        mergeFrameRef.current = requestAnimationFrame(tick);
    };

    const handleContinue = () => {
        if (phase === 'merging') return;
        if (phase !== 'idle') {
            clearMergeTimers();
            setPhase('idle');
            setMergeProgress(0);
            setOverlay('none');
            setMergeCue('none');
            setMergedFill(merge.defaultBulbColor);
            mergeTimerRef.current = window.setTimeout(fireMerge, 460);
            return;
        }
        fireMerge();
    };

    useEffect(() => {
        if (!mergeCanvasRef.current) return;
        drawMergeShape(
            mergeCanvasRef.current,
            mergeProgress,
            merge.squash,
            merge.defaultBulbColor,
            mergedFill,
            merge.gooK,
            merge.gooKBlend,
        );
    }, [mergeProgress, merge.squash, merge.defaultBulbColor, mergedFill, merge.gooK, merge.gooKBlend]);

    const showMergeLayer = phase !== 'idle';
    const showMergeCanvas = phase === 'merging' || phase === 'reversing';
    const showResultOrb = phase === 'merged-success' || phase === 'merged-fail';
    const [buttonState, setButtonState] = useState<ConnectionButtonState>('idle');
    const successHandledRef = useRef(false);
    const successCountdownTimerRef = useRef<number | null>(null);
    const successCloseHandledRef = useRef(false);
    const [successCountdown, setSuccessCountdown] = useState(5);
    const { trigger: triggerHaptic } = useWebHaptics();

    useEffect(() => {
        if (phase === 'idle') {
            successHandledRef.current = false;
            successCloseHandledRef.current = false;
            setSuccessCountdown(5);
            if (successCountdownTimerRef.current) clearInterval(successCountdownTimerRef.current);
            setButtonState('idle');
            return;
        }
        if (phase === 'merging' || phase === 'reversing') {
            setButtonState('connecting');
            return;
        }
        if (phase === 'merged-success') {
            setButtonState('connected');
            if (!successHandledRef.current) {
                successHandledRef.current = true;
                triggerHaptic('success');
            }
            return;
        }
        setButtonState('retry');
    }, [phase, triggerHaptic]);

    useEffect(() => {
        if (phase !== 'merged-success') {
            if (successCountdownTimerRef.current) clearInterval(successCountdownTimerRef.current);
            return;
        }
        if (successCountdownTimerRef.current) clearInterval(successCountdownTimerRef.current);
        successCountdownTimerRef.current = window.setInterval(() => {
            setSuccessCountdown((current) => Math.max(0, current - 1));
        }, 1000);
        return () => {
            if (successCountdownTimerRef.current) clearInterval(successCountdownTimerRef.current);
        };
    }, [phase]);

    useEffect(() => {
        if (phase !== 'merged-success' || successCountdown > 0 || successCloseHandledRef.current) return;
        successCloseHandledRef.current = true;
        onSuccessCountdownFinished();
    }, [phase, successCountdown, onSuccessCountdownFinished]);

    const handleConnectClick = useCallback(() => {
        if ((buttonState !== 'idle' && buttonState !== 'retry') || phase === 'merging') return;
        if (buttonState === 'retry') {
            clearMergeTimers();
            setPhase('idle');
            setMergeProgress(0);
            setOverlay('none');
            setMergeCue('none');
            setMergedFill(merge.defaultBulbColor);
            setSuccessCountdown(5);
            return;
        }
        setButtonState('connecting');
        setTimeout(() => {
            handleContinue();
        }, 2500);
    }, [buttonState, phase, merge.defaultBulbColor]);

    const isSuccessPhase = phase === 'merged-success';
    const isFailPhase = phase === 'merged-fail';
    const title = isSuccessPhase ? 'Connection Success' : isFailPhase ? 'Request Cancelled' : 'Requesting connection';

    return (
        <>
            <Header onBack={() => setView('select')} onClose={() => setView('default')} />
            <div className={styles.top}>
                <div className={styles.bulbs} data-phase={phase} data-merging={phase !== 'idle' ? 'true' : undefined} data-connecting={phase !== 'idle' ? 'true' : undefined}>
                    <div className={styles.bulbsRow} style={{ width: MERGE_VIEWBOX_WIDTH, minHeight: MERGE_VIEWBOX_HEIGHT }}>
                        <motion.div
                            className={styles.mergeLayer}
                            animate={{ opacity: showMergeLayer ? 1 : 0, y: mergeCue === 'nod' ? merge.nodDistance : 0, x: mergeCue === 'wiggle' ? wiggleXFrames : 0, rotate: mergeCue === 'wiggle' ? wiggleRotateFrames : 0 }}
                            transition={{
                                opacity: { duration: prefersReducedMotion ? 0.01 : 0.18, ease: 'easeOut' },
                                y: prefersReducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: merge.nodStiffness, damping: merge.nodDamping, mass: merge.nodMass },
                                x: { duration: prefersReducedMotion ? 0.01 : merge.wiggleDurationMs / 1000, ease: 'linear', times: wiggleTimes },
                                rotate: { duration: prefersReducedMotion ? 0.01 : merge.wiggleDurationMs / 1000, ease: 'linear', times: wiggleTimes },
                            }}
                        >
                            <canvas ref={mergeCanvasRef} className={styles.mergeCanvas} width={MERGE_VIEWBOX_WIDTH} height={MERGE_VIEWBOX_HEIGHT} aria-hidden="true" data-visible={showMergeCanvas ? 'true' : 'false'} />
                            <div className={styles.connectedBulbBackdrop} data-visible={phase === 'merged-success' ? 'true' : 'false'} aria-hidden="true" />
                            <svg className={styles.resultOrb} viewBox={`0 0 ${MERGE_VIEWBOX_WIDTH} ${MERGE_VIEWBOX_HEIGHT}`} aria-hidden="true" data-visible={showResultOrb ? 'true' : 'false'}>
                                <circle cx={MERGE_CENTER_X} cy={MERGE_CENTER_Y} r={BULB_RADIUS} fill={mergedFill} />
                            </svg>
                            <motion.svg className={styles.statusIcon} viewBox="0 0 28 28" aria-hidden="true" initial={false} animate={{ opacity: overlay === 'none' ? 0 : 1, scale: overlay === 'none' ? 0.82 : 1 }} transition={{ duration: prefersReducedMotion ? 0.01 : 0.2, ease: 'easeOut' }}>
                                {overlay === 'check' ? (
                                    <motion.path d="M7 14.5l4.2 4.2 9.8-9.8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: prefersReducedMotion ? 0.01 : merge.checkDurationMs / 1000, ease: 'easeInOut' }} />
                                ) : overlay === 'cross' ? (
                                    <>
                                        <motion.path d="M9 9l10 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: prefersReducedMotion ? 0.01 : merge.checkDurationMs / 1200, ease: 'easeOut' }} />
                                        <motion.path d="M19 9l-10 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: prefersReducedMotion ? 0.01 : merge.checkDurationMs / 1200, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.08 }} />
                                    </>
                                ) : null}
                            </motion.svg>
                        </motion.div>

                        <div className={styles.bulb} bulb-type="acme" style={{ '--bulb-glow-opacity': leftBulbOpacity } as CSSProperties}>
                            <AcmeLogo className={styles.bulbIcon} />
                        </div>
                        <IntegrationResearchGrid headPosition={headPosition} twoSigmaSq={twoSigmaSq} colors={colors} />
                        <div className={styles.bulb} bulb-type="wallet" style={{ '--bulb-glow-opacity': rightBulbOpacity } as CSSProperties}>
                            <WalletIcon wallet={activeWallet} className={styles.bulbIcon} />
                        </div>
                    </div>
                </div>

                <div className={styles.titles}>
                    <span className={styles.title}>{title}</span>
                    {isSuccessPhase ? (
                        <p className={styles.subtitle}>
                            You’re in. This dialog will close on its own in{' '}
                            <span className={styles.connectionCountdown}>
                                <NumberFlow
                                    value={successCountdown}
                                    format={{ minimumIntegerDigits: 1, maximumFractionDigits: 0 }}
                                />
                            </span>{' '}
                            seconds.
                        </p>
                    ) : isFailPhase ? (
                        <p className={styles.subtitle}>
                            You cancelled the request.
                            <br />
                            Click below to try again.
                        </p>
                    ) : (
                        <p className={styles.subtitle}>
                            Open {walletLabel} and approve the connection
                            <br />
                            to connect your wallet.
                        </p>
                    )}
                </div>
            </div>

            {/* style={{ marginTop: "20px" }} */}
            <div className={styles.bottom} >
                <IntegrationConnectionButton state={buttonState} onClick={handleConnectClick} disabled={buttonState !== 'idle' && buttonState !== 'retry'} />
            </div>
        </>
    );
}
