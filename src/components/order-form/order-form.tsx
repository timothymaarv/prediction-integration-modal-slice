import styles from './order-form.module.css'
import CloseIcon from "../../assets/custom/close.svg?react"
import PlusIcon from "../../assets/custom/plus.svg?react"
import MinusIcon from "../../assets/custom/minus.svg?react"
import MaximizeIcon from "../../assets/custom/maximize.svg?react"
import SettingsIcon from "../../assets/custom/settings.svg?react"
import ChevronDown from "../../assets/custom/chevron-down.svg?react"
import CircularPlusIcon from '../../assets/custom/circular-plus.svg?react'
import DollarSignIcon from '../../assets/custom/dollar-sign.svg?react'
import SwitcherArrowIcon from '../../assets/custom/switcher-arrow.svg?react'
import CalendarIcon from '../../assets/custom/calendar.svg?react'
import ExpirationCalendar from './expiration-calendar'
import ExpirationTimePicker from './expiration-time-picker'
import OrderFormButton from './order-form-button'
import ClockIcon from '../../assets/custom/timer.svg?react'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { isToday, format } from 'date-fns';
import useMeasure from 'react-use-measure';

type Tab = "order form" | "AI analysis";
const TABS: Tab[] = ["order form"];

type OrderMode = "market" | "limit" | "split" | "merge";
const ORDER_MODES: OrderMode[] = ["market", "limit", "split", "merge"];
const DISABLED_MODES: OrderMode[] = ["split", "merge"];


type expirationPreset = '5m' | "1h" | "12h" | "24h" | "eod" | "relative" | "custom";

const EXPIRATION_PRESETS: expirationPreset[] = ["5m", "1h", "12h", "24h", "eod", "relative", "custom"];

function expirationPresetLabel(preset: expirationPreset): string {
    switch (preset) {
        case "5m": return "5m"
        case "1h": return "1h"
        case "12h": return "12h"
        case "24h": return "24h"
        case "eod": return "EOD"
        case "relative": return "Relative"
        case "custom": return "Custom"
    }
}

function expirationPresetButtonLabel(preset: expirationPreset): string {
    switch (preset) {
        case "eod": return "End of day"
        default: return expirationPresetLabel(preset)
    }
}

