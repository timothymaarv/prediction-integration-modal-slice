import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { useWebHaptics } from 'web-haptics/react'
import NumberFlow from '@number-flow/react'
import confetti from 'canvas-confetti'
import SwitcherArrowIcon from '../../assets/custom/switcher-arrow.svg?react'
import CircularPlusIcon from '../../assets/custom/circular-plus.svg?react'
import styles from './order-input.module.css'

type ShareMode = 'shares' | 'amount'

type QuickPickOption =
    | { kind: 'delta'; delta: number }
    | { kind: 'minimumLiquidityReward'; shares: number }

const QUICK_PICKS: QuickPickOption[] = [
    { kind: 'delta', delta: -100 },
    { kind: 'delta', delta: -10 },
    { kind: 'delta', delta: 10 },
    { kind: 'delta', delta: 100 },
    { kind: 'minimumLiquidityReward', shares: 50 },
]

function quickPickLabel(option: QuickPickOption): string {
    if (option.kind === 'delta') {
        return option.delta > 0 ? `+${option.delta}` : `${option.delta}`
    }
    return `+${option.shares}`
}

function quickPickKey(option: QuickPickOption, index: number): string {
    if (option.kind === 'delta') return `delta:${option.delta}`
    return `minimumLiquidityReward:${option.shares}:${index}`
}

const PRICE_CENTS = 17
const INITIAL_BALANCE = 350

type ButtonState = 'idle' | 'ordering' | 'success'

const SPRING: Transition = {
    type: 'spring',
    duration: 0.35,
    bounce: 0,
}

