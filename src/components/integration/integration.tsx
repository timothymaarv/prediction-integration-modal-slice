import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialKit } from 'dialkit';
import styles from './integration.module.css';
import AcmeLogo from '../../assets/custom/acme.svg?react'
import SlackLogo from '../../assets/custom/slack.svg?react'
import { GRID_RESEARCH_TWO } from '../grid/grid-states';
import type { DotState } from '../grid/grid';

const DOT_SIZE = 3;
const DOT_GAP = 2;
const GRID_COLS = 5;
const GRID_ROWS = 5;
const STEP = DOT_SIZE + DOT_GAP;
const GRID_SIZE = GRID_COLS * DOT_SIZE + (GRID_COLS - 1) * DOT_GAP;
const DOT_RADIUS = DOT_SIZE / 2;

const DEFAULT_DOT_COLOR = 'rgba(255, 255, 255, 0.075)';

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

export default function Integration() {
    const params = useDialKit('Sweep', {
        durationMs: [1100, 200, 4000, 25],
        sigma: [1.1, 0.3, 3, 0.05],
        overshoot: [3, 0, 6, 0.25],
        shapeDim: '#8C4DFF38',
        shapeHead: '#9D82FE',
        neutralDim: '#232323',
        neutralHead: '#2E2E2E',
    }) as {
        durationMs: number;
        sigma: number;
        overshoot: number;
        shapeDim: string;
        shapeHead: string;
        neutralDim: string;
        neutralHead: string;
    };

    const shapeMask = useMemo(
        () => GRID_RESEARCH_TWO.map((row) => row.map(isShapeCell)),
        [],
    );

    const colors = useMemo(() => ({
        shapeDim: parseColor(params.shapeDim),
        shapeHead: parseColor(params.shapeHead),
        neutralDim: parseColor(params.neutralDim),
        neutralHead: parseColor(params.neutralHead),
    }), [params.shapeDim, params.shapeHead, params.neutralDim, params.neutralHead]);

    const tunablesRef = useRef({ durationMs: params.durationMs, overshoot: params.overshoot });
    tunablesRef.current = { durationMs: params.durationMs, overshoot: params.overshoot };

    const [headPosition, setHeadPosition] = useState(-params.overshoot);
    const headRef = useRef(-params.overshoot);

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

    const sigma = params.sigma;
    const twoSigmaSq = 2 * sigma * sigma;

    return <div className={styles.integrationContainer}>
        <div className={styles.top}>
            <div className={styles.bulbs}>

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
            {/* title */}

            <div className={styles.titles}>
                <span className={styles.title}>Connect your wallet</span>

                <p className={styles.subtitle}>Choose how you’d like to connect your Slack
                    workspace to Acme and get started today.</p>
            </div>
        </div>


        <div className={styles.bottom}>

            <button className={styles.continueButton}>
                <p className={styles.continueButtonText}>Continue</p>
            </button>

            <p className={styles.disclaimer}>By clicking Continue, you agree to the Privacy Policy</p>

        </div>
    </div>
}