function orderModeLabel(mode: OrderMode): string {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** Buy / Sell segmented control */
type SwitcherAction = "buy" | "sell";
const SWITCHER_ACTIONS: SwitcherAction[] = ["buy", "sell"];

/** Yes / No outcome side */
type SideAction = "yes" | "no";
const SIDE_ACTIONS: SideAction[] = ["yes", "no"];

type ShareMode = "shares" | "amount";

/** Shares quick-pick: fixed deltas, or market-specific minimum-liquidity reward size */
export type SharesQuickPickOption =
    | { kind: "delta"; delta: number }
    | { kind: "minimumLiquidityReward"; shares: number };

const BASE_SHARES_QUICK_PICKS: readonly SharesQuickPickOption[] = [
    { kind: "delta", delta: -100 },
    { kind: "delta", delta: -10 },
    { kind: "delta", delta: 10 },
    { kind: "delta", delta: 100 },
];

function buildSharesQuickPickOptions(
    minimumLiquidityRewardShares: number | null | undefined,
): SharesQuickPickOption[] {
    const out = [...BASE_SHARES_QUICK_PICKS];
    if (
        minimumLiquidityRewardShares != null &&
        minimumLiquidityRewardShares > 0
    ) {
        out.push({
            kind: "minimumLiquidityReward",
            shares: minimumLiquidityRewardShares,
        });
    }
    return out;
}

function sharesQuickPickLabel(option: SharesQuickPickOption): string {
    if (option.kind === "delta") {
        return option.delta > 0 ? `+${option.delta}` : `${option.delta}`;
    }
    return `+${option.shares}`;
}

function sharesQuickPickKey(option: SharesQuickPickOption, index: number): string {
    if (option.kind === "delta") {
        return `delta:${option.delta}`;
    }
    return `minimumLiquidityReward:${option.shares}:${index}`;
}


const TEMP_BUY_PRICE = "17¢";
const TEMP_SELL_PRICE = "19.0¢";

/** Price-per-share in cents, by outcome side. Used for total / balance math. */
const YES_PRICE_CENTS = 17;
const NO_PRICE_CENTS = 19;

const LIMIT_PRICE_STEP = 0.1;
const LIMIT_PRICE_MAX = 99.9;

/** Plain number string, one decimal (0.1 steps). */
function formatLimitPriceDisplay(value: number): string {
    return value.toFixed(1);
}

/** Snap to 0.1 steps; clamp [0, 99.9]. */
function parseLimitPriceInput(raw: string): number {
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (cleaned === "" || cleaned === ".") return 0;
    const n = parseFloat(cleaned);
    if (Number.isNaN(n)) return 0;
    const snapped = Math.round(n * 10) / 10;
    return Math.min(LIMIT_PRICE_MAX, Math.max(0, snapped));
}

export type OrderFormProps = {
    /** When set (>0), appends the minimum-liquidity quick-pick; amount varies by market. */
    minimumLiquidityRewardShares?: number | null;
};

export default function OrderForm({
    minimumLiquidityRewardShares = 50,
}: OrderFormProps) {

    const [OPEN_TAB, setOPEN_TAB] = useState<Tab>("order form")
    const [orderMode, setOrderMode] = useState<OrderMode>("limit")
    const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
    const modeDropdownRef = useRef<HTMLDivElement>(null)
    const [selectedSwitcherAction, setSelectedSwitcherAction] = useState<SwitcherAction>("buy")
    const [selectedSideAction, setSelectedSideAction] = useState<SideAction>("yes")
    const [shareMode, setShareMode] = useState<ShareMode>("shares")
    const [shares, setShares] = useState(17)
    const [amount, setAmount] = useState(0)
    const [amountEditing, setAmountEditing] = useState(false)
    const amountInputRef = useRef<HTMLInputElement>(null)
    const [limitPrice, setLimitPrice] = useState(0)
    const limitPriceInputRef = useRef<HTMLInputElement>(null)
    const limitPriceRowRef = useRef<HTMLDivElement>(null)
    const limitPricePrevValueRef = useRef("")
    const [showLimitCentSuffix, setShowLimitCentSuffix] = useState(false)
    const [expirationEnabled, setExpirationEnabled] = useState(false)
    const [expirationPreset, setExpirationPreset] = useState<expirationPreset>("5m")
    const [expirationMenuOpen, setExpirationMenuOpen] = useState(false)
    const expirationMenuRef = useRef<HTMLDivElement>(null)
    const expirationTriggerRef = useRef<HTMLButtonElement>(null)
    const [relativeExpiration, setRelativeExpiration] = useState("")
    const relativeExpirationInputRef = useRef<HTMLInputElement>(null)
    const [relativeExpirationError, setRelativeExpirationError] = useState(false)
    const relativeExpirationErrorRef = useRef<HTMLParagraphElement>(null)
    const relativeExpirationErrorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [customExpirationDate, setCustomExpirationDate] = useState<Date | null>(null)
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [customExpirationHours, setCustomExpirationHours] = useState(3)
    const [customExpirationMinutes, setCustomExpirationMinutes] = useState(0)
    const [timePickerOpen, setTimePickerOpen] = useState(false)
    const [limitPriceEditing, setLimitPriceEditing] = useState(false)
    const [sharesEditing, setSharesEditing] = useState(false)
    const [insufficientFunds, setInsufficientFunds] = useState(false)
    const insufficientTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [balance, setBalance] = useState(350)
    const [isOrdering, setIsOrdering] = useState(false)
    const [toWinDelayedDollars, setToWinDelayedDollars] = useState(0)
    const [toWinLoading, setToWinLoading] = useState(true)
    const sharesInputRef = useRef<HTMLInputElement>(null)
    const insufficientBannerRef = useRef<HTMLDivElement>(null)

    const [contentRef, bounds] = useMeasure()
    const previousHeightRef = useRef<number>(0)

    const heightDuration = useMemo(() => {
        const currentHeight = bounds.height
        const previousHeight = previousHeightRef.current

        const MIN_DURATION = 0.15
        const MAX_DURATION = 0.27

        if (!previousHeightRef.current) {
            previousHeightRef.current = currentHeight
            return MIN_DURATION
        }

        const heightDifference = Math.abs(currentHeight - previousHeight)
        previousHeightRef.current = currentHeight

        return Math.min(
            Math.max(heightDifference / 500, MIN_DURATION),
            MAX_DURATION,
        )
    }, [bounds.height])

    const { trigger: triggerHaptic } = useWebHaptics()

    const wiggleLimitPrice = useCallback(() => {
        const el = limitPriceRowRef.current
        if (!el) return
        el.classList.remove(styles.orderFormLimitPriceWiggle)
        void el.offsetHeight
        el.classList.add(styles.orderFormLimitPriceWiggle)
        triggerHaptic("warning")
    }, [triggerHaptic])

    const isValidRelativeExpiration = useCallback((value: string): boolean => {
        if (!value.trim()) return true
        return /^(\d+\s*(m|h|d|w|y)\s*)+$/i.test(value.trim())
    }, [])

    const triggerRelativeExpirationError = useCallback(() => {
        if (relativeExpirationErrorTimerRef.current) clearTimeout(relativeExpirationErrorTimerRef.current)
        setRelativeExpirationError(true)
        triggerHaptic("warning")

        requestAnimationFrame(() => {
            const el = relativeExpirationErrorRef.current
            if (el) {
                el.style.animation = "none"
                void el.offsetHeight
                el.style.animation = ""
            }
        })

        relativeExpirationErrorTimerRef.current = setTimeout(() => {
            setRelativeExpirationError(false)
            setTimeout(() => {
                relativeExpirationInputRef.current?.focus()
            }, 50)
        }, 2500)
    }, [triggerHaptic])

    const handleModeSelect = useCallback((mode: OrderMode) => {
        if (DISABLED_MODES.includes(mode)) return
        if (orderMode !== mode) triggerHaptic("selection")
        setOrderMode(mode)
        setModeDropdownOpen(false)
    }, [orderMode, triggerHaptic])

    useEffect(() => {
        if (!modeDropdownOpen) return
        const onClickOutside = (e: MouseEvent) => {
            if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
                setModeDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", onClickOutside)
        return () => document.removeEventListener("mousedown", onClickOutside)
    }, [modeDropdownOpen])

    useEffect(() => {
        if (!expirationMenuOpen) return
        const onClickOutside = (e: MouseEvent) => {
            if (
                expirationMenuRef.current && !expirationMenuRef.current.contains(e.target as Node) &&
                expirationTriggerRef.current && !expirationTriggerRef.current.contains(e.target as Node)
            ) {
                setExpirationMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", onClickOutside)
        return () => document.removeEventListener("mousedown", onClickOutside)
    }, [expirationMenuOpen])

    useEffect(() => {
        if (!expirationMenuOpen || !expirationMenuRef.current) return
        const active = expirationMenuRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null
        if (active) active.scrollIntoView({ block: "nearest" })
    }, [expirationMenuOpen])

    useEffect(() => {
        if (expirationPreset === "relative" && relativeExpirationInputRef.current) {
            relativeExpirationInputRef.current.focus()
        }
    }, [expirationPreset])

    const showInsufficientFunds = useCallback(() => {
        if (insufficientTimerRef.current) clearTimeout(insufficientTimerRef.current)
        setInsufficientFunds(true)
        triggerHaptic("warning")

        // re-trigger wiggle if already showing
        if (insufficientBannerRef.current) {
            const el = insufficientBannerRef.current
            el.style.animation = "none"
            void el.offsetHeight
            el.style.animation = ""
        }

        insufficientTimerRef.current = setTimeout(() => setInsufficientFunds(false), 3500)
    }, [triggerHaptic])

    const pricePerShareCents =
        selectedSideAction === "yes" ? YES_PRICE_CENTS : NO_PRICE_CENTS

    const effectiveShares = shareMode === "shares"
        ? shares
        : Math.floor(amount * 100 / pricePerShareCents)

    const totalDollars = shareMode === "shares"
        ? (shares * pricePerShareCents) / 100
        : amount

    const toWinDollars =
        selectedSwitcherAction === "buy"
            ? (effectiveShares * (100 - pricePerShareCents)) / 100
            : (effectiveShares * pricePerShareCents) / 100

    useEffect(() => {
        setToWinLoading(true)
        const t = setTimeout(() => {
            setToWinDelayedDollars(toWinDollars)
            setToWinLoading(false)
        }, 1000)
        return () => clearTimeout(t)
    }, [toWinDollars, orderMode, selectedSwitcherAction])

    const wouldBeInsufficient = (primaryValue: number) => {
        const total = shareMode === "shares"
            ? (primaryValue * pricePerShareCents) / 100
            : primaryValue
        return total > balance
    }

    const checkInsufficient = (primaryValue: number) => {
        if (wouldBeInsufficient(primaryValue)) {
            showInsufficientFunds()
        }
    }

    useEffect(() => {
        if (limitPriceEditing && limitPriceInputRef.current) {
            const el = limitPriceInputRef.current
            el.focus()
            const end = el.value.length
            el.setSelectionRange(end, end)
        }
    }, [limitPriceEditing])

    useEffect(() => {
        if (sharesEditing && sharesInputRef.current) {
            const el = sharesInputRef.current
            el.focus()
            const end = el.value.length
            el.setSelectionRange(end, end)
        }
    }, [sharesEditing])

    useEffect(() => {
        if (amountEditing && amountInputRef.current) {
            const el = amountInputRef.current
            el.focus()
            const end = el.value.length
            el.setSelectionRange(end, end)
        }
    }, [amountEditing])

    const syncLimitCentSuffixFromRaw = (raw: string) => {
        const t = raw.trim()
        if (t === "") {
            setShowLimitCentSuffix(false)
            return
        }
        const n = parseFloat(t)
        setShowLimitCentSuffix(Number.isFinite(n) && n > 0)
    }

    /**
     * Only fix over-precise fractions (e.g. 0.111 → 0.1). Does not touch empty, "0", "0.", or
     * a single digit after the dot so the field can be cleared normally.
     */
    const normalizeLimitPriceField = (el: HTMLInputElement) => {
        if (el.value.trim() === "") return

        const s = el.value.replace(/[^\d.]/g, "")
        if (s === "") return

        const dot = s.indexOf(".")
        if (dot === -1) return

        const afterDot = s.slice(dot + 1).replace(/\./g, "")
        if (afterDot.length <= 1) return

        const next = parseLimitPriceInput(el.value)
        const formatted = formatLimitPriceDisplay(next)
        if (el.value !== formatted) {
            el.value = formatted
            el.setSelectionRange(formatted.length, formatted.length)
        }
    }

    const adjustLimitPrice = (delta: number) => {
        const el = limitPriceInputRef.current
        const current = el ? parseLimitPriceInput(el.value) : limitPrice
        const raw = Math.round((current + delta) * 10) / 10
        if ((delta > 0 && raw > LIMIT_PRICE_MAX) || (delta < 0 && raw < 0)) {
            wiggleLimitPrice()
            return
        }
        const next = Math.min(LIMIT_PRICE_MAX, Math.max(0, raw))
        if (next !== current) triggerHaptic("selection")
        if (el) el.value = formatLimitPriceDisplay(next)
        setLimitPrice(next)
        setShowLimitCentSuffix(next > 0)
    }

    /** Snap + sync state; call before submit if the field may not have blurred. */
    const commitLimitPriceFromInput = () => {
        const el = limitPriceInputRef.current
        if (!el) return
        const raw = el.value.trim()
        if (raw === "") {
            el.value = ""
            setLimitPrice(0)
            setShowLimitCentSuffix(false)
            return
        }
        const next = parseLimitPriceInput(el.value)
        el.value = formatLimitPriceDisplay(next)
        setLimitPrice(next)
        setShowLimitCentSuffix(next > 0)
    }

    const sharesQuickPickOptions = useMemo(
        () => buildSharesQuickPickOptions(minimumLiquidityRewardShares),
        [minimumLiquidityRewardShares],
    )

    const toggleShareMode = () => {
        if (shareMode === "shares") {
            setAmount(totalDollars)
            setShareMode("amount")
        } else {
            setShares(effectiveShares)
            setShareMode("shares")
        }
        triggerHaptic("selection")
    }

    const switcherDisplayText = (() => {
        const side = selectedSideAction === "yes" ? "Y" : "N"
        if (shareMode === "shares") {
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
            return `${m % 1 === 0 ? m : m.toFixed(1)}M ${side}`
        }
        if (s >= 1000) {
            const k = s / 1000
            return `${k % 1 === 0 ? k : k.toFixed(1)}K ${side}`
        }
        return `${s} ${side}`
    })()

    const isLimitMode = orderMode === "limit"

    const pickerOverlayVisible = calendarOpen || timePickerOpen || expirationMenuOpen || modeDropdownOpen

    return <div className={styles.orderFormContainer}>


        {pickerOverlayVisible && <div className={styles.orderFormPickerOverlay} />}

        {/* header - component header since most of them have headers */}

        <div className={styles.componentHeader}>

            <div className={styles.componentHeaderNavigation}>
                <div className={styles.componentHeaderNavigationButtons}>

                    {
                        TABS.map((tab) => (
                            <button
                                key={tab}
                                className={`${styles.componentHeaderButton} ${tab === OPEN_TAB && styles.componentHeaderButtonActive}`}
                                onClick={() => setOPEN_TAB(tab)}
                            >
                                <p className={styles.componentHeaderButtonText}>
                                    {tab === "order form" ? "Order form" : "AI analysis"}
                                </p>
                                <CloseIcon className={styles.componentHeaderButtonIcon} />
                            </button>
                        ))
                    }


                    <button className={`${styles.componentHeaderButton} ${styles.componentHeaderButtonWithIcon}`}>
                        <PlusIcon className={styles.componentHeaderButtonIcon} />
                    </button>
                </div>
            </div>


            <div className={styles.componentHeaderRight}>
                <div className={styles.componentHeaderRightControlButtons}>
                    <button className={styles.componentHeaderControlButton}>
                        <MaximizeIcon className={styles.componentHeaderControlButtonIcon} />
                    </button>
                    <button className={styles.componentHeaderControlButton}>
                        <SettingsIcon className={`${styles.componentHeaderControlButtonIcon} ${styles.componentHeaderControlButtonIconLg}`} />
                    </button>
                </div>
            </div>

        </div>


        <motion.div
            className={styles.orderFormWrapper}
            animate={{
                height: bounds.height || "auto",
                transition: {
                    duration: heightDuration,
                    ease: [0.25, 1, 0.5, 1],
                },
            }}
        >
            <div ref={contentRef}>

                {/* order form header */}
                <div className={styles.orderFormHeader} style={isOrdering ? { pointerEvents: "none", opacity: 0.5, transition: "opacity 200ms ease" } : { transition: "opacity 200ms ease" }}>

                    {/* controls */}
                    <div className={styles.orderFormControls}>

                        <div className={styles.orderFormControlButtons}>

                            {/* switcher */}
                            <div
                                className={styles.orderFormSwitcher}
                                role="group"
                                aria-label="Buy or sell"
                                data-active={selectedSwitcherAction}
                            >
                                <span className={styles.orderFormSwitcherIndicator} aria-hidden />
                                {SWITCHER_ACTIONS.map((action) => (
                                    <button
                                        key={action}
                                        type="button"
                                        className={`${styles.orderFormSwitcherButton} ${selectedSwitcherAction === action
                                            ? `${styles.orderFormSwitcherButtonActive} ${styles[action]}`
                                            : ""
                                            }`}
                                        onClick={() => {
                                            if (selectedSwitcherAction !== action) triggerHaptic("selection")
                                            setSelectedSwitcherAction(action)
                                        }}
                                        aria-pressed={selectedSwitcherAction === action}
                                    >
                                        <span className={styles.orderFormSwitcherButtonText}>
                                            {action === "buy" ? "Buy" : "Sell"}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* mode dropdown */}
                            <div className={styles.orderFormModeDropdownWrapper} ref={modeDropdownRef} data-open={modeDropdownOpen}>
                                <button
                                    className={styles.orderFormModeSelectButton}
                                    onClick={() => {
                                        triggerHaptic("selection")
                                        setModeDropdownOpen((v) => !v)
                                    }}
                                    aria-expanded={modeDropdownOpen}
                                    aria-haspopup="listbox"
                                >
                                    <p className={styles.orderFormModeSelectButtonText}>
                                        {orderModeLabel(orderMode)}
                                    </p>
                                    <ChevronDown className={`${styles.orderFormModeSelectButtonIcon} ${modeDropdownOpen ? styles.orderFormModeSelectButtonIconOpen : ""}`} />
                                </button>

                                {modeDropdownOpen && (
                                    <div className={styles.orderFormModeDropdown} role="listbox" aria-label="Order mode">
                                        {ORDER_MODES.map((mode) => {
                                            const isActive = mode === orderMode
                                            const isDisabled = DISABLED_MODES.includes(mode)
                                            return (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isActive}
                                                    aria-disabled={isDisabled}
                                                    className={`${styles.orderFormModeDropdownOption} ${isActive ? styles.orderFormModeDropdownOptionActive : ""} ${isDisabled ? styles.orderFormModeDropdownOptionDisabled : ""}`}
                                                    onClick={() => handleModeSelect(mode)}
                                                >
                                                    <span className={styles.orderFormModeDropdownOptionText}>
                                                        {orderModeLabel(mode)}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>


                        {/* actions */}
                        <div className={styles.orderFormActions}>

                            <div className={styles.orderFormActionButtons} role="group" aria-label="Side">

                                {SIDE_ACTIONS.map((action) => (
                                    <button
                                        key={action}
                                        type="button"
                                        className={`${styles.orderFormActionButton} ${styles[action]} ${selectedSideAction === action ? styles.orderFormActionButtonActive : ""}`}
                                        onClick={() => {
                                            if (selectedSideAction !== action) triggerHaptic("selection")
                                            setSelectedSideAction(action)
                                        }}
                                        aria-pressed={selectedSideAction === action}
                                    >
                                        <span className={styles.orderFormActionButtonText}>{action}</span>
                                        <span className={styles.orderFormActionButtonSubText}>
                                            {action === "yes" ? TEMP_BUY_PRICE : TEMP_SELL_PRICE}
                                        </span>
                                    </button>
                                ))}

                            </div>

                        </div>


                    </div>


                    {/* form */}

                    <div className={styles.orderFormActualForm}>
                        {/* balance */}
                        <div className={styles.orderFormBalance}>
                            <span className={styles.orderFormBalanceLabel}>Balance</span>

                            <div className={styles.orderFormBalanceContent}>
                                <div className={styles.orderFormBalanceInput}>
                                    <NumberFlow
                                        value={balance}
                                        format={{ maximumFractionDigits: 2 }}
                                        className={styles.orderFormBalanceValue}
                                    />
                                    <span className={styles.orderFormBalanceUnit}>USD</span>
                                </div>

                                <button
                                    type="button"
                                    className={styles.orderFormBalancePlusButton}
                                    onClick={() => { triggerHaptic("light"); setBalance((b) => b + 100) }}
                                    aria-label="Add funds"
                                >
                                    <CircularPlusIcon className={styles.orderFormBalancePlusIcon} />
                                </button>
                            </div>
                        </div>

                        {/* limit price */}
                        {isLimitMode && (
                            <div ref={limitPriceRowRef} className={styles.orderFormLimitPrice}>
                                <span className={styles.orderFormLimitPriceLabel}>Limit price</span>

                                <div className={styles.orderFormLimitPriceContent}>

                                    <button
                                        type="button"
                                        className={styles.orderFormLimitPriceButton}
                                        aria-label="Decrease limit price"
                                        onClick={() => adjustLimitPrice(-LIMIT_PRICE_STEP)}
                                    >
                                        <MinusIcon className={styles.orderFormLimitPriceButtonIcon} />
                                    </button>

                                    {/* set max limit price - let's lock at 99.9¢ */}
                                    <div className={styles.orderFormLimitPriceInput}>
                                        {limitPriceEditing ? (
                                            <>
                                                <input
                                                    ref={limitPriceInputRef}
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    aria-label="Limit price in cents"
                                                    className={styles.orderFormLimitPriceInputField}
                                                    placeholder="0.0¢"
                                                    defaultValue={limitPrice > 0 ? formatLimitPriceDisplay(limitPrice) : ""}
                                                    onFocus={(e) => {
                                                        limitPricePrevValueRef.current = e.currentTarget.value
                                                    }}
                                                    onInput={(e) => {
                                                        const el = e.currentTarget
                                                        normalizeLimitPriceField(el)
                                                        const parsed = parseLimitPriceInput(el.value)
                                                        if (parsed > LIMIT_PRICE_MAX) {
                                                            el.value = limitPricePrevValueRef.current
                                                            wiggleLimitPrice()
                                                            return
                                                        }
                                                        limitPricePrevValueRef.current = el.value
                                                        syncLimitCentSuffixFromRaw(el.value)
                                                    }}
                                                    onBlur={() => {
                                                        commitLimitPriceFromInput()
                                                        setLimitPriceEditing(false)
                                                    }}
                                                />
                                                {showLimitCentSuffix ? (
                                                    <span className={styles.orderFormLimitPriceSuffix} aria-hidden>
                                                        ¢
                                                    </span>
                                                ) : null}
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                aria-label="Edit limit price"
                                                className={styles.orderFormLimitPriceDisplay}
                                                onClick={() => setLimitPriceEditing(true)}
                                            >
                                                <NumberFlow
                                                    value={limitPrice}
                                                    format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                                                    suffix="¢"
                                                    className={`${styles.orderFormLimitPriceNumberFlow} ${limitPrice === 0 ? styles.orderFormLimitPriceNumberFlowPlaceholder : ""}`}
                                                />
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        className={styles.orderFormLimitPriceButton}
                                        aria-label="Increase limit price"
                                        onClick={() => adjustLimitPrice(LIMIT_PRICE_STEP)}
                                    >
                                        <PlusIcon className={styles.orderFormLimitPriceButtonIcon} />
                                    </button>

                                </div>
                            </div>
                        )}

                        {/* shares */}
                        <div className={styles.orderFormSharesContainer}>

                            {/* top */}
                            <div className={styles.orderFormShares}>
                                <span className={styles.orderFormSharesLabel}>
                                    {shareMode === "shares" ? "Shares" : "Amount"}
                                </span>
                                <div className={styles.orderFormSharesContent}>
                                    <div className={styles.orderFormSharesValue}>
                                        {shareMode === "shares" ? (
                                            sharesEditing ? (
                                                <input
                                                    ref={sharesInputRef}
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete="off"
                                                    aria-label="Shares"
                                                    className={styles.orderFormSharesValueInput}
                                                    size={Math.max(1, String(shares).length)}
                                                    value={shares}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\D/g, "");
                                                        let next = 0
                                                        if (raw !== "") {
                                                            const n = parseInt(raw, 10);
                                                            if (!Number.isNaN(n)) next = Math.max(0, n);
                                                        }
                                                        setShares(next);
                                                        checkInsufficient(next)
                                                    }}
                                                    onBlur={() => setSharesEditing(false)}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    aria-label="Edit shares"
                                                    className={styles.orderFormSharesDisplay}
                                                    onClick={() => setSharesEditing(true)}
                                                >
                                                    <NumberFlow
                                                        value={shares}
                                                        className={styles.orderFormSharesNumberFlow}
                                                    />
                                                </button>
                                            )
                                        ) : (
                                            amountEditing ? (
                                                <input
                                                    ref={amountInputRef}
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    aria-label="Amount in USD"
                                                    className={styles.orderFormSharesValueInput}
                                                    size={Math.max(1, amount.toFixed(2).length)}
                                                    value={amount}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/[^\d.]/g, "")
                                                        if (raw === "" || raw === ".") {
                                                            setAmount(0)
                                                            return
                                                        }
                                                        const n = parseFloat(raw)
                                                        if (Number.isNaN(n)) return
                                                        const next = Math.round(n * 100) / 100
                                                        setAmount(Math.max(0, next))
                                                        checkInsufficient(Math.max(0, next))
                                                    }}
                                                    onBlur={() => setAmountEditing(false)}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    aria-label="Edit amount"
                                                    className={styles.orderFormSharesDisplay}
                                                    onClick={() => setAmountEditing(true)}
                                                >
                                                    <NumberFlow
                                                        value={amount}
                                                        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                                                        className={styles.orderFormSharesNumberFlow}
                                                    />
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        className={styles.orderFormShareModeSwitcher}
                                        onClick={toggleShareMode}
                                    >
                                        <SwitcherArrowIcon className={styles.orderFormShareModeSwitcherIcon} />
                                        <p className={styles.orderFormShareModeSwitcherText}>{switcherDisplayText}</p>
                                    </button>
                                </div>
                            </div>

                            {/* insufficient  balance */}
                            <div
                                className={`${styles.insufficientBalanceCollapse} ${insufficientFunds ? styles.insufficientBalanceCollapseShow : ""}`}
                                aria-hidden={!insufficientFunds}
                            >
                                <div className={styles.insufficientBalanceCollapseInner}>
                                    <div ref={insufficientBannerRef} className={styles.insufficientBalance} role="alert">
                                        <p className={styles.insufficientBalanceText}>Insufficient funds</p>
                                    </div>
                                </div>
                            </div>

                            {/* options */}
                            <div className={styles.orderFormSharesQuickPick}>
                                <div className={styles.orderFormSharesQuickPickButtons}>
                                    {sharesQuickPickOptions.map((option, index) => (
                                        <Fragment key={sharesQuickPickKey(option, index)}>
                                            <button
                                                type="button"
                                                className={`${styles.orderFormSharesQuickPickButton} ${option.kind === "minimumLiquidityReward" ? styles.orderFormSharesQuickPickButtonMinimumLiquidity : ""}`}
                                                onClick={() => {
                                                    if (shareMode === "shares") {
                                                        const next =
                                                            option.kind === "delta"
                                                                ? Math.max(0, shares + option.delta)
                                                                : shares + option.shares
                                                        if (next !== shares) triggerHaptic("selection")
                                                        setShares(next)
                                                        checkInsufficient(next)
                                                    } else {
                                                        const delta = option.kind === "delta" ? option.delta : option.shares
                                                        const next = Math.max(0, Math.round((amount + delta) * 100) / 100)
                                                        if (next !== amount) triggerHaptic("selection")
                                                        setAmount(next)
                                                        checkInsufficient(next)
                                                    }
                                                }}
                                            >
                                                <span className={styles.orderFormSharesQuickPickButtonText}>
                                                    {sharesQuickPickLabel(option)}
                                                </span>
                                            </button>
                                            {index < sharesQuickPickOptions.length - 1 ? (
                                                <span
                                                    className={styles.orderFormSharesQuickPickDivider}
                                                    aria-hidden
                                                />
                                            ) : null}
                                        </Fragment>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>

                </div>





                {/* order form footer */}
                <div className={styles.orderFormFooter}>
                    {/* footer controls  */}
                    <div className={styles.orderFormFooterControls} data-mode={orderMode}>

                        {/* expiration controller */}
                        {isLimitMode && (<>
                            <div className={styles.orderFormExpirationController}>
                                <div className={styles.orderFormExpirationControllerLeft}>
                                    {/* toggle switch */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={expirationEnabled}
                                        aria-label="Set expiration"
                                        className={`${styles.orderFormExpirationToggle} ${expirationEnabled ? styles.orderFormExpirationToggleActive : ""}`}
                                        onClick={() => {
                                            triggerHaptic("medium")
                                            setExpirationEnabled((v) => !v)
                                        }}
                                    />


                                    <p
                                        className={styles.orderFormExpirationToggleLeftLabel}
                                        onClick={() => {
                                            triggerHaptic("medium")
                                            setExpirationEnabled((v) => !v)
                                        }}
                                        style={{ cursor: "pointer" }}
                                    >Set Expiration</p>

                                </div>

                                <div className={styles.orderFormExpirationControllerRight} data-open={expirationMenuOpen}>
                                    <button
                                        ref={expirationTriggerRef}
                                        type="button"
                                        className={styles.orderFormExpirationSelectButton}
                                        data-active={expirationEnabled}
                                        onClick={() => {
                                            triggerHaptic("selection")
                                            setExpirationMenuOpen((v) => !v)
                                        }}
                                        aria-expanded={expirationMenuOpen}
                                        aria-haspopup="listbox"
                                    >
                                        <p className={styles.orderFormExpirationSelectButtonText}>
                                            {expirationPresetButtonLabel(expirationPreset)}
                                        </p>
                                        <ChevronDown className={`${styles.orderFormExpirationSelectButtonIcon} ${expirationMenuOpen ? styles.orderFormExpirationSelectButtonIconOpen : ""}`} />
                                    </button>

                                    {expirationMenuOpen && (
                                        <div
                                            ref={expirationMenuRef}
                                            className={styles.orderFormExpirationExpandingMenu}
                                            role="listbox"
                                            aria-label="Expiration preset"
                                        >
                                            {EXPIRATION_PRESETS.map((preset) => {
                                                const isActive = preset === expirationPreset
                                                return (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={isActive}
                                                        className={`${styles.orderFormExpirationExpandingMenuOption} ${isActive ? styles.orderFormExpirationExpandingMenuOptionActive : ""}`}
                                                        onClick={() => {
                                                            if (expirationPreset !== preset) triggerHaptic("selection")
                                                            setExpirationPreset(preset)
                                                            setExpirationMenuOpen(false)
                                                        }}
                                                    >
                                                        <p className={styles.orderFormExpirationExpandingMenuOptionText}>
                                                            {expirationPresetLabel(preset)}
                                                        </p>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>



                            {(expirationPreset === "relative" || expirationPreset === "custom") && expirationEnabled && (
                                <div className={styles.orderFormExpirationControllerFooter}>


                                    <p className={styles.orderFormExpirationControllerFooterText}>
                                        Expiration
                                    </p>

                                    {/* relative */}
                                    {expirationPreset === "relative" && <div className={`${styles.orderFormExpirationControllerFooterRightSection} ${styles.orderFormExpirationControllerFooterRightSectionRelative} ${relativeExpirationError ? styles.orderFormExpirationControllerFooterRightSectionErrorState : ""}`}>
                                        <CalendarIcon className={styles.orderFormExpirationControllerFooterRightSectionIcon} />
                                        {relativeExpirationError ? (
                                            <p
                                                ref={relativeExpirationErrorRef}
                                                className={`${styles.orderFormExpirationControllerFooterRightSectionText} ${styles.orderFormExpirationControllerFooterRightSectionError}`}
                                            >
                                                Invalid date
                                            </p>
                                        ) : (
                                            <input
                                                ref={relativeExpirationInputRef}
                                                type="text"
                                                autoComplete="off"
                                                aria-label="Relative expiration"
                                                className={styles.orderFormExpirationControllerFooterRightSectionText}
                                                placeholder="e.g 15m or 2h 30m"
                                                size={Math.max(1, relativeExpiration.length || 16)}
                                                value={relativeExpiration}
                                                onChange={(e) => setRelativeExpiration(e.target.value)}
                                                onBlur={() => {
                                                    if (relativeExpiration && !isValidRelativeExpiration(relativeExpiration)) {
                                                        setRelativeExpiration("")
                                                        triggerRelativeExpirationError()
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        if (relativeExpiration && !isValidRelativeExpiration(relativeExpiration)) {
                                                            setRelativeExpiration("")
                                                            triggerRelativeExpirationError()
                                                        } else {
                                                            e.currentTarget.blur()
                                                        }
                                                    }
                                                }}
                                            />
                                        )}
                                    </div>}

                                    {/* custom */}
                                    {expirationPreset === "custom" && <div className={styles.orderFormExpirationControllerFooterRightSectionCustom}>
                                        <button
                                            type="button"
                                            className={styles.orderFormExpirationControllerFooterRightSection}
                                            onClick={() => { triggerHaptic("selection"); setCalendarOpen((v) => !v) }}
                                        >
                                            <CalendarIcon className={styles.orderFormExpirationControllerFooterRightSectionIcon} />
                                            <p className={styles.orderFormExpirationControllerFooterRightSectionText}>
                                                {customExpirationDate
                                                    ? isToday(customExpirationDate)
                                                        ? "Today"
                                                        : format(customExpirationDate, customExpirationDate.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy")
                                                    : "Today"}
                                            </p>
                                        </button>

                                        <div style={{ position: "relative" }}>
                                            <button
                                                type="button"
                                                className={styles.orderFormExpirationControllerFooterRightSection}
                                                onClick={() => { triggerHaptic("selection"); setTimePickerOpen((v) => !v) }}
                                            >
                                                <ClockIcon className={styles.orderFormExpirationControllerFooterRightSectionIcon} />
                                                <p className={styles.orderFormExpirationControllerFooterRightSectionText}>
                                                    {`${customExpirationHours % 12 || 12}:${customExpirationMinutes.toString().padStart(2, "0")} ${customExpirationHours < 12 ? "AM" : "PM"}`}
                                                </p>
                                            </button>

                                            {timePickerOpen && (
                                                <ExpirationTimePicker
                                                    hours={customExpirationHours}
                                                    minutes={customExpirationMinutes}
                                                    onChangeHours={setCustomExpirationHours}
                                                    onChangeMinutes={setCustomExpirationMinutes}
                                                    onClose={() => setTimePickerOpen(false)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    }

                                    {calendarOpen && (
                                        <ExpirationCalendar
                                            selected={customExpirationDate}
                                            onSelect={(date) => setCustomExpirationDate(date)}
                                            onClose={() => setCalendarOpen(false)}
                                        />
                                    )}
                                </div>
                            )}

                        </>)}

                        {/* to win */}
                        <div className={styles.orderFormToWin}>

                            <div className={styles.orderFormToWinLeft}>
                                <p className={styles.orderFormToWinLeftLabel}>To win</p>
                            </div>


                            <div className={styles.orderFormToWinRight}>

                                {/* dollar icon */}
                                <DollarSignIcon className={styles.orderFormToWinRightIcon} />

                                {toWinLoading ? (
                                    <span
                                        className={`${styles.orderFormToWinRightText} ${styles.orderFormToWinDots}`}
                                        aria-label="Calculating"
                                    >
                                        <span className={styles.orderFormToWinDot}>.</span>
                                        <span className={styles.orderFormToWinDot}>.</span>
                                        <span className={styles.orderFormToWinDot}>.</span>
                                    </span>
                                ) : (
                                    <NumberFlow
                                        value={toWinDelayedDollars}
                                        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                                        className={styles.orderFormToWinRightText}
                                    />
                                )}

                            </div>




                        </div>

                        {/* total */}

                        <div className={styles.orderFormTotal}>

                            <div className={styles.orderFormTotalLeft}>
                                <p className={styles.orderFormTotalLeftLabel}>Total</p>
                            </div>


                            <div className={styles.orderFormTotalRight}>

                                {/* dollar icon */}

                                <NumberFlow
                                    value={totalDollars}
                                    format={{ style: "currency", currency: "USD" }}
                                    className={styles.orderFormTotalRightText}
                                />

                            </div>




                        </div>

                    </div>

                    {/* button */}

                    <OrderFormButton
                        action={selectedSwitcherAction}
                        side={selectedSideAction}
                        disabled={isOrdering}
                        onOrder={() => {
                            const primaryValue = shareMode === "shares" ? shares : amount
                            if (wouldBeInsufficient(primaryValue)) {
                                showInsufficientFunds()
                                return false
                            }
                            triggerHaptic("success")
                            setBalance((b) => Math.max(0, Math.round((b - totalDollars) * 100) / 100))
                            return true
                        }}
                        onStateChange={setIsOrdering}
                    />
                </div>

            </div>
        </motion.div>

    </div>
}