const LETTER_SPRING: Transition = {
    type: 'spring',
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

export default function OrderInput() {
    const [shareMode, setShareMode] = useState<ShareMode>('shares')
    const [shares, setShares] = useState(17)
    const [amount, setAmount] = useState(0)
    const [amountText, setAmountText] = useState('0.00')
    const [sharesEditing, setSharesEditing] = useState(false)
    const [amountEditing, setAmountEditing] = useState(false)
    const [insufficientFunds, setInsufficientFunds] = useState(false)
    const [balance, setBalance] = useState(INITIAL_BALANCE)
    const sharesInputRef = useRef<HTMLInputElement>(null)
    const amountInputRef = useRef<HTMLInputElement>(null)
    const insufficientBannerRef = useRef<HTMLDivElement>(null)
    const insufficientTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const { trigger: triggerHaptic } = useWebHaptics()

    useEffect(() => {
        if (sharesEditing && sharesInputRef.current) {
            const el = sharesInputRef.current
            el.focus()
            el.setSelectionRange(el.value.length, el.value.length)
        }
    }, [sharesEditing])

    useEffect(() => {
        if (amountEditing && amountInputRef.current) {
            const el = amountInputRef.current
            el.focus()
            el.setSelectionRange(el.value.length, el.value.length)
        }
    }, [amountEditing])

    const effectiveShares =
        shareMode === 'shares' ? shares : Math.floor((amount * 100) / PRICE_CENTS)

    const totalDollars =
        shareMode === 'shares' ? (shares * PRICE_CENTS) / 100 : amount

    const showInsufficientFunds = useCallback(() => {
        if (insufficientTimerRef.current) clearTimeout(insufficientTimerRef.current)
        setInsufficientFunds(true)
        triggerHaptic('warning')
        const el = insufficientBannerRef.current
        if (el) {
            el.style.animation = 'none'
            void el.offsetHeight
            el.style.animation = ''
        }
        insufficientTimerRef.current = setTimeout(() => setInsufficientFunds(false), 3500)
    }, [triggerHaptic])

    const wouldBeInsufficient = (primaryValue: number) => {
        const total =
            shareMode === 'shares' ? (primaryValue * PRICE_CENTS) / 100 : primaryValue
        return total > balance
    }

    const checkInsufficient = (primaryValue: number) => {
        if (wouldBeInsufficient(primaryValue)) showInsufficientFunds()
    }

    const toggleShareMode = () => {
        if (shareMode === 'shares') {
            const next = Math.round(totalDollars * 100) / 100
            setAmount(next)
            setAmountText(next.toFixed(2))
            setShareMode('amount')
        } else {
            setShares(effectiveShares)
            setShareMode('shares')
        }
        triggerHaptic('selection')
    }

    const switcherDisplayText = (() => {
        if (shareMode === 'shares') {
            if (totalDollars >= 1_000_000) {
                const m = totalDollars / 1_000_000
                return `$${m % 1 === 0 ? m : m.toFixed(1)}M`
            }
            if (totalDollars >= 1000) {
                const k = totalDollars / 1000
                return `$${k % 1 === 0 ? k : k.toFixed(1)}K`
            }
            return `$${totalDollars.toFixed(2)}`
        }
        const s = effectiveShares
        if (s >= 1_000_000) {
            const m = s / 1_000_000
            return `${m % 1 === 0 ? m : m.toFixed(1)}M Y`
        }
        if (s >= 1000) {
            const k = s / 1000
            return `${k % 1 === 0 ? k : k.toFixed(1)}K Y`
        }
        return `${s} Y`
    })()

    const [buttonState, setButtonState] = useState<ButtonState>('idle')
    const buttonRef = useRef<HTMLButtonElement>(null)
    const buttonTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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
            colors: ['#8C4DFF', '#35DF8D', '#FFD700', '#FF6B6B', '#4DAFFF'],
            shapes: ['circle', 'square'],
            disableForReducedMotion: true,
            origin: { x, y },
        })
    }, [])

    const handleOrder = useCallback(() => {
        if (buttonState !== 'idle') return
        const primaryValue = shareMode === 'shares' ? shares : amount
        if (primaryValue <= 0 || wouldBeInsufficient(primaryValue)) {
            showInsufficientFunds()
            return
        }
        triggerHaptic('success')
        setBalance((b) => Math.max(0, Math.round((b - totalDollars) * 100) / 100))
        setButtonState('ordering')
        buttonTimeoutRef.current = setTimeout(() => {
            setButtonState('success')
            triggerHaptic('success')
            fireConfetti()
            buttonTimeoutRef.current = setTimeout(() => {
                setButtonState('idle')
            }, CONFETTI_SETTINGS.successDuration)
        }, CONFETTI_SETTINGS.orderingDuration)
    }, [buttonState, shareMode, shares, amount, totalDollars, showInsufficientFunds, triggerHaptic, fireConfetti])

    useEffect(
        () => () => {
            if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current)
            if (insufficientTimerRef.current) clearTimeout(insufficientTimerRef.current)
        },
        [],
    )

    const isOrdering = buttonState !== 'idle'
    const idleLabel = 'Buy Yes'
    const orderingLabel = 'Placing buy order'
    const successLabel = 'Bought Yes'

    return (
        <div className={styles.demo}>
            <div
                className={styles.card}
                style={isOrdering ? { pointerEvents: 'none' } : undefined}
            >
                <div className={styles.balance}>
                    <span className={styles.balanceLabel}>Balance</span>
                    <div className={styles.balanceContent}>
                        <div className={styles.balanceInput}>
                            <NumberFlow
                                value={balance}
                                format={{ maximumFractionDigits: 2 }}
                                className={styles.balanceValue}
                            />
                            <span className={styles.balanceUnit}>USD</span>
                        </div>
                        <button
                            type="button"
                            className={styles.balancePlusButton}
                            onClick={() => {
                                triggerHaptic('light')
                                setBalance((b) => b + 100)
                            }}
                            aria-label="Add funds"
                        >
                            <CircularPlusIcon className={styles.balancePlusIcon} />
                        </button>
                    </div>
                </div>

                <div className={styles.sharesContainer}>
                    <div className={styles.shares}>
                        <span className={styles.sharesLabel}>
                            {shareMode === 'shares' ? 'Shares' : 'Amount'}
                        </span>
                        <div className={styles.sharesContent}>
                            <div className={styles.sharesValue}>
                                {shareMode === 'shares' ? (
                                    sharesEditing ? (
                                        <input
                                            ref={sharesInputRef}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            aria-label="Shares"
                                            className={styles.sharesValueInput}
                                            size={Math.max(1, String(shares).length)}
                                            value={shares}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\D/g, '')
                                                let next = 0
                                                if (raw !== '') {
                                                    const n = parseInt(raw, 10)
                                                    if (!Number.isNaN(n)) next = Math.max(0, n)
                                                }
                                                setShares(next)
                                                checkInsufficient(next)
                                            }}
                                            onBlur={() => setSharesEditing(false)}
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label="Edit shares"
                                            className={styles.sharesDisplay}
                                            onClick={() => setSharesEditing(true)}
                                        >
                                            <NumberFlow
                                                value={shares}
                                                className={styles.sharesNumberFlow}
                                            />
                                        </button>
                                    )
                                ) : amountEditing ? (
                                    <input
                                        ref={amountInputRef}
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        aria-label="Amount in USD"
                                        className={styles.sharesValueInput}
                                        size={Math.max(1, amountText.length)}
                                        value={amountText}
                                        onChange={(e) => {
                                            let raw = e.target.value.replace(/[^\d.]/g, '')
                                            const firstDot = raw.indexOf('.')
                                            if (firstDot !== -1) {
                                                raw =
                                                    raw.slice(0, firstDot + 1) +
                                                    raw.slice(firstDot + 1).replace(/\./g, '')
                                            }
                                            const dot = raw.indexOf('.')
                                            if (dot !== -1 && raw.length - dot - 1 > 2) {
                                                raw = raw.slice(0, dot + 3)
                                            }
                                            if (raw.length > 1 && raw[0] === '0' && raw[1] !== '.') {
                                                raw = raw.replace(/^0+/, '') || '0'
                                            }
                                            setAmountText(raw)
                                            const n = parseFloat(raw)
                                            const next = Number.isFinite(n) ? Math.max(0, n) : 0
                                            setAmount(next)
                                            checkInsufficient(next)
                                        }}
                                        onBlur={() => {
                                            const n = parseFloat(amountText)
                                            const finalAmount = Number.isFinite(n)
                                                ? Math.max(0, Math.round(n * 100) / 100)
                                                : 0
                                            setAmount(finalAmount)
                                            setAmountText(finalAmount.toFixed(2))
                                            setAmountEditing(false)
                                        }}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        aria-label="Edit amount"
                                        className={styles.sharesDisplay}
                                        onClick={() => {
                                            setAmountText(amount.toFixed(2))
                                            setAmountEditing(true)
                                        }}
                                    >
                                        <NumberFlow
                                            value={amount}
                                            format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                                            className={styles.sharesNumberFlow}
                                        />
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                className={styles.shareModeSwitcher}
                                onClick={toggleShareMode}
                            >
                                <SwitcherArrowIcon className={styles.shareModeSwitcherIcon} />
                                <p className={styles.shareModeSwitcherText}>{switcherDisplayText}</p>
                            </button>
                        </div>
                    </div>

                    <div
                        className={`${styles.insufficientCollapse} ${insufficientFunds ? styles.insufficientCollapseShow : ''}`}
                        aria-hidden={!insufficientFunds}
                    >
                        <div className={styles.insufficientCollapseInner}>
                            <div ref={insufficientBannerRef} className={styles.insufficient} role="alert">
                                <p className={styles.insufficientText}>Insufficient funds</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.quickPick}>
                        <div className={styles.quickPickButtons}>
                            {QUICK_PICKS.map((option, index) => (
                                <Fragment key={quickPickKey(option, index)}>
                                    <button
                                        type="button"
                                        className={`${styles.quickPickButton} ${option.kind === 'minimumLiquidityReward' ? styles.quickPickButtonShimmer : ''}`}
                                        onClick={() => {
                                            const delta =
                                                option.kind === 'delta' ? option.delta : option.shares
                                            if (shareMode === 'shares') {
                                                const next = Math.max(0, shares + delta)
                                                if (next !== shares) triggerHaptic('selection')
                                                setShares(next)
                                                checkInsufficient(next)
                                            } else {
                                                const next = Math.max(
                                                    0,
                                                    Math.round((amount + delta) * 100) / 100,
                                                )
                                                if (next !== amount) triggerHaptic('selection')
                                                setAmount(next)
                                                setAmountText(next.toFixed(2))
                                                checkInsufficient(next)
                                            }
                                        }}
                                    >
                                        <span className={styles.quickPickButtonText}>
                                            {quickPickLabel(option)}
                                        </span>
                                    </button>
                                    {index < QUICK_PICKS.length - 1 ? (
                                        <span className={styles.quickPickDivider} aria-hidden />
                                    ) : null}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>

                <motion.div
                    className={styles.buttonWrapper}
                    animate={buttonState === 'success' ? { y: [0, 3, -1, 0] } : { y: 0 }}
                    transition={
                        buttonState === 'success'
                            ? { duration: 0.4, ease: [0.16, 1, 0.3, 1], times: [0, 0.2, 0.5, 1] }
                            : SPRING
                    }
                >
                    <div className={styles.buttonOverlay} />
                    <motion.button
                        ref={buttonRef}
                        className={`${styles.button} ${buttonState === 'ordering' ? styles.buttonOrdering : ''} ${buttonState === 'success' ? styles.buttonSuccess : ''}`}
                        type="button"
                        onClick={handleOrder}
                        disabled={buttonState !== 'idle'}
                        transition={SPRING}
                        style={{ position: 'relative', overflow: 'hidden', pointerEvents: 'auto' }}
                    >
                        {(buttonState === 'ordering' || buttonState === 'success') && (
                            <div className={styles.buttonShine} />
                        )}

                        <AnimatePresence mode="popLayout" initial={false}>
                            {buttonState === 'idle' && (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className={styles.buttonText}
                                >
                                    <AnimatedText text={idleLabel} />
                                </motion.div>
                            )}

                            {buttonState === 'ordering' && (
                                <motion.div
                                    key="ordering"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className={styles.buttonText}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        position: 'relative',
                                        zIndex: 1,
                                    }}
                                >
                                    <Spinner />
                                    <AnimatedText text={orderingLabel} />
                                </motion.div>
                            )}

                            {buttonState === 'success' && (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className={styles.buttonText}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <Checkmark />
                                    <AnimatedText text={successLabel} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </motion.div>
            </div>
        </div>
    )
}

function AnimatedText({ text }: { text: string }) {
    const words = text.split(' ')
    let charOffset = 0
    return (
        <span style={{ display: 'inline-flex', gap: 4 }}>
            {words.map((word, wordIndex) => {
                const startOffset = charOffset
                charOffset += word.length
                return (
                    <span key={`${word}-${wordIndex}`} style={{ display: 'inline-flex' }}>
                        {word.split('').map((char, charIndex) => (
                            <motion.span
                                key={`${char}-${startOffset + charIndex}`}
                                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                transition={{
                                    ...LETTER_SPRING,
                                    delay: (startOffset + charIndex) * 0.008,
                                } as Transition}
                                style={{ display: 'inline-block' }}
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
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
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
