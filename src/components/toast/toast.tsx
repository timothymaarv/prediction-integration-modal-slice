import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import LoaderRing from '../../assets/tsx/LoaderRing'
import confetti3 from '../../assets/lottie/confetti-5.lottie?url'
import styles from './toast.module.css'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
// import ToastRipple from './ToastRipple'
import { PulsingBorder } from '@paper-design/shaders-react';

import usdcIcon from '../../assets/crypto/usdc.svg'

const confettiLayout = {
    fit: 'cover' as const,
    align: [0.5, 0.5] as [number, number],
}
const CONFIRMATION_TICK_MS = 1200
const BLINK_INTERVAL_MS = 700
const DEFAULT_WAVE_DURATION_MS = 1300
const DEFAULT_TAIL_DURATION_MS = 760
const DEFAULT_DISTORTION_STRENGTH = 4
const DEFAULT_BORDER_INTENSITY = 0.25
const DEFAULT_BORDER_SPEED = 0.8
const DEFAULT_BORDER_SMOKE_SIZE = 0.4
const DEFAULT_BORDER_BLOOM = 0.3
const DEFAULT_BORDER_SOFTNESS = 0.85
const DEFAULT_BORDER_PULSE = 0.5
const DEFAULT_BORDER_THICKNESS = 0.1
const DEFAULT_SHOCKWAVE_INTENSITY = 1
const DEFAULT_SHOCKWAVE_OPACITY = 0.34
const MIN_SCALE_UPDATE_DELTA = 0.004
const MIN_FREQ_UPDATE_DELTA = 0.00005

type DotLottiePlayer = {
    play: () => void
    pause?: () => void
    addEventListener: (event: 'complete', cb: () => void) => void
    removeEventListener: (event: 'complete', cb: () => void) => void
}

export type ToastProps = {
    confirmations: number
    totalRequiredConfirmations: number
    isConfirmationFinished: boolean
    isFlowPaused?: boolean
    setConfirmations: Dispatch<SetStateAction<number>>
    distortionStrength?: number
    waveDurationMs?: number
    tailDurationMs?: number
    confettiPlayCount?: number
    shockwaveIntensity?: number
    shockwaveOpacity?: number
    borderIntensity?: number
    borderSpeed?: number
    borderSmokeSize?: number
    borderBloom?: number
    borderSoftness?: number
    borderPulse?: number
    borderThickness?: number
}

