import { useMemo } from 'react';
import { GRID_RESEARCH_TWO } from '../grid/grid-states';
import type { DotState } from '../grid/grid';
import styles from './integration.module.css';

const DOT_SIZE = 3;
const DOT_GAP = 2;
const GRID_COLS = 5;
const GRID_ROWS = 5;
const STEP = DOT_SIZE + DOT_GAP;
const DOT_RADIUS = DOT_SIZE / 2;
const SHINE_RADIUS = DOT_RADIUS * 2;
export const GRID_SIZE = GRID_COLS * DOT_SIZE + (GRID_COLS - 1) * DOT_GAP;

const DEFAULT_DOT_COLOR = 'rgba(255, 255, 255, 0.075)';
const NEUTRAL_DOT_OPACITY = 0.3;
const SHAPE_DOT_BASELINE_OPACITY = 0.1;
const SHINE_MAX_OPACITY = 0.32;
const NEUTRAL_SHINE_MAX_OPACITY = 0.08;
const SHINE_RENDER_THRESHOLD = 0.01;

export type Rgba = [number, number, number, number];

type IntegrationResearchGridProps = {
    headPosition: number;
    twoSigmaSq: number;
    colors: {
        shapeDim: Rgba;
        shapeHead: Rgba;
        neutralDim: Rgba;
        neutralHead: Rgba;
    };
};

function isShapeCell(dot: DotState[number][number] | undefined): boolean {
    return typeof dot === 'string' && dot !== DEFAULT_DOT_COLOR;
}

function lerpRgba(a: Rgba, b: Rgba, t: number): string {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    const al = a[3] + (b[3] - a[3]) * t;
    return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}

export default function IntegrationResearchGrid({ headPosition, twoSigmaSq, colors }: IntegrationResearchGridProps) {
    const shapeMask = useMemo(
        () => GRID_RESEARCH_TWO.map((row) => row.map(isShapeCell)),
        [],
    );

    return (
        <svg
            className={styles.researchingGrid}
            width={GRID_SIZE}
            height={GRID_SIZE}
            viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
            overflow="visible"
            role="img"
            aria-label="Researching state grid"
        >
            <defs>
                <linearGradient
                    id="integrationDotFillGradient"
                    x1="50%"
                    y1="25.155%"
                    x2="50%"
                    y2="77.227%"
                >
                    <stop offset="0%" stopColor="#07B589" />
                    <stop offset="48%" stopColor="#45FFD1" />
                    <stop offset="100%" stopColor="#07B88C" />
                </linearGradient>
                <radialGradient id="integrationDotShineGradient" cx="50%" cy="40%" r="58%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                    <stop offset="35%" stopColor="#D6FFEF" stopOpacity="0.4" />
                    <stop offset="70%" stopColor="#7FFFDD" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#45FFD1" stopOpacity="0" />
                </radialGradient>
                <filter id="integrationDotShineBlur" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="0.7" />
                </filter>
                <filter id="integrationDotBottomShadow" x="-67%" y="-33%" width="233%" height="233%">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feColorMatrix
                        in="SourceAlpha"
                        type="matrix"
                        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                        result="hardAlpha"
                    />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="1" />
                    <feComposite in2="hardAlpha" operator="out" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.172549 0 0 0 0 0.952941 0 0 0 0 0.690196 0 0 0 0.42 0" />
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
                </filter>
            </defs>
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) =>
                Array.from({ length: GRID_COLS }, (_, colIndex) => {
                    const dx = colIndex - headPosition;
                    const intensity = Math.exp(-(dx * dx) / twoSigmaSq);
                    const isShape = shapeMask[rowIndex][colIndex];
                    const cx = colIndex * STEP + DOT_RADIUS;
                    const cy = rowIndex * STEP + DOT_RADIUS;
                    const key = `${rowIndex}-${colIndex}`;

                    if (isShape) {
                        return (
                            <g key={key}>
                                <circle
                                    className={styles.researchingDot}
                                    cx={cx}
                                    cy={cy}
                                    r={DOT_RADIUS}
                                    fill="url(#integrationDotFillGradient)"
                                    filter="url(#integrationDotBottomShadow)"
                                    opacity={SHAPE_DOT_BASELINE_OPACITY + intensity * (1 - SHAPE_DOT_BASELINE_OPACITY)}
                                />
                                {intensity > SHINE_RENDER_THRESHOLD && (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={SHINE_RADIUS}
                                        fill="url(#integrationDotShineGradient)"
                                        opacity={intensity * SHINE_MAX_OPACITY}
                                        filter="url(#integrationDotShineBlur)"
                                        pointerEvents="none"
                                    />
                                )}
                            </g>
                        );
                    }

                    return (
                        <g key={key}>
                            <circle
                                className={styles.researchingDot}
                                cx={cx}
                                cy={cy}
                                r={DOT_RADIUS}
                                fill={lerpRgba(colors.neutralDim, colors.neutralHead, intensity)}
                                opacity={NEUTRAL_DOT_OPACITY}
                            />
                            {intensity > SHINE_RENDER_THRESHOLD && (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={SHINE_RADIUS}
                                    fill="url(#integrationDotShineGradient)"
                                    opacity={intensity * NEUTRAL_SHINE_MAX_OPACITY}
                                    filter="url(#integrationDotShineBlur)"
                                    pointerEvents="none"
                                />
                            )}
                        </g>
                    );
                }),
            )}
        </svg>
    );
}
