import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, type Transition } from "motion/react"
import confetti from "canvas-confetti"
import { useWebHaptics } from "web-haptics/react"
import styles from "./order-form.module.css"
import btnStyles from "./order-form-button.module.css"

type ButtonState = "idle" | "ordering" | "success"

const SPRING: Transition = {
    type: "spring",
    duration: 0.35,
    bounce: 0,
}

const LETTER_SPRING: Transition = {
    type: "spring",
    damping: 25,
    mass: 0.2,
    stiffness: 400,
}

const CONFETTI_SETTINGS = {
    particleCount: 130,
    spread: 60,
    startVelocity: 60,
    gravity: 0.6,
    ticks: 150,
    scalar: 1,
    angle: 90,
    drift: -0.2,
    orderingDuration: 1800,
    successDuration: 2000,
} as const

type OrderFormButtonProps = {
    action: "buy" | "sell"
    side: "yes" | "no"
    /** Return true if order is valid, false to reject */
    onOrder: () => boolean
    onStateChange?: (isOrdering: boolean) => void
    disabled?: boolean
}

export default function OrderFormButton({ action, side, onOrder, onStateChange, disabled }: OrderFormButtonProps) {
    const [state, setState] = useState<ButtonState>("idle")
    const [lockedAction, setLockedAction] = useState(action)
    const [lockedSide, setLockedSide] = useState(side)
    const { trigger: triggerHaptic } = useWebHaptics()
    const buttonRef = useRef<HTMLButtonElement>(null)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const fireConfetti = useCallback(() => {
        if (!buttonRef.current) return
        const rect = buttonRef.current.getBoundingClientRect()
        const x = (rect.left + rect.width / 2) / window.innerWidth
        const y = (rect.top + rect.height / 2) / window.innerHeight

        confetti({
            particleCount: CONFETTI_SETTINGS.particleCount,
            spread: CONFETTI_SETTINGS.spread,
            startVelocity: CONFETTI_SETTINGS.startVelocity,
            gravity: CONFETTI_SETTINGS.gravity,
            ticks: CONFETTI_SETTINGS.ticks,
            scalar: CONFETTI_SETTINGS.scalar,
            angle: CONFETTI_SETTINGS.angle,
            drift: CONFETTI_SETTINGS.drift,
            colors: ["#8C4DFF", "#35DF8D", "#FFD700", "#FF6B6B", "#4DAFFF"],
            shapes: ["circle", "square"],
            disableForReducedMotion: true,
            origin: { x, y },
        })
    }, [])

    const handleClick = useCallback(() => {
        if (state !== "idle" || disabled) return

        const valid = onOrder()
        if (!valid) return

        setLockedAction(action)
        setLockedSide(side)
        setState("ordering")
        onStateChange?.(true)

        timeoutRef.current = setTimeout(() => {
            setState("success")
            triggerHaptic("success")
            fireConfetti()

            timeoutRef.current = setTimeout(() => {
                setState("idle")
                onStateChange?.(false)
            }, CONFETTI_SETTINGS.successDuration)
        }, CONFETTI_SETTINGS.orderingDuration)
    }, [state, disabled, onOrder, fireConfetti, action, side, onStateChange])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    const activeAction = state === "idle" ? action : lockedAction
    const activeSide = state === "idle" ? side : lockedSide

    const idleLabel = `${action === "buy" ? "Buy" : "Sell"} ${side === "yes" ? "Yes" : "No"}`
    const orderingLabel = `Placing ${activeAction} order`
    const successLabel = `${activeAction === "buy" ? "Bought" : "Sold"} ${activeSide === "yes" ? "Yes" : "No"}`

    return (
        <motion.div
            className={styles.orderFormFooterButtonWrapper}
            animate={state === "success" ? { y: [0, 3, -1, 0] } : { y: 0 }}
            transition={state === "success" ? { duration: 0.4, ease: [0.16, 1, 0.3, 1], times: [0, 0.2, 0.5, 1] } : SPRING}
        >
            <div className={styles.orderFormButtonOverlay} />
            <motion.button
                ref={buttonRef}
                className={`${styles.orderFormFooterButton} ${state === "ordering" ? btnStyles.ordering : ""} ${state === "success" ? btnStyles.success : ""}`}
                type="button"
                onClick={handleClick}
                disabled={disabled || state !== "idle"}
                transition={SPRING}
                style={{ position: "relative", overflow: "hidden" }}
            >
                {(state === "ordering" || state === "success") && <div className={btnStyles.shine} />}

                <AnimatePresence mode="popLayout" initial={false}>
                    {state === "idle" && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.orderFormFooterButtonText}
                        >
                            <AnimatedText text={idleLabel} />
                        </motion.div>
                    )}

                    {state === "ordering" && (
                        <motion.div
                            key="ordering"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.orderFormFooterButtonText}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, position: "relative", zIndex: 1 }}
                        >
                            <Spinner />
                            <AnimatedText text={orderingLabel} />
                        </motion.div>
                    )}

                    {state === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.orderFormFooterButtonText}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        >
                            <Checkmark />
                            <AnimatedText text={successLabel} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </motion.div>
    )
}

function AnimatedText({ text }: { text: string }) {
    const words = text.split(" ")
    let charOffset = 0
    return (
        <span style={{ display: "inline-flex", gap: 4 }}>
            {words.map((word, wordIndex) => {
                const startOffset = charOffset
                charOffset += word.length
                return (
                    <span key={`${word}-${wordIndex}`} style={{ display: "inline-flex" }}>
                        {word.split("").map((char, charIndex) => (
                            <motion.span
                                key={`${char}-${startOffset + charIndex}`}
                                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{
                                    ...LETTER_SPRING,
                                    delay: (startOffset + charIndex) * 0.008,
                                } as Transition}
                                style={{ display: "inline-block" }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </span>
                )
            })}
        </span>
    )
}

function Spinner() {
    return (
        <motion.svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        >
            <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                fill="none"
            />
            <path
                d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
        </motion.svg>
    )
}

function Checkmark() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <motion.path
                d="M3 7.5L5.5 10L11 4"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: [0.65, 0, 0.35, 1], delay: 0.1 }}
            />
        </svg>
    )
}