export default function Toast({
    confirmations,
    totalRequiredConfirmations,
    isConfirmationFinished,
    isFlowPaused = false,
    setConfirmations,
    distortionStrength = DEFAULT_DISTORTION_STRENGTH,
    waveDurationMs = DEFAULT_WAVE_DURATION_MS,
    tailDurationMs = DEFAULT_TAIL_DURATION_MS,
    confettiPlayCount = 4,
    shockwaveIntensity = DEFAULT_SHOCKWAVE_INTENSITY,
    shockwaveOpacity = DEFAULT_SHOCKWAVE_OPACITY,
    borderIntensity = DEFAULT_BORDER_INTENSITY,
    borderSpeed = DEFAULT_BORDER_SPEED,
    borderSmokeSize = DEFAULT_BORDER_SMOKE_SIZE,
    borderBloom = DEFAULT_BORDER_BLOOM,
    borderSoftness = DEFAULT_BORDER_SOFTNESS,
    borderPulse = DEFAULT_BORDER_PULSE,
    borderThickness = DEFAULT_BORDER_THICKNESS,
}: ToastProps) {
    const [blinkOn, setBlinkOn] = useState(true)
    const [coinFlipNonce, setCoinFlipNonce] = useState(0)
    const [completionProgress, setCompletionProgress] = useState(0)
    const [completionRunNonce, setCompletionRunNonce] = useState(0)
    const prevIsFinishedRef = useRef(isConfirmationFinished)
    const prefersReducedMotion = useMemo(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        [],
    )
    const supportsSvgDistortion = useMemo(() => {
        if (typeof window === 'undefined') return false
        const ua = window.navigator.userAgent
        const isSafari =
            /Safari\//.test(ua) &&
            !/Chrome\//.test(ua) &&
            !/CriOS\//.test(ua) &&
            !/Edg\//.test(ua) &&
            !/OPR\//.test(ua)
        // Safari's SVG filter support is inconsistent for animated displacement.
        return !isSafari
    }, [])
    const confettiPlayerRef = useRef<DotLottiePlayer | null>(null)
    const confettiCompleteListenerRef = useRef<(() => void) | null>(null)
    const confettiPlayCountRef = useRef(0)
    const turbulenceRef = useRef<SVGFETurbulenceElement | null>(null)
    const displacementRef = useRef<SVGFEDisplacementMapElement | null>(null)
    const waveGlowRef = useRef<HTMLDivElement | null>(null)
    const lastScaleRef = useRef(0)
    const lastFxRef = useRef(0.01)
    const lastFyRef = useRef(0.01)


    const lottieRenderConfig = useMemo(
        () => ({
            autoResize: true,
            quality: 100,
            devicePixelRatio:
                typeof window !== 'undefined'
                    ? Math.min(window.devicePixelRatio || 1, 3)
                    : 1,
        }),
        [],
    )

    useEffect(() => {
        if (isConfirmationFinished || isFlowPaused) return

        const id = window.setInterval(() => {
            setConfirmations((prev) =>
                Math.min(prev + 1, totalRequiredConfirmations),
            )
        }, CONFIRMATION_TICK_MS)

        return () => window.clearInterval(id)
    }, [isConfirmationFinished, isFlowPaused, setConfirmations, totalRequiredConfirmations])

    useEffect(() => {
        if (isConfirmationFinished) {
            setBlinkOn(false)
            return
        }

        const id = window.setInterval(() => {
            setBlinkOn((prev) => !prev)
        }, BLINK_INTERVAL_MS)

        return () => window.clearInterval(id)
    }, [isConfirmationFinished])

    useEffect(() => {
        const wasFinished = prevIsFinishedRef.current
        if (!wasFinished && isConfirmationFinished) {
            setCoinFlipNonce((n) => n + 1)
            setCompletionRunNonce((n) => n + 1)
        }
        if (!isConfirmationFinished) {
            setCompletionProgress(0)
        }
        prevIsFinishedRef.current = isConfirmationFinished
    }, [isConfirmationFinished])

    useEffect(() => {
        const turbulence = turbulenceRef.current
        const displacement = displacementRef.current
        const waveGlow = waveGlowRef.current
        if (!waveGlow) return

        if (completionRunNonce === 0) {
            if (supportsSvgDistortion && turbulence && displacement) {
                displacement.setAttribute('scale', '0')
                turbulence.setAttribute('baseFrequency', '0.01 0.01')
            }
            if (waveGlow) {
                waveGlow.style.opacity = '0'
                waveGlow.style.background = 'radial-gradient(circle, rgba(43, 132, 106, 0) 0%, rgba(43, 132, 106, 0) 100%)'
            }
            return
        }

        if (prefersReducedMotion) {
            if (supportsSvgDistortion && turbulence && displacement) {
                displacement.setAttribute('scale', '0')
                turbulence.setAttribute('baseFrequency', '0.01 0.01')
            }
            setCompletionProgress(1)
            if (waveGlow) {
                waveGlow.style.opacity = '0'
                waveGlow.style.background = 'radial-gradient(circle, rgba(43, 132, 106, 0) 0%, rgba(43, 132, 106, 0) 100%)'
            }
            return
        }

        let rafId = 0
        const start = performance.now()
        const TOTAL_DURATION_MS = waveDurationMs + tailDurationMs

        const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(1, elapsed / TOTAL_DURATION_MS)
            const waveProgress = Math.min(1, elapsed / waveDurationMs)
            const tailProgress = Math.min(
                1,
                Math.max(0, (elapsed - waveDurationMs) / tailDurationMs),
            )

            // Keep some residual amplitude at wave end so the tail visibly "lands".
            const envelope = Math.sin(waveProgress * Math.PI * 0.9)
            // Monotonic resolve to zero during the tail.
            const tailEase = 1 - tailProgress
            const settle = Math.pow(Math.max(0, tailEase), 1.85)
            const strength = Math.max(0, distortionStrength)
            const scale = Math.max(0, envelope * strength * settle)
            const fX = 0.01 - envelope * (0.0015 * (strength / DEFAULT_DISTORTION_STRENGTH)) * settle
            const fY = 0.01 - envelope * (0.0010 * (strength / DEFAULT_DISTORTION_STRENGTH)) * settle

            if (supportsSvgDistortion && turbulence && displacement) {
                if (
                    Math.abs(fX - lastFxRef.current) > MIN_FREQ_UPDATE_DELTA ||
                    Math.abs(fY - lastFyRef.current) > MIN_FREQ_UPDATE_DELTA
                ) {
                    turbulence.setAttribute(
                        'baseFrequency',
                        `${fX.toFixed(4)} ${fY.toFixed(4)}`,
                    )
                    lastFxRef.current = fX
                    lastFyRef.current = fY
                }
                if (Math.abs(scale - lastScaleRef.current) > MIN_SCALE_UPDATE_DELTA) {
                    displacement.setAttribute('scale', scale.toFixed(4))
                    lastScaleRef.current = scale
                }
            }
            setCompletionProgress(progress)
            const glowEnter = Math.min(1, waveProgress / 0.2)
            const glowDecay = 1 - tailProgress * tailProgress
            const waveIntensity = Math.max(0, shockwaveIntensity)
            const waveOpacity = Math.max(0, Math.min(1, shockwaveOpacity))
            const glowOpacity = Math.max(0, glowEnter * glowDecay * 0.38 * waveIntensity)
            if (waveGlow) {
                const waveRingRadiusPct = 8 + waveProgress * 145 * waveIntensity
                const waveRingInnerPct = Math.max(0, waveRingRadiusPct - 12)
                const waveRingOuterPct = waveRingRadiusPct + 14
                waveGlow.style.opacity = glowOpacity.toFixed(4)
                waveGlow.style.background = `radial-gradient(circle,
                    rgba(43, 132, 106, 0) ${waveRingInnerPct.toFixed(1)}%,
                    rgba(43, 132, 106, ${waveOpacity.toFixed(3)}) ${waveRingRadiusPct.toFixed(1)}%,
                    rgba(43, 132, 106, 0) ${waveRingOuterPct.toFixed(1)}%)`
            }

            if (tailProgress >= 1) {
                if (supportsSvgDistortion && turbulence && displacement) {
                    displacement.setAttribute('scale', '0')
                    turbulence.setAttribute('baseFrequency', '0.01 0.01')
                }
                setCompletionProgress(1)
                if (waveGlow) {
                    waveGlow.style.opacity = '0'
                }
                return
            }

            rafId = window.requestAnimationFrame(tick)
        }

        rafId = window.requestAnimationFrame(tick)
        return () => window.cancelAnimationFrame(rafId)
    }, [
        completionRunNonce,
        distortionStrength,
        prefersReducedMotion,
        supportsSvgDistortion,
        shockwaveIntensity,
        shockwaveOpacity,
        tailDurationMs,
        waveDurationMs,
    ])

    useEffect(() => {
        if (!isConfirmationFinished) {
            confettiPlayCountRef.current = 0
        }
    }, [isConfirmationFinished])

    useEffect(() => {
        const player = confettiPlayerRef.current
        if (!player) return
        if (!isConfirmationFinished) return
        if (completionProgress < 0.05) return

        if (isFlowPaused) {
            player.pause?.()
            return
        }

        player.play()
    }, [completionProgress, isConfirmationFinished, isFlowPaused])

    const dotLottieRefCallback = useCallback((dotLottie: DotLottiePlayer | null) => {
        // cleanup previous instance listener
        if (confettiPlayerRef.current && confettiCompleteListenerRef.current) {
            confettiPlayerRef.current.removeEventListener(
                'complete',
                confettiCompleteListenerRef.current,
            )
        }

        confettiPlayerRef.current = dotLottie
        confettiCompleteListenerRef.current = null

        if (!dotLottie) return

        confettiPlayCountRef.current = 1 // first autoplay run

        const onComplete = () => {
            const targetPlayCount = Math.max(1, Math.round(confettiPlayCount))
            if (confettiPlayCountRef.current >= targetPlayCount) return
            confettiPlayCountRef.current += 1
            dotLottie.play()
        }

        confettiCompleteListenerRef.current = onComplete
        dotLottie.addEventListener('complete', onComplete)
    }, [confettiPlayCount])

    const ringArcColors = useMemo(() => {
        const COMPLETE_COLOR = '#2B846A'
        const CURRENT_COLOR_A = '#FFFFFF52'
        const CURRENT_COLOR_B = '#FFFFFF52' // white at 32% opacity
        const UPCOMING_COLOR = '#FFFFFF29'
        const STEP_COUNT = 4

        const completedSteps = Math.min(confirmations, STEP_COUNT)
        const currentStep = Math.min(completedSteps + 1, STEP_COUNT)

        return ([1, 2, 3, 4] as const).map((step) => {
            if (step <= completedSteps) return COMPLETE_COLOR
            if (!isConfirmationFinished && step === currentStep) {
                return blinkOn ? CURRENT_COLOR_A : CURRENT_COLOR_B
            }
            return UPCOMING_COLOR
        }) as [string, string, string, string]
    }, [blinkOn, confirmations, isConfirmationFinished])

    const showConfetti = isConfirmationFinished && completionProgress >= 0.05

    return (
        // style={{ scale: "2.5" }}
        <div className={styles.toastContainer} >
            <svg
                width="0"
                height="0"
                style={{ position: 'absolute', pointerEvents: 'none' }}
                aria-hidden
            >
                <defs>
                    <filter id="distort">
                        <feTurbulence
                            ref={turbulenceRef}
                            baseFrequency="0.01 0.01"
                            numOctaves="2"
                            result="noiseRaw"
                        />
                        <feGaussianBlur
                            in="noiseRaw"
                            stdDeviation="1.6"
                            result="noise"
                        />
                        <feDisplacementMap
                            ref={displacementRef}
                            in="SourceGraphic"
                            in2="noise"
                            scale="0"
                            xChannelSelector="R"
                            yChannelSelector="R"
                        />
                    </filter>
                </defs>
            </svg>


            {showConfetti && <DotLottieReact
                className={styles.confettiLayer}
                src={confetti3}
                autoplay
                loop={false}
                layout={confettiLayout}
                renderConfig={lottieRenderConfig}
                dotLottieRefCallback={dotLottieRefCallback}
            />}

            <div ref={waveGlowRef} className={styles.toastWaveGlow} aria-hidden />

            <div
                className={styles.toastContent}
                style={supportsSvgDistortion ? { filter: 'url(#distort)' } : undefined}
            >
                <div className={styles.toastTitle}>
                    <div className={`${styles.ringContainer} ${isConfirmationFinished ? styles.ringContainerLocked : ''}`}>
                        <LoaderRing arcColors={ringArcColors} />

                        <div
                            key={coinFlipNonce}
                            className={`${styles.ringCoin} ${isConfirmationFinished && coinFlipNonce > 0 ? styles.ringCoinConfirmFlip : ''}`}
                            aria-hidden
                        >
                            <div className={`${styles.ringFace} ${styles.ringFaceFront}`} >
                                <img src={usdcIcon} alt="" className={styles.ringFrontIcon} />
                            </div>
                            <div className={`${styles.ringFace} ${styles.ringFaceBack}`} >
                                <p className={styles.ringFaceBackValue}>{confirmations}</p>
                            </div>
                        </div>
                    </div>
                    {!isConfirmationFinished && <p className={styles.toastTitleText}>Deposit processing...</p>}
                    {isConfirmationFinished && <p className={styles.toastTitleText}>Deposit completed</p>}

                </div>

                {!isConfirmationFinished && <p className={styles.toastDescription}>
                    A deposit of 30.10 USDC has been added to your account and
                    pending {confirmations}/{totalRequiredConfirmations} confirmations.
                </p>}
                {isConfirmationFinished && <p className={styles.toastDescription}>
                    A deposit of 30.10 USDC has been added to your account.
                </p>}
            </div>

            <div className={styles.pulsingBorderWrap}>

                <PulsingBorder
                    width={288}
                    height={74}
                    colors={isConfirmationFinished ? ["#2B846A52", "#2B846A52", "#2B846A52"] : ["#855BFB52", "#855BFB52", "#855BFB52"]}
                    colorBack="#262626"
                    roundness={0.2}
                    thickness={borderThickness}
                    softness={borderSoftness}
                    aspectRatio="auto"
                    intensity={borderIntensity}
                    bloom={borderBloom}
                    spots={10}
                    spotSize={0.5}
                    pulse={borderPulse}
                    smoke={0.8}
                    smokeSize={borderSmokeSize}
                    speed={isFlowPaused ? 0 : borderSpeed}
                    scale={1}
                    marginLeft={0}
                    marginRight={0}
                    marginTop={0}
                    marginBottom={0}
                />
            </div>

        </div>
    )
}

// Thoughts
// Should we make it so that these states come after each other?
// Or we do a transition

// Perhaps we try both and see what 'feels' better